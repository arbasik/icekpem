
import { useState } from 'react'
import { X, Upload, Check, AlertTriangle, HelpCircle, MapPin, RefreshCw } from 'lucide-react'
import GlassCard from './GlassCard'
import { supabase } from '../lib/supabase'

interface ImportClientsModalProps {
    onClose: () => void
    onSuccess: () => void
}

interface ParsedClient {
    name: string
    address?: string
    contact?: string
    latitude?: number
    longitude?: number
    status: 'lead'
    type: 'client'
}

export default function ImportClientsModal({ onClose, onSuccess }: ImportClientsModalProps) {
    const [text, setText] = useState('')
    const [parsed, setParsed] = useState<ParsedClient[]>([])
    const [step, setStep] = useState<'input' | 'preview'>('input')
    const [loading, setLoading] = useState(false)
    const [processingCount, setProcessingCount] = useState(0)

    // Dadata API Token (from AddressAutocomplete)
    const DADATA_TOKEN = "d1ee8daa112be66db3b136ca85f92f98a9e8b179"

    function parseText() {
        const lines = text.split('\n').filter(l => l.trim())
        const results: ParsedClient[] = []

        lines.forEach(line => {
            // Try different delimiters
            let parts = line.split('\t')
            if (parts.length < 2) parts = line.split(';')

            let name, address, contact, lat, lon

            // Detect format: User's Excel (Link | Name | Address | Phone ...)
            // Link column usually starts with http
            if (parts[0]?.trim().startsWith('http')) {
                // User Format: Link | Name | Address | Phone
                name = parts[1]?.trim()
                address = parts[2]?.trim()
                // Phone is in column D (index 3)
                contact = parts[3]?.trim()
            } else {
                // Standard Format: Name | Address | Phone | Lat | Lon
                name = parts[0]?.trim()
                address = parts[1]?.trim()
                contact = parts[2]?.trim()
                lat = parseFloat(parts[3]?.replace(',', '.') || '0')
                lon = parseFloat(parts[4]?.replace(',', '.') || '0')
            }

            if (name) {
                results.push({
                    name,
                    address: address || undefined,
                    contact: contact || undefined,
                    latitude: lat || undefined,
                    longitude: lon || undefined,
                    status: 'lead',
                    type: 'client'
                })
            }
        })

        setParsed(results)
        setStep('preview')
    }

    async function geocodeMissing() {
        setLoading(true)
        setProcessingCount(0)

        // Deep copy because we will mutate items
        const newParsed = [...parsed]
        const itemsToProcess = newParsed.filter(p => !p.latitude && p.address)
        const total = itemsToProcess.length

        if (total === 0) {
            setLoading(false)
            return
        }

        let processed = 0

        for (const item of newParsed) {
            if (!item.latitude && item.address) {
                try {
                    const response = await fetch(
                        'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': `Token ${DADATA_TOKEN}`
                            },
                            body: JSON.stringify({
                                query: item.address,
                                count: 1,
                                locations: [{ region: "Иркутская" }] // Optional bias, but safe to omit or keep general
                            })
                        }
                    )

                    if (response.ok) {
                        const data = await response.json()
                        const sugg = data.suggestions?.[0]
                        if (sugg?.data?.geo_lat) {
                            item.latitude = parseFloat(sugg.data.geo_lat)
                            item.longitude = parseFloat(sugg.data.geo_lon)
                        }
                    }
                } catch (e) {
                    console.error('Geocoding error:', e)
                }

                processed++
                setProcessingCount(processed)
                // Small delay to be nice to the API
                await new Promise(r => setTimeout(r, 120))
            }
        }

        setParsed(newParsed)
        setLoading(false)
    }

    async function handleImport() {
        if (parsed.length === 0) return
        setLoading(true)

        try {
            const { error } = await supabase.from('locations').insert(parsed)
            if (error) throw error
            onSuccess()
            onClose()
        } catch (err: any) {
            alert('Ошибка импорта: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const missingCoordsCount = parsed.filter(p => !p.latitude).length

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] p-4">
            <GlassCard className="w-full max-w-4xl h-[85vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Upload className="w-5 h-5 text-primary" />
                            Импорт клиентов
                        </h2>
                        <p className="text-secondary text-sm">
                            {step === 'input'
                                ? 'Вставьте данные из Excel'
                                : 'Проверьте данные перед импортом'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {step === 'input' ? (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4 text-sm text-blue-200">
                            <div className="flex items-start gap-3">
                                <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">Как подготовить данные?</p>
                                    <p className="mb-2">Выделите таблицу в Excel (вместе с заголовками или без) и скопируйте сюда.</p>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <p className="font-medium text-white/80 mb-1">Вариант 1 (Ваша таблица):</p>
                                            <code className="bg-black/30 px-2 py-1 rounded text-xs block text-white/60">
                                                Ссылка 2GIS | Название | Адрес | Телефон...
                                            </code>
                                        </div>
                                        <div>
                                            <p className="font-medium text-white/80 mb-1">Вариант 2 (Стандарт):</p>
                                            <code className="bg-black/30 px-2 py-1 rounded text-xs block text-white/60">
                                                Название | Адрес | Телефон | Широта | Долгота
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <textarea
                            className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-primary resize-none mb-4"
                            placeholder="Вставьте данные здесь..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />

                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <button
                                onClick={parseText}
                                disabled={!text.trim()}
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Предпросмотр
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-4 bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="text-sm">
                                    Найдено: <span className="font-bold text-white">{parsed.length}</span>
                                </div>
                                {missingCoordsCount > 0 && (
                                    <div className="text-sm text-yellow-400 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Без координат: <b>{missingCoordsCount}</b>
                                    </div>
                                )}
                            </div>

                            {missingCoordsCount > 0 && !loading && (
                                <button
                                    onClick={geocodeMissing}
                                    className="px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                    <MapPin className="w-4 h-4" />
                                    Найти координаты адресов
                                </button>
                            )}

                            {loading && processingCount > 0 && (
                                <div className="flex items-center gap-2 text-sm text-blue-400 font-medium">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Обработано {processingCount} из {missingCoordsCount}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar border border-white/10 rounded-xl bg-white/5">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="sticky top-0 bg-[#0f0f11] shadow-xl">
                                    <tr>
                                        <th className="p-3 border-b border-white/10 font-medium text-secondary">Название</th>
                                        <th className="p-3 border-b border-white/10 font-medium text-secondary">Адрес</th>
                                        <th className="p-3 border-b border-white/10 font-medium text-secondary">Телефон</th>
                                        <th className="p-3 border-b border-white/10 font-medium text-secondary">Координаты</th>
                                        <th className="p-3 border-b border-white/10 font-medium text-secondary">Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsed.map((item, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-3 text-white font-medium">{item.name}</td>
                                            <td className="p-3 text-white/80 max-w-[250px] truncate" title={item.address}>{item.address || '—'}</td>
                                            <td className="p-3 text-white/80">{item.contact || '—'}</td>
                                            <td className="p-3 text-white/60 text-xs">
                                                {item.latitude && item.longitude
                                                    ? <span className="text-green-400">{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                                                    : <span className="text-yellow-500/80 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Нет</span>
                                                }
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                                    ЛИД
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10 mt-4 gap-3">
                            <button
                                onClick={() => setStep('input')}
                                disabled={loading}
                                className="px-4 py-2 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                Назад
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={loading || parsed.length === 0}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Обработка...' : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Импортировать {parsed.length}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    )
}
