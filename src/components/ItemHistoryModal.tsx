
import { useState, useEffect } from 'react'
import { X, Calendar, Package, DollarSign, TrendingUp, Factory } from 'lucide-react'
import GlassCard from './GlassCard'
import { supabase, InventoryMove } from '../lib/supabase'
import Skeleton from './Skeleton'

interface ItemHistoryModalProps {
    item: { id: number | string, name: string, is_weighted?: boolean }
    onClose: () => void
}

export default function ItemHistoryModal({ item, onClose }: ItemHistoryModalProps) {
    const [history, setHistory] = useState<InventoryMove[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({ totalQty: 0, avgPrice: 0 })
    const [moveType, setMoveType] = useState<'purchase' | 'production'>('purchase')

    useEffect(() => {
        loadHistory()
    }, [item.id])

    async function loadHistory() {
        setLoading(true)
        try {
            // Fetch both 'purchase' and 'production' moves
            // We want to see how this item arrived in stock
            const { data, error } = await supabase
                .from('inventory_moves')
                .select('*')
                .eq('item_id', item.id)
                .in('type', ['purchase', 'production'])
                .order('created_at', { ascending: false })

            if (error) throw error

            const moves = data || []
            setHistory(moves)

            // Determine dominant type for UI labels
            const prodCount = moves.filter(m => m.type === 'production').length
            const purchCount = moves.filter(m => m.type === 'purchase').length
            setMoveType(prodCount > purchCount ? 'production' : 'purchase')

            // Calculate stats
            let totalQty = 0
            let totalCost = 0

            moves.forEach(m => {
                totalQty += m.quantity
                totalCost += m.quantity * (m.unit_price || 0)
            })

            const avgPrice = totalQty > 0 ? totalCost / totalQty : 0

            setStats({
                totalQty,
                avgPrice
            })

        } catch (err) {
            console.error('Error loading history:', err)
        } finally {
            setLoading(false)
        }
    }

    const isProduction = moveType === 'production'

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
            <GlassCard className="w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold">{item.name}</h2>
                        <p className="text-secondary text-sm">
                            {isProduction ? 'История производства' : 'История поставок'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-24 rounded-xl" />
                            <Skeleton className="h-24 rounded-xl" />
                        </div>
                        <Skeleton className="h-64 rounded-xl" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 flex-shrink-0">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                                <div className={isProduction
                                    ? "p-3 bg-action/20 rounded-lg text-action"
                                    : "p-3 bg-emerald-500/20 rounded-lg text-emerald-400"
                                }>
                                    {isProduction ? <Factory className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                </div>
                                <div>
                                    <div className="text-sm text-secondary">
                                        {isProduction ? 'Всего произведено' : 'Всего поставлено'}
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        {item.is_weighted
                                            ? (stats.totalQty / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 }) + ' кг'
                                            : stats.totalQty.toLocaleString('ru-RU') + ' шт'
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-sm text-secondary">
                                        {isProduction ? 'Средняя себестоимость' : 'Средняя цена закупки'}
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        {stats.avgPrice.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                                        <span className="text-sm font-normal text-secondary ml-1">
                                            / {item.is_weighted ? 'г' : 'шт'}
                                        </span>
                                    </div>
                                    {item.is_weighted && (
                                        <div className="text-xs text-secondary mt-1">
                                            ≈ {(stats.avgPrice * 1000).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽ / кг
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* History Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded-xl border border-white/5">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-[#0f0f11] z-10">
                                    <tr>
                                        <th className="p-4 text-sm font-medium text-secondary border-b border-white/10">Дата</th>
                                        <th className="p-4 text-sm font-medium text-secondary border-b border-white/10">Тип</th>
                                        <th className="p-4 text-sm font-medium text-secondary border-b border-white/10">Количество</th>
                                        <th className="p-4 text-sm font-medium text-secondary border-b border-white/10">Цена за ед.</th>
                                        <th className="p-4 text-sm font-medium text-secondary border-b border-white/10 text-right">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-secondary">Нет истории</td>
                                        </tr>
                                    ) : (
                                        history.map((move) => (
                                            <tr key={move.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-white text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-secondary" />
                                                        {new Date(move.created_at!).toLocaleDateString('ru-RU')}
                                                        <span className="text-xs text-secondary ml-1">
                                                            {new Date(move.created_at!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {move.type === 'production' ? (
                                                        <span className="text-action">Производство</span>
                                                    ) : (
                                                        <span className="text-emerald-400">Поставка</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-white font-medium">
                                                    {item.is_weighted
                                                        ? move.quantity + ' г'
                                                        : move.quantity + ' шт'
                                                    }
                                                </td>
                                                <td className="p-4 text-secondary">
                                                    {(move.unit_price || 0).toFixed(2)} ₽
                                                </td>
                                                <td className="p-4 text-right font-bold text-white">
                                                    {(move.quantity * (move.unit_price || 0)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    )
}
