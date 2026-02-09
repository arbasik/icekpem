"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose safe APIs to renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Version
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    // Updates
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    // Event listeners
    onUpdateAvailable: (callback) => {
        electron_1.ipcRenderer.on('update-available', (_event, info) => callback(info));
    },
    onUpdateProgress: (callback) => {
        electron_1.ipcRenderer.on('update-progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback) => {
        electron_1.ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
    },
    onUpdateError: (callback) => {
        electron_1.ipcRenderer.on('update-error', (_event, error) => callback(error));
    },
    // Cleanup
    removeAllListeners: () => {
        electron_1.ipcRenderer.removeAllListeners('update-available');
        electron_1.ipcRenderer.removeAllListeners('update-progress');
        electron_1.ipcRenderer.removeAllListeners('update-downloaded');
        electron_1.ipcRenderer.removeAllListeners('update-error');
    }
});
//# sourceMappingURL=preload.js.map