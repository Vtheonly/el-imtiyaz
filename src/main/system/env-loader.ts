import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../infrastructure/logger/logger';

/**
 * Loads environment variables from the root .env file into process.env.
 * Since the Electron main process runs outside Vite's bundling, we parse
 * .env manually at boot.
 */
export function loadEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      logger.warn('env.loader.missing', { path: envPath });
      return;
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    let loadedCount = 0;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const index = trimmed.indexOf('=');
      if (index === -1) continue;

      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();

      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }

      // Only set if not already set by system environment
      if (process.env[key] === undefined) {
        process.env[key] = val;
        loadedCount++;
      }
    }

    logger.info('env.loader.success', { path: envPath, loadedCount });
  } catch (err) {
    logger.error('env.loader.failed', { error: (err as Error).message });
  }
}
