
import { useState, useEffect } from 'react'
import { Truck, Send, CheckCircle, History, Users, TrendingUp, DollarSign, Package, Clock } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import CustomSelect from '../components/CustomSelect'
import { supabase, Location, InventoryMove } from '../lib/supabase'
import clsx from 'clsx'
import Skeleton from '../components/Skeleton'

interface InventoryItem {
    id: number | string
    name: string
    quantity: number
}

interface PendingShipment {
    id: number
    created_at: string
    client_name: string
    client_id: string // Locations use UUIDs
    item_name: string
    item_id: number | string
    quantity: number
    sale_price: number
    total: number
}

// Stats Interface
interface DistributionStats {
    activePoints: number
    realizationValue: number
    todayRevenue: number
    topClient: { name: string, total: number } | null
}

export default function Distribution() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'operations' | 'history'>('dashboard')
    const [inventory, setInventory] = useState<(InventoryItem & { sale_price?: number })[]>([])
    const [clients, setClients] = useState<Location[]>([])

    // Stats State
    const [stats, setStats] = useState<DistributionStats>({
        activePoints: 0,
        realizationValue: 0,
        todayRevenue: 0,
        topClient: null
    })
    const [statsLoading, setStatsLoading] = useState(true)

    // Bulk Shipment State
    const [targetClient, setTargetClient] = useState<string | null>(null)
    const [shipmentItems, setShipmentItems] = useState<{ [key: string]: number }>({}) // itemId -> quantity
    const [isConsignment, setIsConsignment] = useState(true)

    const [loading, setLoading] = useState(false)
    const [pendingShipments, setPendingShipments] = useState<PendingShipment[]>([])

    // History State
    interface DistributionHistoryItem extends InventoryMove {
        items: { name: string } | null
        locations: { name: string } | null
        payment_status?: string
        sale_price?: number
        unit_price?: number
    }
    const [historyMoves, setHistoryMoves] = useState<DistributionHistoryItem[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // Modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [shipmentToPay, setShipmentToPay] = useState<PendingShipment | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        loadData()
        loadPendingShipments()
        loadStats()
    }, [])

    useEffect(() => {
        if (activeTab === 'history') {
            loadDistributionHistory()
        }
    }, [activeTab])

    async function loadData() {
        const { data: mainLocation } = await supabase
            .from('locations')
            .select('id')
            .limit(1)
            .single()

        if (!mainLocation) return

        const [invResult, clientsResult] = await Promise.all([
            // Select sale_price from items as well
            supabase.from('inventory').select(`item_id, quantity, items(id, name, type, sale_price)`).eq('location_id', mainLocation.id),
            supabase.from('locations').select('*').eq('type', 'client').order('name')
        ])

        const formatted = invResult.data?.filter(i => (i.items as any)?.type === 'finished_good').map(i => ({
            id: (i.items as any).id,
            name: (i.items as any).name,
            quantity: i.quantity,
            sale_price: (i.items as any).sale_price || 0
        })) || []

        setInventory(formatted as any)
        setClients(clientsResult.data || [])
    }

    async function loadStats() {
        setStatsLoading(true)
        try {
            // 1. Active Points (Clients with stock)
            const { data: activeClients } = await supabase
                .from('inventory')
                .select('location_id, locations!inner(type)')
                .eq('locations.type', 'client')
                .gt('quantity', 0)

            const uniqueActiveClients = new Set(activeClients?.map(ac => ac.location_id)).size

            // 2. Realization Value (Inventory at clients * Sale Price)
            const { data: clientInventory } = await supabase
                .from('inventory')
                .select(`
quantity,
    locations!inner(type),
        items(sale_price)
            `)
                .eq('locations.type', 'client')
                .gt('quantity', 0)

            const totalRealization = clientInventory?.reduce((sum, item) => {
                const price = (item.items as any)?.sale_price || 0
                return sum + (item.quantity * price)
            }, 0) || 0

            // 3. Today's Revenue
            const today = new Date().toISOString().split('T')[0]
            const { data: todaySales } = await supabase
                .from('inventory_moves')
                .select('quantity, unit_price')
                .eq('type', 'sale')
                .gte('created_at', today)

            const revenue = todaySales?.reduce((sum, sale) => sum + (sale.quantity * (sale.unit_price || 0)), 0) || 0

            // 4. Top Client (This Month)
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
            const { data: monthSales } = await supabase
                .from('inventory_moves')
                .select('to_location_id, quantity, unit_price, locations!inventory_moves_to_location_id_fkey(name)')
                .eq('type', 'sale')
                .gte('created_at', startOfMonth)

            const clientSales: { [key: string]: { name: string, total: number } } = {}
            monthSales?.forEach(sale => {
                const locId = sale.to_location_id
                const locName = (sale.locations as any)?.name || 'Unknown'
                const total = sale.quantity * (sale.unit_price || 0)

                if (!clientSales[locId]) clientSales[locId] = { name: locName, total: 0 }
                clientSales[locId].total += total
            })

            let topClient = null
            let maxTotal = -1
            Object.values(clientSales).forEach(c => {
                if (c.total > maxTotal) {
                    maxTotal = c.total
                    topClient = c
                }
            })

            // Synthetic delay
            await new Promise(r => setTimeout(r, 600))

            setStats({
                activePoints: uniqueActiveClients,
                realizationValue: totalRealization,
                todayRevenue: revenue,
                topClient: topClient
            })

        } catch (err) {
            console.error('Error loading stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }

    async function loadDistributionHistory() {
        setHistoryLoading(true)
        const { data, error } = await supabase
            .from('inventory_moves')
            .select(`
id,
    created_at,
    quantity,
    sale_price,
    unit_price,
    type,
    payment_status,
    item_id,
    items(name),
    to_location_id,
    locations: to_location_id(name, type)
        `)
            .or('type.eq.transfer,type.eq.sale')
            .order('created_at', { ascending: false })
            .limit(50)

        // Synthetic delay
        await new Promise(r => setTimeout(r, 600))

        if (!error) {
            const allMoves = (data as any) || []
            setHistoryMoves(allMoves)
        } else {
            console.error(error)
        }
        setHistoryLoading(false)
    }

    async function loadPendingShipments() {
        const { data, error } = await supabase
            .from('inventory_moves')
            .select(`
id, created_at, quantity, unit_price, item_id, to_location_id,
    items(name, sale_price),
    locations: to_location_id(name)
             `)
            .eq('type', 'transfer')
            .eq('payment_status', 'consignment')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error loading pending shipments:', error)
            return
        }

        const formatted = (data || []).map((move: any) => ({
            id: move.id,
            created_at: move.created_at,
            client_name: move.locations?.name || 'Неизвестно',
            client_id: move.to_location_id,
            item_name: move.items?.name || 'Неизвестно',
            item_id: move.item_id,
            quantity: move.quantity,
            sale_price: move.items?.sale_price || 0,
            total: move.quantity * (move.items?.sale_price || 0)
        }))

        setPendingShipments(formatted)
    }

    async function handleCreateShipment() {
        if (!targetClient) return

        // Filter items with quantity > 0
        const itemsToShip = Object.entries(shipmentItems).filter(([_, qty]) => qty > 0)
        if (itemsToShip.length === 0) return

        setLoading(true)
        try {
            const { data: mainLocation } = await supabase
                .from('locations')
                .select('id')
                .limit(1)
                .single()

            if (!mainLocation) throw new Error('Не найдена главная локация')

            let totalShipmentValue = 0
            const itemNames = []

            // Create inventory moves
            for (const [itemId, qty] of itemsToShip) {
                const item = inventory.find(i => i.id.toString() === itemId)
                if (!item) continue

                const price = item.sale_price || 0
                totalShipmentValue += qty * price
                itemNames.push(`${item.name} (${qty} шт)`)

                await supabase.from('inventory_moves').insert({
                    item_id: itemId,
                    from_location_id: mainLocation.id,
                    to_location_id: targetClient,
                    quantity: qty,
                    type: isConsignment ? 'transfer' : 'sale',
                    unit_price: 0, // Unit price for internal tracking, sale_price for client
                    sale_price: price, // Use default sale price
                    payment_status: isConsignment ? 'consignment' : 'paid'
                })
            }

            // Create Transaction if Paid immediately
            if (!isConsignment && totalShipmentValue > 0) {
                const { error: transactionError } = await supabase
                    .from('transactions')
                    .insert({
                        type: 'income',
                        category: 'consignment_sale', // Use same category for now
                        amount: totalShipmentValue,
                        description: `Массовая отгрузка: ${itemNames.join(', ')} `,
                        date: new Date().toISOString().split('T')[0],
                        client_id: targetClient
                    })

                if (!transactionError) {
                    const { data: balanceData } = await supabase.from('balance').select('*').limit(1).single()
                    if (balanceData) {
                        await supabase.from('balance').update({
                            current_balance: balanceData.current_balance + totalShipmentValue,
                            updated_at: new Date().toISOString()
                        }).eq('id', balanceData.id)
                    }
                }
            }

            // Reset
            setShipmentItems({})
            setTargetClient(null)
            setIsConsignment(true)
            await loadData()
            await loadPendingShipments()
            await loadStats()

            // Show custom success message instead of alert
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2000)

        } catch (err) {
            console.error('Ошибка отгрузки:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleMarkAsPaid(shipment: PendingShipment) {
        setShipmentToPay(shipment)
        setShowConfirmModal(true)
    }

    async function executePayment() {
        if (!shipmentToPay) return

        const shipment = shipmentToPay
        setLoading(true)
        try {
            // Update the existing 'transfer' move to 'sale' and 'paid'
            const { error: moveError } = await supabase
                .from('inventory_moves')
                .update({
                    type: 'sale',
                    payment_status: 'paid',
                    payment_date: new Date().toISOString()
                })
                .eq('id', shipment.id)

            if (moveError) throw moveError

            const { error: transError } = await supabase
                .from('transactions')
                .insert({
                    type: 'income',
                    category: 'consignment_sale',
                    amount: shipment.total,
                    description: `Оплата реализации: ${shipment.item_name} (${shipment.quantity} шт)`,
                    date: new Date().toISOString().split('T')[0],
                    client_id: shipment.client_id
                })

            if (transError) throw transError

            const { data: balanceData } = await supabase.from('balance').select('*').limit(1).single()

            if (balanceData) {
                await supabase
                    .from('balance')
                    .update({
                        current_balance: balanceData.current_balance + shipment.total,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', balanceData.id)
            }

            setShowConfirmModal(false)
            setShipmentToPay(null)
            loadPendingShipments()
            loadStats()
        } catch (err: any) {
            console.error('Ошибка при оплате:', err)
        } finally {
            setLoading(false)
        }
    }

    // Calculate total items selected for bulk ship
    const selectedCount = Object.values(shipmentItems).reduce((acc, qty) => acc + (qty > 0 ? 1 : 0), 0)

    function updateShipmentQty(itemId: string, val: string) {
        const num = parseInt(val)
        const item = inventory.find(i => i.id.toString() === itemId)
        const maxQty = item?.quantity || 0

        if (isNaN(num) || num <= 0) {
            const newItems = { ...shipmentItems }
            delete newItems[itemId]
            setShipmentItems(newItems)
            return
        }
        if (num > maxQty) {
            setShipmentItems(prev => ({ ...prev, [itemId]: maxQty }))
        } else {
            setShipmentItems(prev => ({ ...prev, [itemId]: num }))
        }
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Продажи</h1>
                        <p className="text-secondary">Управление реализацией</p>
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
                    onClick={() => setActiveTab('operations')}
                    className={clsx(
                        'px-4 py-2 font-medium transition-colors relative',
                        activeTab === 'operations' ? 'text-primary' : 'text-secondary hover:text-white'
                    )}
                >
                    Операции
                    {activeTab === 'operations' && <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgb(var(--color-primary))]" />}
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
                                        <Users className="w-16 h-16 text-primary" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Активные точки</p>
                                    <h3 className="text-3xl font-bold text-white">{stats.activePoints}</h3>
                                    <div className="mt-2 text-xs text-secondary/70">Магазины с товаром</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Package className="w-16 h-16 text-yellow-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Товар на реализации</p>
                                    <h3 className="text-3xl font-bold text-yellow-400">{stats.realizationValue.toLocaleString()} ₽</h3>
                                    <div className="mt-2 text-xs text-secondary/70">Ожидаемая выручка</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <DollarSign className="w-16 h-16 text-emerald-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Выручка за сегодня</p>
                                    <h3 className="text-3xl font-bold text-emerald-400">{stats.todayRevenue.toLocaleString()} ₽</h3>
                                    <div className="mt-2 text-xs text-secondary/70">Оплаченные продажи</div>
                                </GlassCard>

                                <GlassCard className="p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <TrendingUp className="w-16 h-16 text-blue-400" />
                                    </div>
                                    <p className="text-secondary font-medium mb-1">Лучший клиент</p>
                                    <h3 className="text-xl font-bold text-blue-400 truncate" title={stats.topClient?.name}>
                                        {stats.topClient?.name || 'Нет данных'}
                                    </h3>
                                    <div className="mt-2 text-xs text-secondary/70">
                                        {stats.topClient ? `${stats.topClient.total.toLocaleString()} ₽ за месяц` : '—'}
                                    </div>
                                </GlassCard>
                            </>
                        )}
                    </div>

                    {/* Mini Pending List Summary */}
                    <div className="mt-8">
                        <h3 className="text-lg font-bold mb-4">Требуют внимания (Ожидают оплаты)</h3>
                        {pendingShipments.length === 0 ? (
                            <div className="text-secondary text-sm">Нет неоплаченных реализаций</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {pendingShipments.slice(0, 6).map(shipment => (
                                    <GlassCard key={shipment.id} className="p-4 flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">{shipment.client_name}</div>
                                            <div className="text-sm text-secondary">{shipment.item_name} • {shipment.quantity} шт</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-yellow-400 font-bold">{shipment.total.toLocaleString()} ₽</div>
                                            <button
                                                onClick={() => handleMarkAsPaid(shipment)}
                                                className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded mt-1 transition-colors"
                                            >
                                                Оплатить
                                            </button>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* OPERATIONS TAB (Existing Content) */}
            {activeTab === 'operations' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animation-fade-in">
                    {/* Left: Create Shipment */}
                    <GlassCard className="p-6 space-y-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Send className="w-5 h-5 text-secondary" />
                            Новая отгрузка
                        </h2>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-secondary">Клиент / Точка продаж</label>
                                <CustomSelect
                                    options={clients.map(c => ({ value: c.id, label: c.name }))}
                                    value={targetClient || ''}
                                    onChange={(value) => setTargetClient(value as string)}
                                    placeholder="Выберите клиента..."
                                />
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                <label className="text-sm text-secondary">Товары к отгрузке</label>
                                {inventory.length === 0 ? (
                                    <div className="text-secondary text-sm p-4 bg-white/5 rounded-lg text-center">
                                        Нет готовой продукции на складе
                                    </div>
                                ) : (
                                    inventory.map(item => (
                                        <div key={item.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                            <div>
                                                <div className="font-medium text-white">{item.name}</div>
                                                <div className="text-xs text-secondary">Доступно: {item.quantity} шт</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantity}
                                                    placeholder="0"
                                                    className="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 text-right text-white focus:border-primary outline-none"
                                                    value={shipmentItems[item.id] || ''}
                                                    onChange={(e) => updateShipmentQty(item.id.toString(), e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isConsignment}
                                        onChange={(e) => setIsConsignment(e.target.checked)}
                                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-secondary">Под реализацию (оплата позже)</span>
                                </label>
                            </div>

                            <button
                                onClick={handleCreateShipment}
                                disabled={loading || !targetClient || selectedCount === 0}
                                className={clsx(
                                    "w-full py-3 rounded-xl font-bold text-black transition-all",
                                    loading || !targetClient || selectedCount === 0
                                        ? "bg-white/10 text-white/50 cursor-not-allowed"
                                        : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                )}
                            >
                                {loading ? 'Отправка...' : 'Отгрузить товар'}
                            </button>
                        </div>
                    </GlassCard>

                    {/* Right: Pending Shipments List */}
                    <GlassCard className="p-6 flex flex-col h-full">
                        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-yellow-400" />
                            Ожидают оплаты
                        </h2>

                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 max-h-[500px]">
                            {pendingShipments.length === 0 ? (
                                <div className="text-center text-secondary py-10">
                                    Нет активных реализаций
                                </div>
                            ) : (
                                pendingShipments.map(shipment => (
                                    <div key={shipment.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-white text-lg">{shipment.client_name}</div>
                                                <div className="text-sm text-secondary">{new Date(shipment.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-primary text-lg">{shipment.total.toLocaleString()} ₽</div>
                                                <div className="text-xs text-yellow-400 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full inline-block mt-1">
                                                    На реализации
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                                            <div className="text-sm text-white/80">
                                                {shipment.item_name} <span className="text-secondary">x {shipment.quantity}</span>
                                            </div>
                                            <button
                                                onClick={() => handleMarkAsPaid(shipment)}
                                                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Подтвердить оплату
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
                <GlassCard className="animation-fade-in p-6">
                    <div className="flex items-center justify-between mb-6 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                <History className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">История отгрузок</h2>
                                <p className="text-secondary text-sm">Последние операции</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-2">
                        {historyLoading ? (
                            <div className="text-center py-8 text-secondary">Загрузка...</div>
                        ) : historyMoves.length === 0 ? (
                            <div className="text-center py-8 text-secondary">История пуста</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-[#1e1e1e] z-10">
                                    <tr className="border-b border-white/10 text-secondary">
                                        <th className="text-left py-2">Дата</th>
                                        <th className="text-left py-2">Тип</th>
                                        <th className="text-left py-2">Клиент</th>
                                        <th className="text-left py-2">Товар</th>
                                        <th className="text-right py-2">Количество</th>
                                        <th className="text-right py-2">Цена</th>
                                        <th className="text-right py-2">Сумма</th>
                                        <th className="text-right py-2">Статус</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i}>
                                                <td className="py-3"><Skeleton className="h-4 w-24" /></td>
                                                <td className="py-3"><Skeleton className="h-6 w-16" /></td>
                                                <td className="py-3"><Skeleton className="h-4 w-32" /></td>
                                                <td className="py-3"><Skeleton className="h-4 w-24" /></td>
                                                <td className="py-3"><div className="flex justify-end"><Skeleton className="h-4 w-12" /></div></td>
                                                <td className="py-3"><div className="flex justify-end"><Skeleton className="h-4 w-16" /></div></td>
                                                <td className="py-3"><div className="flex justify-end"><Skeleton className="h-4 w-20" /></div></td>
                                                <td className="py-3"><div className="flex justify-end"><Skeleton className="h-6 w-20" /></div></td>
                                            </tr>
                                        ))
                                    ) : historyMoves.length === 0 ? (
                                        <tr className="border-b border-white/5">
                                            <td colSpan={8} className="py-8 text-center text-secondary">История пуста</td>
                                        </tr>
                                    ) : (
                                        historyMoves.map((move) => (
                                            <tr key={move.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="py-3 text-secondary">
                                                    {new Date(move.created_at || Date.now()).toLocaleDateString()}
                                                    <div className="text-xs opacity-50">{new Date(move.created_at || Date.now()).toLocaleTimeString().slice(0, 5)}</div>
                                                </td>
                                                <td className="py-3 font-medium text-white">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-bold",
                                                        move.type === 'sale' ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                                                    )}>
                                                        {move.type === 'sale' ? 'Продажа' : 'Реализация'}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-medium text-white">
                                                    {(move.locations)?.name || 'Неизвестно'}
                                                </td>
                                                <td className="py-3 text-secondary">
                                                    {(move.items)?.name || 'Неизвестно'}
                                                </td>
                                                <td className="py-3 text-right font-medium">
                                                    {move.quantity} шт
                                                </td>
                                                <td className="py-3 text-right text-secondary">
                                                    {((move.sale_price || move.unit_price || 0)).toFixed(2)} ₽
                                                </td>
                                                <td className="py-3 text-right font-bold text-white">
                                                    {(move.quantity * (move.sale_price || move.unit_price || 0)).toFixed(2)} ₽
                                                </td>
                                                <td className="py-3 text-right">
                                                    <span className={clsx(
                                                        "px-2 py-0.5 rounded text-xs font-medium",
                                                        move.payment_status === 'paid' ? "bg-green-500/20 text-green-400" :
                                                            move.payment_status === 'consignment' ? "bg-yellow-500/20 text-yellow-400" :
                                                                "bg-white/10 text-secondary"
                                                    )}>
                                                        {move.payment_status === 'paid' ? 'Оплачено' :
                                                            move.payment_status === 'consignment' ? 'Реализация' : 'Перемещение'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Custom Payment Confirmation Modal */}
            {showConfirmModal && shipmentToPay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
                    <GlassCard className="w-full max-w-sm border-yellow-500/30">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white mb-2">Подтверждение оплаты</h2>
                            <p className="text-secondary text-sm">
                                Клиент: <span className="text-white font-medium">{shipmentToPay.client_name}</span>
                            </p>
                            <p className="text-secondary text-sm">
                                Товар: <span className="text-white font-medium">{shipmentToPay.item_name} ({shipmentToPay.quantity} шт)</span>
                            </p>
                            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-center">
                                <div className="text-sm text-yellow-500/80">Сумма к зачислению</div>
                                <div className="text-2xl font-bold text-yellow-500">{shipmentToPay.total.toFixed(2)} ₽</div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false)
                                    setShipmentToPay(null)
                                }}
                                disabled={loading}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-medium transition-smooth"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={executePayment}
                                disabled={loading}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-smooth flex items-center justify-center gap-2"
                            >
                                {loading ? 'Обработка...' : 'Подтвердить'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}



            {/* Success Notification */}
            {showSuccess && (
                <div className="fixed inset-0 flex items-center justify-center z-[10005]">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                    <GlassCard className="relative p-8 flex flex-col items-center gap-4 bg-primary/10 border-primary/50 shadow-[0_0_50px_-10px_rgb(var(--color-primary)/0.5)] animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_20px_0_rgb(var(--color-primary)/0.3)]">
                            <CheckCircle className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold text-white drop-shadow-md">Отгружено!</h3>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
