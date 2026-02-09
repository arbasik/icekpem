"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const path = __importStar(require("path"));
// Disable GPU acceleration in WSL/older systems
electron_1.app.disableHardwareAcceleration();
let mainWindow = null;
// Auto-updater logging
electron_updater_1.autoUpdater.logger = console;
electron_updater_1.autoUpdater.autoDownload = false; // Don't auto-download, let user decide
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: path.join(__dirname, '../public/ice-icon.png'),
        title: 'Ice ERP',
        backgroundColor: '#0a0f1a',
        show: false // Don't show until ready
    });
    // Show window when ready to avoid visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    // Load the app
    if (process.env.NODE_ENV === 'development') {
        // Dev mode: load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        // Production: load built files
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Check for updates after window loads (production only)
    if (process.env.NODE_ENV !== 'development') {
        mainWindow.webContents.once('did-finish-load', () => {
            electron_updater_1.autoUpdater.checkForUpdates();
        });
    }
}
// App lifecycle
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// ============ Auto-Updater Events ============
electron_updater_1.autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
});
electron_updater_1.autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    mainWindow?.webContents.send('update-available', info);
});
electron_updater_1.autoUpdater.on('update-not-available', () => {
    console.log('App is up to date');
});
electron_updater_1.autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress);
});
electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    mainWindow?.webContents.send('update-downloaded', info);
});
electron_updater_1.autoUpdater.on('error', (err) => {
    console.error('Updater error:', err);
    mainWindow?.webContents.send('update-error', err.message);
});
// ============ IPC Handlers ============
electron_1.ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await electron_updater_1.autoUpdater.checkForUpdates();
        return result?.updateInfo;
    }
    catch (err) {
        console.error('Update check failed:', err);
        return null;
    }
});
electron_1.ipcMain.handle('download-update', async () => {
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
        return true;
    }
    catch (err) {
        console.error('Download failed:', err);
        return false;
    }
});
electron_1.ipcMain.handle('install-update', () => {
    electron_updater_1.autoUpdater.quitAndInstall();
});
electron_1.ipcMain.handle('get-app-version', () => {
    return electron_1.app.getVersion();
});
//# sourceMappingURL=main.js.map