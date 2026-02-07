import { useState, useEffect } from 'react'
import { Factory, TrendingUp, DollarSign, Package } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { supabase, InventoryMove } from '../lib/supabase'
import clsx from 'clsx'
import Skeleton from '../components/Skeleton'

export default function Production() {
    // Stats Interface
    interface ProductionStats {
        producedToday: number
        productionValue: number
        rawMaterialCost: number
        topProduct: { name: string, quantity: number, unit: string } | null
    }

    const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')
    const [stats, setStats] = useState<ProductionStats>({
        producedToday: 0,
        productionValue: 0,
        rawMaterialCost: 0,
        topProduct: null
    })
    const [statsLoading, setStatsLoading] = useState(true)

    // History State
    interface ProductionHistoryItem extends InventoryMove {
        items: { name: string, is_weighted: boolean } | null
        locations: { name: string } | null
        sale_price?: number
        unit_price?: number
    }
    const [historyMoves, setHistoryMoves] = useState<ProductionHistoryItem[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    useEffect(() => {
        loadStats()
        if (activeTab === 'history') {
            loadProductionHistory()
        }
    }, [activeTab])

    async function loadStats() {
        setStatsLoading(true)
        try {
            const today = new Date().toISOString().split('T')[0]

            // 1. Fetch Today's Production Outputs (positive quantity, type='production')
            const { data: moves } = await supabase
                .from('inventory_moves')
                .select(`
                    quantity,
                    unit_price,
                    item_id,
                    items(name, sale_price, is_weighted)
                `)
                .eq('type', 'production')
                .gt('quantity', 0) // Only outputs
                .gte('created_at', today)

            if (!moves) {
                setStatsLoading(false)
                return
            }

            // 2. Calculate Metrics
            let count = 0
            let rawCost = 0
            let prodValue = 0
            const productCounts: { [key: string]: { name: string, qty: number, isWeighted: boolean } } = {}

            moves.forEach(m => {
                count += 1
                const qty = m.quantity
                const cost = m.unit_price || 0
                const salePrice = (m.items as any)?.sale_price || cost

                rawCost += qty * cost
                prodValue += qty * salePrice

                const itemId = m.item_id
                if (!productCounts[itemId]) {
                    productCounts[itemId] = {
                        name: (m.items as any)?.name || 'Unknown',
                        qty: 0,
                        isWeighted: (m.items as any)?.is_weighted || false
                    }
                }
                productCounts[itemId].qty += qty
            })

            let topProd = null
            let maxQty = -1
            Object.values(productCounts).forEach(p => {
                if (p.qty > maxQty) {
                    maxQty = p.qty
                    topProd = {
                        name: p.name,
                        quantity: p.qty,
                        unit: p.isWeighted ? 'г' : 'шт'
                    }
                }
            })

            // Synthetic delay for smooth skeleton effect
            await new Promise(r => setTimeout(r, 600))

            setStats({
                producedToday: count,
                productionValue: prodValue,
                rawMaterialCost: rawCost,
                topProduct: topProd
            })

        } catch (err) {
            console.error('Error loading stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }

    async function loadProductionHistory() {
        setHistoryLoading(true)
        const { data, error } = await supabase
            .from('inventory_moves')
            .select(`
                id,
                created_at,
                quantity,
                type,
                item_id,
                items(name, is_weighted),
                to_location_id,
                locations:to_location_id(name)
            `)
            .eq('type', 'production')
            .order('created_at', { ascending: false })
            .limit(50)

        // Synthetic delay
        await new Promise(r => setTimeout(r, 600))

        if (error) {
            console.error('Ошибка загрузки истории:', error)
        } else {
            setHistoryMoves((data as any) || [])
        }
        setHistoryLoading(false)
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-action/20 rounded-xl flex items-center justify-center">
                        <Factory className="w-6 h-6 text-action" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Производство</h1>
                        <p className="text-secondary">Обзор</p>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex space-x-4 border-b border-white/10 pb-1">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={clsx(
                        'px-4 py-2 font-medium transition-colors relative',
                        activeTab === 'dashboard' ? 'text-primary' : 'text-secondary hover:text-white'
                    )}
                >
                    Обзор
                    {activeTab === 'dashboard' && <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgb(var(--color-primary))]" />}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={clsx(
                        'px-4 py-2 font-medium transition-colors relative',
                        activeTab === 'history' ? 'text-primary' : 'text-secondary hover:text-white'
                    )}
                >
                    История
                    {activeTab === 'history' && <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgb(var(--color-primary))]" />}
                </button>
            </div>

            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animation-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statsLoading ? (
                            <>
                                <Skeleton variant="card" className="h-[160px]" />
                                <Skeleton variant="card" className="h-[160px]" />
                                <Skeleton variant="card" className="h-[160px]" />
                                <Skeleton variant="card" className="h-[160px]" />
                            </>
                        ) : (
                            <>
                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Package className="w-16 h-16 text-primary" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Произведено сегодня</p>
                                    <h3 className="text-3xl font-bold text-white">{stats.producedToday} <span className="text-lg text-secondary/50 font-normal">партий</span></h3>
                                    <div className="mt-2 text-xs text-secondary/70">Записей в журнале</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <DollarSign className="w-16 h-16 text-emerald-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Ценность продукции</p>
                                    <h3 className="text-3xl font-bold text-emerald-400">{stats.productionValue.toLocaleString()} ₽</h3>
                                    <div className="mt-2 text-xs text-secondary/70">В розничных ценах</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <TrendingUp className="w-16 h-16 text-yellow-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Затраты на сырьё</p>
                                    <h3 className="text-3xl font-bold text-yellow-400">{stats.rawMaterialCost.toLocaleString()} ₽</h3>
                                    <div className="mt-2 text-xs text-secondary/70">Себестоимость</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Factory className="w-16 h-16 text-blue-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Лидер производства</p>
                                    <h3 className="text-xl font-bold text-blue-400 truncate" title={stats.topProduct?.name}>
                                        {stats.topProduct?.name || 'Нет данных'}
                                    </h3>
                                    <div className="mt-2 text-xs text-secondary/70">
                                        {stats.topProduct ? `${stats.topProduct.quantity.toLocaleString()} ${stats.topProduct.unit}` : '—'}
                                    </div>
                                </GlassCard>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
                <div className="space-y-6 animation-fade-in">
                    <GlassCard className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-secondary">Дата</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-secondary">Продукт</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-secondary">Количество</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-secondary">Склад</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {historyLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}>
                                                <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                                                <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                                            </tr>
                                        ))
                                    ) : historyMoves.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-secondary">История пуста</td>
                                        </tr>
                                    ) : (
                                        historyMoves.map((move) => (
                                            <tr key={move.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 text-white">
                                                    {new Date(move.created_at!).toLocaleString('ru-RU')}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-white">
                                                    {move.items?.name || 'Неизвестно'}
                                                </td>
                                                <td className="px-6 py-4 text-white">
                                                    {move.quantity} {move.items?.is_weighted ? 'г' : 'шт'}
                                                </td>
                                                <td className="px-6 py-4 text-secondary">
                                                    {move.locations?.name || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
