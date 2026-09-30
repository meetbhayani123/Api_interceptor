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

const rawCorsOrigin = process.env.CORS_ORIGIN || envFile.CORS_ORIGIN || '*';

/** null means "any origin"; otherwise an explicit allow-list. */
function parseAllowedOrigins(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') return null;

  const origins = trimmed
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return origins.length > 0 ? origins : null;
}

export const config = {
  port: Number(process.env.PORT || envFile.PORT || 3001),
  mongoUri: process.env.MONGO_URI || envFile.MONGO_URI || 'mongodb://localhost:27017/antigravity_db',
  // No default. A shipped fallback like 'admin123' is a published password, so
  // deletion is refused outright when this is unset rather than silently
  // accepting a value anyone can read in the source.
  deletePassword: process.env.DELETE_PASSWORD || envFile.DELETE_PASSWORD || '',
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS || envFile.POLLING_INTERVAL_MS || 3000),
  // How long a match may keep polling after its startTime before the scheduler
  // considers it over and stops. Also bounds how far back an imported match can
  // be and still auto-start. Raise it for formats that run longer than a day.
  maxPollHours: Number(process.env.MAX_POLL_HOURS || envFile.MAX_POLL_HOURS || 12),
  cors: {
    origin: rawCorsOrigin,
    /**
     * Origins permitted to call this API, or null for "allow any".
     *
     * CORS_ORIGIN was read but never applied — the server reflected whatever
     * Origin it was sent, with credentials enabled. Set it to your frontend
     * URL(s), comma separated, to close that.
     */
    allowedOrigins: parseAllowedOrigins(rawCorsOrigin),
  },
} as const;
