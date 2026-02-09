import { useState, useEffect } from 'react'
import { Download, RefreshCw, CheckCircle, X } from 'lucide-react'

interface UpdateInfo {
    version: string
    releaseNotes?: string
}

interface DownloadProgress {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
}

export function UpdateNotification() {
    const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [updateReady, setUpdateReady] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Only run in Electron environment
        if (!window.electronAPI) return

        // Listen for update events
        window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
            setUpdateAvailable(info)
            setDismissed(false)
        })

        window.electronAPI.onUpdateProgress((progress: DownloadProgress) => {
            setDownloadProgress(Math.round(progress.percent))
        })

        window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
            setUpdateReady(true)
            setDownloading(false)
            setUpdateAvailable(info)
        })

        window.electronAPI.onUpdateError((err: string) => {
            setError(err)
            setDownloading(false)
        })

        return () => {
            window.electronAPI?.removeAllListeners()
        }
    }, [])

    const handleDownload = async () => {
        setDownloading(true)
        setError(null)
        setDownloadProgress(0)
        await window.electronAPI?.downloadUpdate()
    }

    const handleInstall = () => {
        window.electronAPI?.installUpdate()
    }

    // Don't show if dismissed, no update, or not in Electron
    if (dismissed || !updateAvailable || !window.electronAPI) return null

    return (
        <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
            <div className="bg-gradient-to-r from-primary/90 to-primary backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-4 max-w-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {updateReady ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <Download className="w-5 h-5 text-white animate-bounce" />
                        )}
                        <h3 className="font-bold text-white">
                            {updateReady ? 'Готово к установке!' : 'Доступно обновление'}
                        </h3>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-white/60" />
                    </button>
                </div>

                {/* Version info */}
                <p className="text-sm text-white/80 mb-3">
                    Версия <span className="font-mono font-bold">{updateAvailable.version}</span>
                </p>

                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-300 bg-red-500/20 rounded-lg p-2 mb-3">
                        {error}
                    </p>
                )}

                {/* Progress bar */}
                {downloading && (
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                            <span>Загрузка...</span>
                            <span>{downloadProgress}%</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-300"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                    {updateReady ? (
                        <button
                            onClick={handleInstall}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Установить и перезапустить
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleDownload}
                                disabled={downloading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
                            >
                                {downloading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Загрузка...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Обновить
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setDismissed(true)}
                                className="px-4 py-2 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
                            >
                                Позже
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
