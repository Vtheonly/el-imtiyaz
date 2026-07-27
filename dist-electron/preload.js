import { contextBridge, ipcRenderer } from "electron";
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
        getVersion: () => ipcRenderer.invoke("app:get-version"),
        getPath: (name) => ipcRenderer.invoke("app:get-path", name),
    },
    fs: {
        showSaveDialog: (opts) => ipcRenderer.invoke("fs:save-dialog", opts),
        writeBackup: (path, data) => ipcRenderer.invoke("fs:write-backup", path, data),
    },
    shell: {
        openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
        openPath: (path) => ipcRenderer.invoke("shell:open-path", path),
    },
};
contextBridge.exposeInMainWorld("elImtiyaz", api);
//# sourceMappingURL=preload.js.map