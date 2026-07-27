"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Preload bridge — exposes a minimal, typed surface to the renderer.
 *
 * Security posture:
 *  - contextIsolation: true (renderer cannot touch Node directly)
 *  - nodeIntegration: false
 *  - Only explicit allow-listed channels pass through.
 */
const api = {
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke("app:get-version"),
        getPath: (name) => electron_1.ipcRenderer.invoke("app:get-path", name),
    },
    fs: {
        showSaveDialog: (opts) => electron_1.ipcRenderer.invoke("fs:save-dialog", opts),
        writeBackup: (path, data) => electron_1.ipcRenderer.invoke("fs:write-backup", path, data),
    },
    shell: {
        openExternal: (url) => electron_1.ipcRenderer.invoke("shell:open-external", url),
        openPath: (path) => electron_1.ipcRenderer.invoke("shell:open-path", path),
    },
};
electron_1.contextBridge.exposeInMainWorld("elImtiyaz", api);
//# sourceMappingURL=preload.js.map