import { useState, useEffect } from 'react'
import { History as HistoryIcon, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Package } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { supabase, InventoryMove } from '../lib/supabase'
import clsx from 'clsx'

interface MoveWithDetails extends InventoryMove {
    item_name: string
    from_location_name?: string
    from_location_type?: string
    to_location_name?: string
    is_weighted?: boolean
    batch_id?: string
    payment_status?: string
}

const moveTypeLabels = {
    purchase: 'Приход',
    sale: 'Продажа',
    transfer: 'Перемещение',
    production: 'Производство'
}

const moveTypeColors = {
    purchase: 'text-emerald-400',
    sale: 'text-red-400',
    transfer: 'text-blue-400',
    production: 'text-purple-400'
}

const moveTypeIcons = {
    purchase: ArrowDownLeft,
    sale: ArrowUpRight,
    transfer: ArrowRightLeft,
    production: Package
}

export default function InventoryHistory() {
    // Ported Grouping Logic
    type GroupedMove =
        | { type: 'simple', move: MoveWithDetails }
        | { type: 'production_group', output: MoveWithDetails, inputs: MoveWithDetails[] }

    const [groupedMoves, setGroupedMoves] = useState<GroupedMove[]>([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>('all')

    useEffect(() => {
        loadMoves()
    }, [])

    async function loadMoves() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('inventory_moves')
                .select(`
                    *,
                    items!inventory_moves_item_id_fkey(name, is_weighted),
                    from_location:locations!inventory_moves_from_location_id_fkey(name, type),
                    to_location:locations!inventory_moves_to_location_id_fkey(name)
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            const formatted: MoveWithDetails[] = (data || []).map((move: any) => ({
                id: move.id,
                item_id: move.item_id,
                item_name: move.items?.name || 'Неизвестно',
                is_weighted: move.items?.is_weighted,
                from_location_id: move.from_location_id,
                from_location_name: move.from_location?.name,
                from_location_type: move.from_location?.type,
                to_location_id: move.to_location_id,
                to_location_name: move.to_location?.name,
                quantity: move.quantity,
                type: move.type,
                unit_price: move.unit_price,
                created_at: move.created_at,
                payment_status: move.payment_status,
                batch_id: move.batch_id
            }))

            const grouped = groupMoves(formatted)
            setGroupedMoves(grouped)
        } catch (err) {
            console.error('Ошибка загрузки истории:', err)
        } finally {
            setLoading(false)
        }
    }

    function groupMoves(moves: MoveWithDetails[]): GroupedMove[] {
        const result: GroupedMove[] = []
        let skipIds = new Set<number>()

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i]
            if (move.id && skipIds.has(move.id)) continue

            // Filter out Sale payments (same logic as Warehouse.tsx)
            if (move.type === 'sale' && move.from_location_type === 'client') {
                continue
            }

            if (move.type === 'production' && move.quantity > 0) {
                let inputs: MoveWithDetails[] = []
                if (move.batch_id) {
                    inputs = moves.filter(m =>
                        m.type === 'production' &&
                        m.quantity < 0 &&
                        m.batch_id === move.batch_id &&
                        !skipIds.has(m.id!)
                    )
                } else {
                    const moveTime = new Date(move.created_at || Date.now()).getTime()
                    inputs = moves.filter(m =>
                        m.type === 'production' &&
                        m.quantity < 0 &&
                        !m.batch_id &&
                        !skipIds.has(m.id!) &&
                        Math.abs(new Date(m.created_at!).getTime() - moveTime) < 30000
                    )
                }
                inputs.forEach(c => skipIds.add(c.id!))
                result.push({ type: 'production_group', output: move, inputs })
            }
            else if (move.type === 'production' && move.quantity < 0) {
                result.push({ type: 'simple', move })
            }
            else {
                result.push({ type: 'simple', move })
            }
        }
        return result
    }

    const filteredMoves = filterType === 'all'
        ? groupedMoves
        : groupedMoves.filter(g => {
            if (g.type === 'simple') return g.move.type === filterType
            if (g.type === 'production_group') return 'production' === filterType
            return true
        })

    function formatDate(dateString?: string) {
        if (!dateString) return 'Неизвестно'
        const date = new Date(dateString)
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    function formatQuantity(quantity: number, isWeighted?: boolean) {
        if (isWeighted) {
            return `${quantity.toFixed(0)} г`
        }
        return `${quantity} шт`
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <HistoryIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">История движения</h1>
                        <p className="text-secondary">Все операции с товарами</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterType('all')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'all'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Все
                </button>
                <button
                    onClick={() => setFilterType('purchase')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'purchase'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Приход
                </button>
                <button
                    onClick={() => setFilterType('sale')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'sale'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Продажа
                </button>
                <button
                    onClick={() => setFilterType('transfer')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'transfer'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Перемещение
                </button>
                <button
                    onClick={() => setFilterType('production')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'production'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Производство
                </button>
            </div>

            {/* Table */}
            <GlassCard>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="py-12 text-center text-secondary">
                            Загрузка...
                        </div>
                    ) : filteredMoves.length === 0 ? (
                        <div className="py-12 text-center text-secondary">
                            История пуста
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-secondary font-medium">Дата</th>
                                    <th className="text-left py-3 px-4 text-secondary font-medium">Тип</th>
                                    <th className="text-left py-3 px-4 text-secondary font-medium">Товар</th>
                                    <th className="text-left py-3 px-4 text-secondary font-medium">Откуда</th>
                                    <th className="text-left py-3 px-4 text-secondary font-medium">Куда</th>
                                    <th className="text-right py-3 px-4 text-secondary font-medium">Количество</th>
                                    <th className="text-right py-3 px-4 text-secondary font-medium">Цена за ед.</th>
                                    <th className="text-right py-3 px-4 text-secondary font-medium">Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMoves.map((group, idx) => {
                                    const move = group.type === 'simple' ? group.move : group.output
                                    const inputs = group.type === 'production_group' ? group.inputs : []
                                    const Icon = moveTypeIcons[move.type]
                                    const totalCost = (move.unit_price || 0) * move.quantity

                                    // Display Logic
                                    let displayType = moveTypeLabels[move.type]
                                    let statusText = ''
                                    let statusColor = ''
                                    let typeColor = 'text-secondary'

                                    if (move.type === 'purchase') {
                                        typeColor = 'text-emerald-400'
                                    } else if (move.type === 'production') {
                                        typeColor = 'text-purple-400'
                                        // No count in label
                                    } else if (move.type === 'sale') {
                                        displayType = 'Продажа'
                                        statusText = 'Оплачено'
                                        statusColor = 'text-emerald-400'
                                        typeColor = 'text-red-400'
                                    } else if (move.type === 'transfer') {
                                        displayType = 'Реализация'
                                        typeColor = 'text-blue-400'
                                        if (move.payment_status === 'paid') {
                                            statusText = 'Оплачено'
                                            statusColor = 'text-emerald-400'
                                        } else {
                                            // Implied "On Realization"
                                            statusText = ''
                                            statusColor = 'text-yellow-400'
                                        }
                                    }

                                    return (
                                        <tr key={move.id || idx} className="border-b border-white/5 hover:bg-white/5 transition-smooth">
                                            <td className="py-3 px-4 text-sm text-secondary">
                                                {formatDate(move.created_at)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={clsx('w-4 h-4', typeColor)} />
                                                        <span className={clsx('text-sm font-medium', typeColor)}>
                                                            {displayType}
                                                        </span>
                                                    </div>
                                                    {statusText && (
                                                        <span className={clsx("text-xs mt-0.5 font-medium ml-6", statusColor)}>
                                                            {statusText}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                <div>{move.item_name}</div>
                                                {group.type === 'production_group' && inputs.length > 0 && (
                                                    <div className="mt-1 text-xs text-secondary/70">
                                                        <span className="opacity-50">Из: </span>
                                                        {inputs.map((i, idx) => (
                                                            <span key={i.id}>
                                                                {i.item_name} ({formatQuantity(Math.abs(i.quantity), i.is_weighted)})
                                                                {idx < inputs.length - 1 ? ', ' : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-secondary">
                                                {move.from_location_name || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-secondary">
                                                {move.to_location_name || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium">
                                                {formatQuantity(move.quantity, move.is_weighted)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-sm">
                                                {move.unit_price
                                                    ? `${move.unit_price.toFixed(2)} ₽/${move.is_weighted ? 'г' : 'шт'}`
                                                    : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium text-primary">
                                                {move.unit_price
                                                    ? `${totalCost.toFixed(2)} ₽`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </GlassCard>
        </div>
    )
}
