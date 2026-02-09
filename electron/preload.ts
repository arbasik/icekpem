import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Version
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // Event listeners
    onUpdateAvailable: (callback: (info: any) => void) => {
        ipcRenderer.on('update-available', (_event, info) => callback(info))
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
        ipcRenderer.on('update-progress', (_event, progress) => callback(progress))
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
        ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
    },
    onUpdateError: (callback: (error: string) => void) => {
        ipcRenderer.on('update-error', (_event, error) => callback(error))
    },

    // Cleanup
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('update-available')
        ipcRenderer.removeAllListeners('update-progress')
        ipcRenderer.removeAllListeners('update-downloaded')
        ipcRenderer.removeAllListeners('update-error')
    }
})

// Declare types for TypeScript
declare global {
    interface Window {
        electronAPI: {
            getAppVersion: () => Promise<string>
            checkForUpdates: () => Promise<any>
            downloadUpdate: () => Promise<boolean>
            installUpdate: () => void
            onUpdateAvailable: (callback: (info: any) => void) => void
            onUpdateProgress: (callback: (progress: any) => void) => void
            onUpdateDownloaded: (callback: (info: any) => void) => void
            onUpdateError: (callback: (error: string) => void) => void
            removeAllListeners: () => void
        }
    }
}
