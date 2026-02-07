import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'

const THEMES = [
    { name: 'Киберпанк (Голубой)', color: '34 211 238', hex: '#22d3ee' },
    { name: 'Неон (Оранжевый)', color: '249 115 22', hex: '#f97316' },
    { name: 'Природа (Зеленый)', color: '16 185 129', hex: '#10b981' },
    { name: 'Фиолетовый', color: '139 92 246', hex: '#8b5cf6' },
    { name: 'Розовый', color: '236 72 153', hex: '#ec4899' },
    { name: 'Красный', color: '239 68 68', hex: '#ef4444' },
]

import { useNavigate } from 'react-router-dom'
// ... (imports)

export default function Settings() {
    const navigate = useNavigate()
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme-color') || '34 211 238')

    function handleThemeChange(color: string) {
        setCurrentTheme(color)
        document.documentElement.style.setProperty('--color-primary', color)
        localStorage.setItem('theme-color', color)
    }

    async function handleSyncInventory() {
        try {
            // 1. Get Main Warehouse
            const { data: locs } = await supabase.from('locations').select('id').eq('type', 'warehouse').limit(1)
            if (!locs || locs.length === 0) {
                alert('Нет склада!')
                return
            }
            const warehouseId = locs[0].id

            // 2. Fetch all moves
            const { data: moves } = await supabase.from('inventory_moves').select('*')
            if (!moves) return

            // 3. Calculate expected inventory
            const inventoryMap: Record<string, number> = {}
            let movesProcessed = 0

            moves.forEach(m => {
                if (m.to_location_id === warehouseId) {
                    inventoryMap[m.item_id] = (inventoryMap[m.item_id] || 0) + m.quantity
                    movesProcessed++
                }
                if (m.from_location_id === warehouseId) {
                    inventoryMap[m.item_id] = (inventoryMap[m.item_id] || 0) - m.quantity
                    movesProcessed++
                }
            })

            const itemsCount = Object.keys(inventoryMap).length
            if (!confirm(`Найдено ${moves.length} операций. Будет пересчитано ${itemsCount} товаров. Текущие данные склада будут ЗАМЕНЕНЫ. Продолжить?`)) return

            // 4. Update DB
            // First, clear current inventory for this warehouse
            await supabase.from('inventory').delete().eq('location_id', warehouseId)

            // Insert new values
            const updates = Object.entries(inventoryMap)
                .filter(([_, qty]) => qty > 0) // Only positive stock
                .map(([itemId, qty]) => ({
                    item_id: itemId,
                    location_id: warehouseId,
                    quantity: qty
                }))

            if (updates.length > 0) {
                const { error } = await supabase.from('inventory').insert(updates)
                if (error) throw error
            }

            alert(`Синхронизация успешно завершена! Обновлено ${updates.length} позиций.`)
        } catch (err: any) {
            alert('Ошибка синхронизации: ' + err.message)
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-8">Настройки</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/20 rounded-xl text-primary">
                            <Palette className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">Оформление</h2>
                    </div>

                    <div className="space-y-4">
                        <p className="text-secondary text-sm">Выберите основной цвет интерфейса</p>

                        <div className="grid grid-cols-3 gap-3">
                            {THEMES.map((theme) => (
                                <button
                                    key={theme.hex}
                                    onClick={() => handleThemeChange(theme.color)}
                                    className={clsx(
                                        "h-12 rounded-lg flex items-center justify-center transition-all relative overflow-hidden group",
                                        "border border-white/10 hover:border-white/30"
                                    )}
                                    style={{ background: `rgba(${theme.color.split(' ').join(',')}, 0.1)` }}
                                >
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ background: theme.hex }}
                                    />
                                    {currentTheme === theme.color && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                            <Check className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-rose-500/20 rounded-xl text-rose-500">
                            <Check className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold">Обслуживание</h2>
                    </div>
                    <div className="space-y-4">
                        <p className="text-secondary text-sm">Исправление проблем с данными</p>
                        <button
                            onClick={handleSyncInventory}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-left px-4 mb-2"
                        >
                            Синхронизировать склад
                        </button>

                        <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                            <p className="text-orange-400 text-xs mb-2">Инструменты разработчика</p>
                            <button
                                onClick={() => navigate('/diagnostics')}
                                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-bold transition-colors"
                            >
                                Открыть Диагностику
                            </button>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}
