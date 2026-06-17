/**
 * AppPaths — resolves and caches all filesystem paths used by the app.
 *
 * Centralising path logic avoids the common Electron anti-pattern of
 * calling `app.getPath('userData')` from renderer-adjacent code. Every
 * consumer goes through here, so changing storage strategy is a one-file
 * change.
 */

import { app } from 'electron';
import path from 'node:path';

export class AppPaths {
  private constructor(
    public readonly userData: string,
    public readonly logs: string,
    public readonly databaseFile: string,
    public readonly uploads: string,
    public readonly exports: string,
    public readonly receipts: string,
    public readonly preloadScript: string,
    public readonly rendererIndex: string
  ) {}

  static resolve(): AppPaths {
    const userData = app.getPath('userData');
    const logs = path.join(userData, 'logs');
    const databaseFile = path.join(userData, 'el-imtiyaz.db');
    const uploads = path.join(userData, 'uploads');
    const exports = path.join(userData, 'exports');
    const receipts = path.join(userData, 'receipts');

    // The compiled preload script lives next to the main bundle.
    const preloadScript = app.isPackaged
      ? path.join(process.resourcesPath, 'dist-preload', 'preload', 'index.js')
      : path.join(__dirname, '..', '..', '..', 'dist-preload', 'preload', 'index.js');

    // The bundled renderer (Vite output).
    const rendererIndex = app.isPackaged
      ? path.join(process.resourcesPath, 'dist', 'renderer', 'index.html')
      : path.join(__dirname, '..', '..', '..', 'dist', 'renderer', 'index.html');

    return new AppPaths(
      userData,
      logs,
      databaseFile,
      uploads,
      exports,
      receipts,
      preloadScript,
      rendererIndex
    );
  }
}
