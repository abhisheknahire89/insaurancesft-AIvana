import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const envPath = path.join(PROJECT_ROOT, '.env');

if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        if (key && val) {
          process.env[key] = val;
          // Also set on global process.env in case of cross-module issues
          process.env[key] = val;
        }
      }
    }
    console.log('[EnvLoader] Successfully loaded variables from local .env file.');
  } catch (e) {
    console.error('[EnvLoader] Failed to read .env file:', e);
  }
}
