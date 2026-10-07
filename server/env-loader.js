// This file must be loaded FIRST via --import flag in nodemon/node
// It ensures all environment variables are available before any other module loads.
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server directory (works from any CWD)
const result = dotenv.config({ path: path.join(__dirname, '.env') });

if (result.error) {
  console.warn('[env-loader] Warning: .env file not found at', path.join(__dirname, '.env'));
} else {
  console.log('[env-loader] Environment variables loaded ✓');
}

// Guard: warn if critical secrets are missing
const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('[env-loader] FATAL: Missing required env vars:', missing.join(', '));
  process.exit(1);
}
