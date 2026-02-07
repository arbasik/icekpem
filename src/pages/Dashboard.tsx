import { useState, useEffect } from 'react'
import { LayoutDashboard, Activity, TrendingUp, ArrowUpRight, ArrowDownLeft, Truck, Factory, ShoppingCart, AlertTriangle, CheckCircle } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'

interface ActivityItem {
    id: string | number
    type: 'move' | 'transaction'
    subtype: string
    date: string
    title: string
    description: string
    amount?: number // Quantity or Money
    unit?: string
    isPositive?: boolean
}

interface TopProduct {
    id: string | number
    name: string
    quantity: number
    revenue: number
}

export default function Dashboard() {
    // Activity State
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)

    // Top Products State
    const [topProducts, setTopProducts] = useState<TopProduct[]>([])

    // Risk State
    const [lowStock, setLowStock] = useState<{ name: string; days: number }[]>([])
    const [churnRisks, setChurnRisks] = useState<{ name: string; daysSince: number }[]>([])

    useEffect(() => {
        loadDashboardData()
        loadRiskData()
        loadAnalyticsData()
    }, [])

    async function loadDashboardData() {
        setLoading(true)
        try {
            const [movesRes, transRes] = await Promise.all([
                supabase.from('inventory_moves')
                    .select(`
                        id, created_at, type, quantity, 
                        items(name, unit), 
                        to_loc:to_location_id(name), 
                        from_loc:from_location_id(name)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(20),
                supabase.from('transactions')
                    .select('*')
                    .order('date', { ascending: false })
                    .limit(20)
            ])

            const moves = (movesRes.data || []).map((m: any) => {
                let title = 'Движение'
                let desc = ''
                let isPos = true

                if (m.type === 'production') {
                    title = 'Производство'
                    desc = `Произведено ${m.quantity} ${m.items?.unit || 'шт'} ${m.items?.name}`
                    isPos = true
                } else if (m.type === 'transfer') {
                    title = 'Отгрузка'
                    desc = `Отгружено ${m.items?.name} -> ${m.to_loc?.name || 'Клиент'}`
                    isPos = false
                } else if (m.type === 'supply') {
                    title = 'Поставка'
                    desc = `Принято ${m.quantity} ${m.items?.name}`
                    isPos = true
                } else if (m.type === 'usage') {
                    title = 'Списание'
                    desc = `Списано на производство: ${m.items?.name}`
                    isPos = false
                }

                return {
                    id: `move-${m.id}`,
                    type: 'move',
                    subtype: m.type,
                    date: m.created_at,
                    title,
                    description: desc,
                    amount: m.quantity,
                    unit: m.items?.unit || 'шт',
                    isPositive: isPos
                } as ActivityItem
            })

            const transactions = (transRes.data || []).map((t: any) => ({
                id: `trans-${t.id}`,
                type: 'transaction',
                subtype: t.type,
                date: t.date || t.created_at,
                title: t.type === 'income' ? 'Доход' : 'Расход',
                description: t.description || (t.type === 'income' ? 'Поступление средств' : 'Оплата счетов'),
                amount: t.amount,
                unit: '₽',
                isPositive: t.type === 'income'
            } as ActivityItem))

            const combined = [...moves, ...transactions].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ).slice(0, 20)

            setActivities(combined)

        } catch (e) {
            console.error('Dashboard load error:', e)
        } finally {
            setLoading(false)
        }
    }

    async function loadAnalyticsData() {
        // Fetch sales/transfers to clients
        await supabase
            .from('inventory_moves')
            .select('item_id, quantity, sale_price, items(name)')
            .eq('type', 'transfer')
            .not('to_location_id', 'is', null) // Only transfers to clients

        // Use separate query to check if location is client if needed, 
        // but 'transfer' usually implies it in this system context or we rely on logic.
        // Better: Join locations to filter type='client'

        // Re-fetching with correct filtering
        const { data: salesData } = await supabase
            .from('inventory_moves')
            .select('item_id, quantity, sale_price, items(name), locations:to_location_id(type)')
            .eq('type', 'transfer')
            .limit(1000) // Reasonable limit for analysis

        const productMap: { [key: string]: TopProduct } = {}

        salesData?.forEach((m: any) => {
            if (m.locations?.type === 'client') {
                const id = m.item_id
                if (!productMap[id]) {
                    productMap[id] = {
                        id,
                        name: m.items?.name || 'Unknown',
                        quantity: 0,
                        revenue: 0
                    }
                }
                productMap[id].quantity += m.quantity
                productMap[id].revenue += m.quantity * (m.sale_price || 0)
            }
        })

        const sorted = Object.values(productMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        setTopProducts(sorted)
    }

    async function loadRiskData() {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const [stockRes, usageRes, clientsRes, clientMovesRes] = await Promise.all([
            supabase.from('inventory').select('item_id, quantity, items(name, type)'), // Select TYPE
            supabase.from('inventory_moves')
                .select('item_id, quantity, created_at')
                .eq('type', 'production')
                .gte('created_at', sevenDaysAgo.toISOString()),
            supabase.from('locations').select('id, name').eq('type', 'client'),
            supabase.from('inventory_moves') // Get all client moves to find last order
                .select('created_at, to_location_id')
                .eq('type', 'transfer')
                .not('to_location_id', 'is', null)
        ])

        // 1. Inventory Forecast (Filtered by Raw Materials)
        const usageMap: { [key: string]: number } = {}
        const usageData = usageRes.data || []
        usageData.forEach((m: any) => {
            usageMap[m.item_id] = (usageMap[m.item_id] || 0) + m.quantity
        })

        const risks: { name: string; days: number }[] = []
        const stocks = stockRes.data || []

        stocks.forEach((item: any) => {
            // FILTER: Only Raw Materials
            if (item.items?.type !== 'raw_material') return

            const weeklyUsage = usageMap[item.item_id] || 0
            if (weeklyUsage > 0) {
                const dailyUsage = weeklyUsage / 7
                const daysLeft = item.quantity / dailyUsage
                if (daysLeft < 4) { // Alert if less than 4 days
                    risks.push({
                        name: item.items?.name || 'Unknown',
                        days: Math.round(daysLeft * 10) / 10
                    })
                }
            }
        })
        setLowStock(risks.slice(0, 5))

        // 2. Churn Risks
        const clients = clientsRes.data || []
        const clientMoves = clientMovesRes.data || []
        const churners: { name: string; daysSince: number }[] = []

        clients.forEach((client: any) => {
            const clientOrders = clientMoves.filter((m: any) => m.to_location_id === client.id)
            if (clientOrders.length > 0) {
                // Determine last order date
                const dates = clientOrders.map((m: any) => new Date(m.created_at).getTime())
                const lastOrder = Math.max(...dates)
                const daysSince = (Date.now() - lastOrder) / (1000 * 60 * 60 * 24)

                if (daysSince > 14) {
                    churners.push({
                        name: client.name,
                        daysSince: Math.floor(daysSince)
                    })
                }
            }
        })
        setChurnRisks(churners.slice(0, 5))
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                    <LayoutDashboard className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Панель управления</h1>
                    <p className="text-secondary">Оперативная сводка</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: ACTIVITY STREAM */}
                <div className="lg:col-span-1">
                    <GlassCard className="h-[600px] flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">Лента событий</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {loading ? (
                                <p className="text-secondary text-sm">Загрузка...</p>
                            ) : activities.length === 0 ? (
                                <p className="text-secondary text-sm">Нет недавней активности</p>
                            ) : (
                                activities.map(item => (
                                    <div key={item.id} className="p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                {item.subtype === 'production' && <Factory className="w-4 h-4 text-action" />}
                                                {item.subtype === 'transfer' && <Truck className="w-4 h-4 text-blue-400" />}
                                                {item.subtype === 'income' && <ArrowUpRight className="w-4 h-4 text-green-400" />}
                                                {item.subtype === 'expense' && <ArrowDownLeft className="w-4 h-4 text-red-400" />}
                                                <span className={clsx(
                                                    "text-xs font-bold uppercase tracking-wider",
                                                    item.subtype === 'production' ? "text-action" :
                                                        item.subtype === 'income' ? "text-green-400" :
                                                            item.subtype === 'expense' ? "text-red-400" : "text-secondary"
                                                )}>{item.title}</span>
                                            </div>
                                            <span className="text-xs text-secondary/70">
                                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-sm text-white/90 mb-1">{item.description}</div>
                                        {item.amount && (
                                            <div className={clsx(
                                                "text-xs font-bold text-right",
                                                item.isPositive ? "text-white" : "text-secondary"
                                            )}>
                                                {item.isPositive ? '+' : ''}{item.amount} {item.unit}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </div>

                {/* RIGHT COLUMN: WIDGETS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* TOP PRODUCTS (Replaced Simulator) */}
                    <GlassCard className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-action" />
                            <h2 className="text-lg font-bold">Лидеры продаж</h2>
                        </div>
                        <div className="space-y-2">
                            {topProducts.length === 0 ? (
                                <p className="text-secondary text-sm">Нет данных о продажах</p>
                            ) : (
                                topProducts.map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white">{p.name}</div>
                                                <div className="text-xs text-secondary">{p.quantity} шт</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-action">{p.revenue.toLocaleString()} ₽</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>

                    {/* RISK WIDGETS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* INVENTORY FORECAST */}
                        <GlassCard className="flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <ShoppingCart className="w-5 h-5 text-orange-400" />
                                <h2 className="text-lg font-bold">Заканчивается сырьё</h2>
                            </div>
                            {lowStock.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-secondary py-6">
                                    <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">Сырья достаточно</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {lowStock.map((item, i) => (
                                        <li key={i} className="flex justify-between items-center bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                                            <span className="font-medium text-white">{item.name}</span>
                                            <span className="text-sm font-bold text-orange-400">
                                                {item.days < 1 ? '< 1 дня' : `~ ${item.days} дн.`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </GlassCard>

                        {/* CHURN ALERTS */}
                        <GlassCard className="flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <h2 className="text-lg font-bold">Риск ухода (14+ дн)</h2>
                            </div>
                            {churnRisks.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-secondary py-6">
                                    <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">Все клиенты активны</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {churnRisks.map((client, i) => (
                                        <li key={i} className="flex justify-between items-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                            <span className="font-medium text-white">{client.name}</span>
                                            <span className="text-sm font-bold text-red-400">
                                                {client.daysSince} дн.
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </GlassCard>
                    </div>
                </div>

            </div>
        </div>
    )
}
