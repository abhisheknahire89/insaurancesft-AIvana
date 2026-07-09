import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';
import * as path from 'path';

const isBrowser = typeof window !== 'undefined';

function loadEnv() {
    if (isBrowser) return;
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = (match[2] || '').trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.substring(1, value.length - 1);
                    } else if (value.startsWith("'") && value.endsWith("'")) {
                        value = value.substring(1, value.length - 1);
                    }
                    process.env[key] = value.trim();
                }
            }
        }
    } catch (e) {
        console.error("Failed to load inline .env file:", e);
    }
}

loadEnv();

export function getActiveApiKey(): string {
    const key = isBrowser
        ? ((import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
        : process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    return key || "";
}

// Startup verification check
if (isBrowser) {
    const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("CRITICAL STARTUP ERROR: VITE_GEMINI_API_KEY is missing from environment variables.");
        window.addEventListener('DOMContentLoaded', () => {
            const banner = document.createElement('div');
            banner.style.position = 'fixed';
            banner.style.top = '0';
            banner.style.left = '0';
            banner.style.width = '100%';
            banner.style.backgroundColor = '#ef4444';
            banner.style.color = '#ffffff';
            banner.style.padding = '16px';
            banner.style.textAlign = 'center';
            banner.style.fontWeight = 'bold';
            banner.style.zIndex = '999999';
            banner.innerHTML = "⚠️ CRITICAL STARTUP ERROR: VITE_GEMINI_API_KEY is missing from your environment variables. Please check your .env.local file.";
            document.body.appendChild(banner);
        });
        throw new Error("CRITICAL STARTUP ERROR: VITE_GEMINI_API_KEY is missing from environment variables (.env.local).");
    }
}

async function proxyGenerateContent(sdkType: 'genai' | 'generative-ai', args: any) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sdkType, args })
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Proxy error: ${response.status} - ${errText}`);
    }
    return await response.json();
}

/**
 * Exponential backoff retry for rate-limited API calls.
 * Retries on 429 (rate limit) and 503 (overloaded) errors.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4, baseDelayMs = 1000): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const status = err?.status ?? err?.code ?? err?.httpStatus ?? 0;
            const msg = String(err?.message ?? '');
            const isRateLimit = status === 429 || status === 503 ||
                msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') ||
                msg.includes('503') || msg.includes('quota');
            if (isRateLimit && attempt < maxAttempts - 1) {
                const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
                console.warn(`[apiKeys] Rate limit hit (attempt ${attempt + 1}/${maxAttempts}). Retrying in ${Math.round(delayMs)}ms...`);
                await new Promise(res => setTimeout(res, delayMs));
            } else {
                throw err;
            }
        }
    }
    throw new Error('withRetry: exhausted all attempts');
}

export function getGoogleGenAIClient(): any {
    if (!isBrowser) {
        // Node environment (scripts): talk to SDK directly with retry wrapper
        const sdk = new GoogleGenAI({ apiKey: getActiveApiKey() });
        return {
            models: {
                generateContent: (args: any) => withRetry(() => sdk.models.generateContent(args)),
                generateContentStream: (args: any) => sdk.models.generateContentStream(args),
            }
        };
    }

    // Browser: proxy via /api/gemini serverless function
    return {
        models: {
            generateContent: async (args: any) => {
                const resJson = await proxyGenerateContent('genai', args);
                return {
                    text: resJson.text,
                    candidates: resJson.candidates
                };
            },
            generateContentStream: async function* (args: any) {
                const resJson = await proxyGenerateContent('genai', args);
                yield {
                    text: resJson.text
                };
            }
        }
    };
}

export function getGoogleGenerativeAIClient(): any {
    if (!isBrowser) {
        return new GoogleGenerativeAI(getActiveApiKey());
    }

    return {
        getGenerativeModel: (modelArgs: { model: string }) => {
            return {
                generateContent: async (contents: any) => {
                    const resJson = await proxyGenerateContent('generative-ai', {
                        model: modelArgs.model,
                        contents
                    });
                    return {
                        response: {
                            text: () => resJson.text
                        }
                    };
                }
            };
        }
    };
}

export function rotateApiKey(): boolean {
    // No-op client side as rotation is handled at proxy level/backend pool if any.
    return false;
}
