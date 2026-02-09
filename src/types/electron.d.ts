// Global type declarations for Electron API
// This file extends the Window interface to include electronAPI

export { }

declare global {
    interface Window {
        electronAPI?: {
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
