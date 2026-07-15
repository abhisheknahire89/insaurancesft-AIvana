import { getActiveApiKey } from '../services/apiKeys';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("=== Active Keys in Test script ===");
console.log("GEMINI_API_KEY in process.env:", process.env.GEMINI_API_KEY);
console.log("VITE_GEMINI_API_KEY in process.env:", process.env.VITE_GEMINI_API_KEY);
console.log("getActiveApiKey() returned:", getActiveApiKey());
