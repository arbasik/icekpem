import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as path from 'path'

// Disable GPU acceleration in WSL/older systems
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

// Auto-updater logging
autoUpdater.logger = console
autoUpdater.autoDownload = false // Don't auto-download, let user decide

function createWindow() {
    mainWindow = new BrowserWindow({
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
    })

    // Show window when ready to avoid visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        // Dev mode: load from Vite dev server
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        // Production: load built files
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // Check for updates after window loads (production only)
    if (process.env.NODE_ENV !== 'development') {
        mainWindow.webContents.once('did-finish-load', () => {
            autoUpdater.checkForUpdates()
        })
    }
}

// App lifecycle
app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// ============ Auto-Updater Events ============

autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...')
})

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    mainWindow?.webContents.send('update-available', info)
})

autoUpdater.on('update-not-available', () => {
    console.log('App is up to date')
})

autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress)
})

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    mainWindow?.webContents.send('update-downloaded', info)
})

autoUpdater.on('error', (err) => {
    console.error('Updater error:', err)
    mainWindow?.webContents.send('update-error', err.message)
})

// ============ IPC Handlers ============

ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates()
        return result?.updateInfo
    } catch (err) {
        console.error('Update check failed:', err)
        return null
    }
})

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate()
        return true
    } catch (err) {
        console.error('Download failed:', err)
        return false
    }
})

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
})

ipcMain.handle('get-app-version', () => {
    return app.getVersion()
})
