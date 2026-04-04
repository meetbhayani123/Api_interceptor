import fs from 'fs';
import path from 'path';

/**
 * Centralized environment configuration.
 * Reads from process.env first, then falls back to .env file parsing.
 */
function loadEnvFile(): Record<string, string> {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf-8');
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) vars[match[1]] = match[2].trim();
    }
    return vars;
  } catch {
    return {};
  }
}

const envFile = loadEnvFile();

export const config = {
  port: Number(process.env.PORT || envFile.PORT || 3001),
  mongoUri: process.env.MONGO_URI || envFile.MONGO_URI || 'mongodb://localhost:27017/antigravity_db',
  deletePassword: process.env.DELETE_PASSWORD || envFile.DELETE_PASSWORD || 'admin123',
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS || envFile.POLLING_INTERVAL_MS || 3000),
  cors: {
    origin: process.env.CORS_ORIGIN || envFile.CORS_ORIGIN || '*',
  },
} as const;
