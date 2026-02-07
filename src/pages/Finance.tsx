import { useState, useEffect } from 'react'
import { DollarSign, PieChart, List, Settings, Plus, Trash2, Briefcase, X, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import CustomSelect from '../components/CustomSelect'
import { supabase, FinancialCategory, Transaction, Location, Asset } from '../lib/supabase'
import clsx from 'clsx'

export default function Finance() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'assets' | 'settings'>('dashboard')
    const [categories, setCategories] = useState<FinancialCategory[]>([])

    // Transactions State
    const [transactions, setTransactions] = useState<(Transaction & { category_name?: string, client_name?: string })[]>([])
    const [showTransactionModal, setShowTransactionModal] = useState(false)
    const [transType, setTransType] = useState<'income' | 'expense'>('expense')
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [clientId, setClientId] = useState<string | null>(null)
    const [clients, setClients] = useState<Location[]>([])
    const [loading, setLoading] = useState(false)
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

    // Dashboard Data
    const [dashboardData, setDashboardData] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        balance: 0,
        inventoryValue: 0,
        assetsValue: 0,
        potentialRevenue: 0
    })

    // Assets State
    const [assets, setAssets] = useState<Asset[]>([])
    const [showAddAssetModal, setShowAddAssetModal] = useState(false)
    const [newAssetName, setNewAssetName] = useState('')
    const [newAssetCost, setNewAssetCost] = useState('')
    const [newAssetCategory, setNewAssetCategory] = useState<'equipment' | 'furniture' | 'vehicle' | 'other'>('equipment')
    const [newAssetDesc, setNewAssetDesc] = useState('')

    // Category Management State
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryType, setNewCategoryType] = useState<'opex' | 'capex' | 'income'>('opex')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            await Promise.all([
                loadCategories(),
                loadTransactions(),
                loadClients(),
                loadBalance(),
                loadAssets(),
                loadInventoryValue()
            ])
        } finally {
            setLoading(false)
        }
    }

    async function loadCategories() {
        const { data } = await supabase.from('financial_categories').select('*').order('name')
        setCategories(data || [])
    }

    async function loadClients() {
        const { data } = await supabase.from('locations').select('*').eq('type', 'client').order('name')
        setClients(data || [])
    }

    async function loadBalance() {
        const { data } = await supabase.from('balance').select('*').limit(1).single()
        if (data) {
            setDashboardData(prev => ({ ...prev, balance: data.current_balance }))
        }
        if (data) {
            setDashboardData(prev => ({ ...prev, balance: data.current_balance }))
        }
    }

    async function loadAssets() {
        const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
        setAssets(data || [])

        const totalValue = data?.reduce((sum, a) => sum + a.purchase_price, 0) || 0
        setDashboardData(prev => ({ ...prev, assetsValue: totalValue }))
    }

    async function loadInventoryValue() {
        // Fetch all items with their unit_cost AND sale_price
        const { data: items } = await supabase.from('items').select('id, unit_cost, sale_price')
        if (!items) return

        // Fetch all inventory quantities
        const { data: inv } = await supabase.from('inventory').select('item_id, quantity, locations!inner(type)')
            .neq('locations.type', 'client') // Only company warehouse

        if (!inv) return

        let totalCost = 0
        let totalRevenue = 0

        inv.forEach(record => {
            const item = items.find(i => i.id === record.item_id)
            if (record.quantity > 0 && item) {
                totalCost += record.quantity * (item.unit_cost || 0)
                totalRevenue += record.quantity * (item.sale_price || 0)
            }
        })

        setDashboardData(prev => ({
            ...prev,
            inventoryValue: totalCost,
            potentialRevenue: totalRevenue
        }))
    }

    async function loadTransactions() {
        const { data } = await supabase
            .from('transactions')
            .select(`
                *,
                financial_categories(name),
                locations(name)
            `)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

        const formatted = data?.map(t => ({
            ...t,
            category_name: (t.financial_categories as any)?.name || t.category || 'Без категории',
            client_name: (t.locations as any)?.name
        })) || []

        setTransactions(formatted)
        calculateDashboard(formatted)
    }

    function calculateDashboard(trans: Transaction[]) {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const monthTrans = trans.filter(t => t.date.startsWith(currentMonth))

        const income = monthTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
        const expense = monthTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

        setDashboardData(prev => ({
            ...prev,
            totalRevenue: income,
            totalExpenses: expense,
            netProfit: income - expense
        }))
    }

    async function handleAddCategory() {
        if (!newCategoryName) return

        try {
            const { error } = await supabase.from('financial_categories').insert({
                name: newCategoryName,
                type: newCategoryType,
                is_system: false
            })

            if (error) throw error

            setNewCategoryName('')
            loadCategories()
        } catch (err: any) {
            alert('Ошибка при создании категории: ' + err.message)
        }
    }



    async function handleDeleteCategory(id: number) {
        if (!confirm('Удалить категорию?')) return

        try {
            const { error } = await supabase.from('financial_categories').delete().eq('id', id)
            if (error) throw error
            loadCategories()
        } catch (err: any) {
            alert('Ошибка при удалении: ' + err.message)
        }
    }

    async function handleAddAsset() {
        if (!newAssetName || !newAssetCost) return
        setLoading(true)
        try {
            const cost = parseFloat(newAssetCost)

            // 1. Create Asset
            const { data: assetData, error: assetError } = await supabase.from('assets').insert({
                name: newAssetName,
                category: newAssetCategory,
                purchase_price: cost,
                current_value: cost,
                description: newAssetDesc,
                status: 'active',
                purchase_date: new Date().toISOString().split('T')[0]
            }).select().single()

            if (assetError) throw assetError

            // 2. Create Transaction (Expense/CAPEX)
            // Determine category ID - ideally we have a "Equipment" category or similar.
            // For now, let's look for a category with type 'capex', or default to null/first found
            const capexCat = categories.find(c => c.type === 'capex')

            const { error: transError } = await supabase.from('transactions').insert({
                type: 'expense',
                category_id: capexCat?.id || null, // Fallback might be needed if no CAPEX cat exists
                amount: cost,
                description: `Покупка актива: ${newAssetName}`,
                date: new Date().toISOString().split('T')[0],
                is_capex: true,
                asset_id: assetData.id
            })

            if (transError) console.error('Error creating transaction for asset:', transError)

            setShowAddAssetModal(false)
            setNewAssetName('')
            setNewAssetCost('')
            setNewAssetDesc('')
            await loadData()

        } catch (err: any) {
            alert('Ошибка при создании актива: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveTransaction() {
        if (!selectedCategoryId || !amount) return
        setLoading(true)

        try {
            const amountVal = parseFloat(amount)
            const category = categories.find(c => c.id.toString() === selectedCategoryId)

            // 1. Create Transaction
            const { error } = await supabase.from('transactions').insert({
                type: transType,
                category_id: parseInt(selectedCategoryId),
                amount: amountVal,
                description,
                date,
                client_id: clientId,
                is_capex: category?.type === 'capex'
            })

            if (error) throw error

            // 2. Update Balance
            const { data: balanceData } = await supabase.from('balance').select('*').limit(1).single()
            if (balanceData) {
                const newBalance = transType === 'income'
                    ? balanceData.current_balance + amountVal
                    : balanceData.current_balance - amountVal

                await supabase.from('balance').update({
                    current_balance: newBalance,
                    updated_at: new Date().toISOString()
                }).eq('id', balanceData.id)
            }

            setShowTransactionModal(false)
            resetForm()
            loadData()

        } catch (err: any) {
            console.error(err)
            alert('Ошибка при сохранении: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setAmount('')
        setDescription('')
        setSelectedCategoryId('')
        setClientId(null)
        setDate(new Date().toISOString().split('T')[0])
    }

    function openAddModal(type: 'income' | 'expense') {
        setTransType(type)
        setShowTransactionModal(true)
    }

    const filteredTransactions = transactions.filter(t => {
        if (filterType === 'all') return true
        return t.type === filterType
    })

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Финансы</h1>
                        <p className="text-secondary">Управление деньгами и активами</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                        )}
                    >
                        <PieChart className="w-4 h-4" /> Дашборд
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'transactions' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                        )}
                    >
                        <List className="w-4 h-4" /> Транзакции
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'assets' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                        )}
                    >
                        <Briefcase className="w-4 h-4" /> Активы
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'settings' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                        )}
                    >
                        <Settings className="w-4 h-4" /> Настройки
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <GlassCard className="p-4">
                            <div className="text-sm text-secondary mb-1">Текущий баланс (Касса)</div>
                            <div className={clsx('text-3xl font-bold', dashboardData.balance >= 0 ? 'text-white' : 'text-red-400')}>
                                {dashboardData.balance.toFixed(2)} ₽
                            </div>
                        </GlassCard>
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-success" /><div className="text-sm text-secondary">Доходы (мес)</div></div>
                            <div className="text-2xl font-bold text-success">{dashboardData.totalRevenue.toFixed(2)} ₽</div>
                        </GlassCard>
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-400" /><div className="text-sm text-secondary">Расходы (мес)</div></div>
                            <div className="text-2xl font-bold text-red-400">{dashboardData.totalExpenses.toFixed(2)} ₽</div>
                        </GlassCard>
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-primary" /><div className="text-sm text-secondary">Чистая прибыль (мес)</div></div>
                            <div className={clsx('text-2xl font-bold', dashboardData.netProfit >= 0 ? 'text-success' : 'text-red-400')}>
                                {dashboardData.netProfit.toFixed(2)} ₽
                            </div>
                        </GlassCard>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-primary" /><div className="text-sm text-secondary">Стоимость товаров (склад)</div></div>
                            <div className="text-2xl font-bold text-white">{dashboardData.inventoryValue.toFixed(2)} ₽</div>
                        </GlassCard>
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-400" /><div className="text-sm text-secondary">Потенциальная выручка</div></div>
                            <div className="text-2xl font-bold text-emerald-400">{dashboardData.potentialRevenue.toFixed(2)} ₽</div>
                        </GlassCard>
                        <GlassCard className="p-4">
                            <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-blue-400" /><div className="text-sm text-secondary">Стоимость активов</div></div>
                            <div className="text-2xl font-bold text-white">{dashboardData.assetsValue.toFixed(2)} ₽</div>
                        </GlassCard>
                    </div>
                </div>
            )}

            {/* ASSETS TAB */}
            {activeTab === 'assets' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Активы компании</h2>
                        <button
                            onClick={() => setShowAddAssetModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-smooth"
                        >
                            <Plus className="w-4 h-4" /> Добавить актив
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assets.map(asset => (
                            <GlassCard key={asset.id} className="p-5 relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-xl bg-white/5 text-primary">
                                        <Briefcase className="w-6 h-6" />
                                    </div>
                                    <span className={clsx(
                                        "px-2 py-1 rounded text-xs uppercase font-medium",
                                        asset.status === 'active' ? "bg-success/20 text-success" : "bg-white/10 text-secondary"
                                    )}>
                                        {asset.status === 'active' ? 'Активен' : asset.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg mb-1">{asset.name}</h3>
                                <p className="text-sm text-secondary mb-4 min-h-[40px]">{asset.description || 'Нет описания'}</p>

                                <div className="space-y-2 border-t border-white/10 pt-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Стоимость покупки:</span>
                                        <span className="font-medium text-white">{asset.purchase_price.toFixed(2)} ₽</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Дата:</span>
                                        <span>{new Date(asset.purchase_date).toLocaleDateString('ru-RU')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Категория:</span>
                                        <span className="capitalize">{asset.category === 'equipment' ? 'Оборудование' :
                                            asset.category === 'furniture' ? 'Мебель' :
                                                asset.category === 'vehicle' ? 'Транспорт' : 'Прочее'
                                        }</span>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                    {assets.length === 0 && (
                        <div className="text-center py-20 text-secondary bg-white/5 rounded-2xl border border-white/5">
                            Нет активов. Добавьте оборудование или имущество.
                        </div>
                    )}
                </div>
            )}

            {/* TRANSACTIONS */}
            {activeTab === 'transactions' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => setFilterType('all')} className={clsx('px-3 py-1.5 rounded-lg text-sm transition-smooth', filterType === 'all' ? 'bg-white/10 text-white' : 'text-secondary hover:text-white')}>Все</button>
                            <button onClick={() => setFilterType('income')} className={clsx('px-3 py-1.5 rounded-lg text-sm transition-smooth', filterType === 'income' ? 'bg-success/20 text-success' : 'text-secondary hover:text-white')}>Доходы</button>
                            <button onClick={() => setFilterType('expense')} className={clsx('px-3 py-1.5 rounded-lg text-sm transition-smooth', filterType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-secondary hover:text-white')}>Расходы</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openAddModal('income')} className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-white rounded-lg font-medium transition-smooth">
                                <Plus className="w-4 h-4" /> Доход
                            </button>
                            <button onClick={() => openAddModal('expense')} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-smooth">
                                <Plus className="w-4 h-4" /> Расход
                            </button>
                        </div>
                    </div>

                    <GlassCard>
                        <div className="space-y-2">
                            {filteredTransactions.length === 0 ? (
                                <div className="text-center py-16 text-secondary">Нет транзакций</div>
                            ) : (
                                filteredTransactions.map(t => (
                                    <div key={t.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-smooth">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center", t.type === 'income' ? "bg-success/20 text-success" : "bg-red-500/20 text-red-400")}>
                                                    {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-lg text-white">
                                                        {t.description || (
                                                            t.category === 'raw_materials' ? 'Закупка сырья' :
                                                                t.category === 'consignment_sale' ? 'Реализация' :
                                                                    t.category_name || 'Транзакция'
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-secondary flex items-center gap-2 mt-1">
                                                        <span className="bg-white/10 px-2 py-0.5 rounded textxs">{
                                                            t.category === 'raw_materials' ? 'Закупка сырья' :
                                                                t.category === 'consignment_sale' ? 'Реализация' :
                                                                    t.category_name
                                                        }</span>
                                                        <span>• {new Date(t.date).toLocaleDateString('ru-RU')}</span>
                                                        {t.client_name && <span className="text-primary">• {t.client_name}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={clsx("text-lg font-bold", t.type === 'income' ? "text-success" : "text-red-400")}>
                                                {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} ₽
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* SETTINGS (Category Management) */}
            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Category */}
                    <GlassCard>
                        <h3 className="text-lg font-semibold mb-4">Новая категория</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-secondary mb-1">Название</label>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="Например: Ремонт кофемашины"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-secondary mb-1">Тип</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNewCategoryType('opex')}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                                            newCategoryType === 'opex' ? "bg-orange-500/20 border-orange-500 text-orange-400" : "bg-white/5 border-white/10 text-secondary"
                                        )}
                                    >
                                        OPEX
                                    </button>
                                    <button
                                        onClick={() => setNewCategoryType('capex')}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                                            newCategoryType === 'capex' ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-white/5 border-white/10 text-secondary"
                                        )}
                                    >
                                        CAPEX
                                    </button>
                                    <button
                                        onClick={() => setNewCategoryType('income')}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                                            newCategoryType === 'income' ? "bg-green-500/20 border-green-500 text-green-400" : "bg-white/5 border-white/10 text-secondary"
                                        )}
                                    >
                                        Доход
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={handleAddCategory}
                                disabled={!newCategoryName}
                                className={clsx(
                                    "w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2",
                                    !newCategoryName ? "bg-white/10 text-secondary cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-white"
                                )}
                            >
                                <Plus className="w-5 h-5" /> Добавить
                            </button>
                        </div>
                    </GlassCard>

                    {/* Category List */}
                    <div className="lg:col-span-2 space-y-4">
                        <GlassCard>
                            <h3 className="text-lg font-semibold mb-4">Список категорий</h3>
                            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full",
                                                cat.type === 'income' ? "bg-green-500" :
                                                    cat.type === 'capex' ? "bg-blue-500" : "bg-orange-500"
                                            )} />
                                            <span className="font-medium">{cat.name}</span>
                                            <span className="text-xs text-secondary uppercase tracking-wider">{cat.type === 'income' ? 'Доход' : cat.type === 'capex' ? 'Инвестиции' : 'Расходы'}</span>
                                            {cat.is_system && <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/50">Системное</span>}
                                        </div>

                                        {!cat.is_system && (
                                            <button
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-secondary"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>
                </div>
            )}

            {/* ADD TRANSACTION MODAL */}
            {showTransactionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">
                                {transType === 'income' ? 'Новый доход' : 'Новый расход'}
                            </h2>
                            <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-secondary mb-1">Категория</label>
                                <CustomSelect
                                    options={categories
                                        .filter(c => transType === 'income' ? c.type === 'income' : c.type !== 'income')
                                        .map(c => ({ value: c.id, label: c.name }))
                                    }
                                    value={selectedCategoryId}
                                    onChange={(val) => setSelectedCategoryId(String(val))}
                                    placeholder="Выберите категорию"
                                />
                            </div>

                            {/* Show Clients only for Income (optional, or specific category) */}
                            {transType === 'income' && (
                                <div>
                                    <label className="block text-sm text-secondary mb-1">Клиент (необязательно)</label>
                                    <CustomSelect
                                        options={clients.map(c => ({ value: c.id, label: c.name }))}
                                        value={clientId || ''}
                                        onChange={(val) => setClientId(val ? String(val) : null)}
                                        placeholder="Выберите клиента"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-secondary mb-1">Сумма</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-secondary mb-1">Дата</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-secondary mb-1">Описание</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                                    placeholder="Комментарий..."
                                />
                            </div>

                            <button
                                onClick={handleSaveTransaction}
                                disabled={!amount || !selectedCategoryId || loading}
                                className={clsx(
                                    "w-full py-3 rounded-lg font-bold transition-smooth",
                                    !amount || !selectedCategoryId
                                        ? "bg-white/10 text-secondary cursor-not-allowed"
                                        : "bg-primary hover:bg-primary/90 text-white"
                                )}
                            >
                                {loading ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
            {/* ADD ASSET MODAL */}
            {showAddAssetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Новый актив</h2>
                            <button onClick={() => setShowAddAssetModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-secondary mb-1">Название *</label>
                                <input
                                    type="text"
                                    value={newAssetName}
                                    onChange={e => setNewAssetName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="Например: Кофемашина Simonelli"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-secondary mb-1">Стоимость *</label>
                                <input
                                    type="number"
                                    value={newAssetCost}
                                    onChange={e => setNewAssetCost(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-secondary mb-1">Категория</label>
                                <select
                                    value={newAssetCategory}
                                    onChange={(e: any) => setNewAssetCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                                >
                                    <option value="equipment" className="bg-slate-800">Оборудование</option>
                                    <option value="furniture" className="bg-slate-800">Мебель</option>
                                    <option value="vehicle" className="bg-slate-800">Транспорт</option>
                                    <option value="other" className="bg-slate-800">Прочее</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-secondary mb-1">Описание</label>
                                <textarea
                                    value={newAssetDesc}
                                    onChange={e => setNewAssetDesc(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                                    placeholder="Серийный номер, состояние и т.д."
                                />
                            </div>

                            <button
                                onClick={handleAddAsset}
                                disabled={!newAssetName || !newAssetCost || loading}
                                className={clsx(
                                    "w-full py-3 rounded-lg font-bold transition-smooth mt-2",
                                    !newAssetName || !newAssetCost
                                        ? "bg-white/10 text-secondary cursor-not-allowed"
                                        : "bg-primary hover:bg-primary/90 text-white"
                                )}
                            >
                                {loading ? 'Сохранение...' : 'Добавить актив и списать расход'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
