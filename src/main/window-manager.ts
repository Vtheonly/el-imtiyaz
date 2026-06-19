/**
 * WindowManager — owns the lifecycle of all BrowserWindow instances.
 *
 * Design goals:
 *  - One primary window, but extensible to multi-window layouts.
 *  - Loads the renderer from Vite dev server in dev mode, bundled file in prod.
 *  - Enforces security defaults (no nodeIntegration, contextBridge only).
 */

import {
  BrowserWindow,
  shell,
  BrowserWindowConstructorOptions,
} from "electron";
import { logger } from "../infrastructure/logger/logger";
import { AppPaths } from "./system/app-paths";

const isDev =
  process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  /** Creates and configures the primary application window. */
  async createMainWindow(): Promise<BrowserWindow> {
    const preloadPath = AppPaths.resolve().preloadScript;

    const options: BrowserWindowConstructorOptions = {
      width: 1600,
      height: 1300,
      minWidth: 1024,
      minHeight: 680,
      show: false,
      backgroundColor: "#242526",
      title: "El-Imtiyaz School System",
      autoHideMenuBar: false, // Ensure native window menu bar is visible to trigger devTools
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
        devTools: true, // FORCE ENABLE DEVTOOLS IN ALL ENVIRONMENTS FOR TESTING
      },
    };

    this.mainWindow = new BrowserWindow(options);

    // Open external links in the OS default browser, never inside the app.
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    // Force Open Developer Tools immediately upon creation
    this.mainWindow.webContents.once("did-frame-finish-load", () => {
      this.mainWindow?.webContents.openDevTools({ mode: "detach" });
    });

    // Register global shortcut listeners directly on this window for inspect keys
    this.mainWindow.webContents.on("before-input-event", (event, input) => {
      // Toggle DevTools on F12 or CmdOrCtrl+Shift+I
      if (
        input.key === "F12" ||
        (input.control && input.shift && input.key.toLowerCase() === "i") ||
        (input.meta && input.shift && input.key.toLowerCase() === "i")
      ) {
        if (this.mainWindow?.webContents.isDevToolsOpened()) {
          this.mainWindow.webContents.closeDevTools();
        } else {
          this.mainWindow?.webContents.openDevTools({ mode: "detach" });
        }
        event.preventDefault();
      }
    });

    // Show only once the renderer is ready (prevents white flash).
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
      logger.info("window.main.shown");
    });

    // Track window close for cleanup.
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
      logger.info("window.main.closed");
    });

    // Load the renderer.
    if (isDev) {
      await this.mainWindow.loadURL(DEV_SERVER_URL);
    } else {
      await this.mainWindow.loadFile(AppPaths.resolve().rendererIndex);
    }

    return this.mainWindow;
  }

  /** Returns the active main window (may be null during shutdown). */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /** Sends a message to the renderer on a given channel. */
  sendToRenderer(channel: string, payload: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.webContents.send(channel, payload);
  }
}
