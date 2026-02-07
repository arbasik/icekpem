import { useState, useEffect } from 'react'
import { Wallet, Plus, TrendingUp, TrendingDown, DollarSign, X } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import CustomSelect from '../components/CustomSelect'
import { supabase, Transaction, Balance, Location } from '../lib/supabase'
import clsx from 'clsx'

export default function Kassa() {
    const [transactions, setTransactions] = useState<(Transaction & { client_name?: string })[]>([])
    const [balance, setBalance] = useState<Balance | null>(null)
    const [clients, setClients] = useState<Location[]>([])
    const [showModal, setShowModal] = useState(false)
    const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

    // Form state
    const [type, setType] = useState<'income' | 'expense'>('income')
    const [category, setCategory] = useState('')
    const [amount, setAmount] = useState('')
    const [clientId, setClientId] = useState<string | null>(null)
    const [description, setDescription] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadBalance()
        loadTransactions()
        loadClients()
    }, [])

    async function loadBalance() {
        const { data } = await supabase
            .from('balance')
            .select('*')
            .limit(1)
            .single()

        setBalance(data)
    }

    async function loadTransactions() {
        const { data } = await supabase
            .from('transactions')
            .select(`
                *,
                locations(name)
            `)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })

        const formatted = data?.map(t => ({
            ...t,
            client_name: (t.locations as any)?.name
        })) || []

        setTransactions(formatted)
    }

    async function loadClients() {
        const { data } = await supabase
            .from('locations')
            .select('*')
            .eq('type', 'client')
            .order('name')

        setClients(data || [])
    }

    function handleAddTransaction() {
        setType('income')
        setCategory('')
        setAmount('')
        setClientId(null)
        setDescription('')
        setDate(new Date().toISOString().split('T')[0])
        setShowModal(true)
    }

    async function handleSave() {
        if (!category || !amount) return

        setLoading(true)
        try {
            const amountValue = parseFloat(amount)

            // Создать транзакцию
            await supabase.from('transactions').insert({
                type,
                category,
                amount: amountValue,
                client_id: clientId,
                description,
                date
            })

            // Обновить баланс
            const newBalance = type === 'income'
                ? (balance?.current_balance || 0) + amountValue
                : (balance?.current_balance || 0) - amountValue

            await supabase
                .from('balance')
                .update({
                    current_balance: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('id', balance?.id)

            setShowModal(false)
            await loadBalance()
            await loadTransactions()
        } catch (err) {
            console.error('Ошибка сохранения:', err)
            alert('Ошибка при сохранении транзакции')
        } finally {
            setLoading(false)
        }
    }

    const incomeCategories = [
        { value: 'consignment_sale', label: 'Реализация' },
        { value: 'direct_sale', label: 'Прямая продажа' },
        { value: 'other_income', label: 'Прочие доходы' },
        { value: 'income', label: 'Доход' }
    ]

    const expenseCategories = [
        { value: 'raw_materials', label: 'Закупка сырья' },
        { value: 'salary', label: 'Зарплата' },
        { value: 'rent', label: 'Аренда' },
        { value: 'utilities', label: 'Коммунальные услуги' },
        { value: 'asset_purchase', label: 'Покупка оборудования' },
        { value: 'other_expense', label: 'Прочие расходы' },
        { value: 'expense', label: 'Расход' }
    ]

    const categoryLabel = (cat: string) => {
        if (!cat) return 'Без категории'
        const all = [...incomeCategories, ...expenseCategories]
        const found = all.find(c => c.value === cat)
        if (found) return found.label

        // Fallback checks for common legacy keys if exact match fails
        if (cat === 'raw_materials') return 'Закупка сырья'
        if (cat === 'consignment_sale') return 'Реализация'

        return cat
    }

    // Статистика за текущий месяц
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonth))
    const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const monthProfit = monthIncome - monthExpense

    const filteredTransactions = transactions.filter(t => {
        if (filterType === 'all') return true
        return t.type === filterType
    })

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-success" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Касса</h1>
                        <p className="text-secondary">Управление доходами и расходами</p>
                    </div>
                </div>
                <button
                    onClick={handleAddTransaction}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-smooth"
                >
                    <Plus className="w-5 h-5" />
                    Добавить транзакцию
                </button>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-4">
                    <div className="text-sm text-secondary mb-1">Текущий баланс</div>
                    <div className={clsx(
                        'text-3xl font-bold',
                        (balance?.current_balance || 0) >= 0 ? 'text-success' : 'text-red-400'
                    )}>
                        {(balance?.current_balance || 0).toFixed(2)} ₽
                    </div>
                </GlassCard>
                <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <div className="text-sm text-secondary">Доходы за месяц</div>
                    </div>
                    <div className="text-3xl font-bold text-success">{monthIncome.toFixed(2)} ₽</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <div className="text-sm text-secondary">Расходы за месяц</div>
                    </div>
                    <div className="text-3xl font-bold text-red-400">{monthExpense.toFixed(2)} ₽</div>
                </GlassCard>
                <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <div className="text-sm text-secondary">Прибыль за месяц</div>
                    </div>
                    <div className={clsx(
                        'text-3xl font-bold',
                        monthProfit >= 0 ? 'text-success' : 'text-red-400'
                    )}>
                        {monthProfit.toFixed(2)} ₽
                    </div>
                </GlassCard>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <button
                    onClick={() => setFilterType('all')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Все
                </button>
                <button
                    onClick={() => setFilterType('income')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'income'
                            ? 'bg-success text-white'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Доходы
                </button>
                <button
                    onClick={() => setFilterType('expense')}
                    className={clsx(
                        'px-4 py-2 rounded-lg font-medium transition-smooth',
                        filterType === 'expense'
                            ? 'bg-red-500 text-white'
                            : 'bg-white/5 text-secondary hover:bg-white/10'
                    )}
                >
                    Расходы
                </button>
            </div>

            {/* Transactions List */}
            <GlassCard>
                <h2 className="text-xl font-semibold mb-4">Транзакции</h2>
                <div className="space-y-2">
                    {filteredTransactions.length === 0 ? (
                        <div className="text-center py-16 text-secondary">
                            Нет транзакций
                        </div>
                    ) : (
                        filteredTransactions.map(t => (
                            <div
                                key={t.id}
                                className="p-4 bg-white/5 rounded-lg border border-white/10"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-lg mb-1">
                                            {t.description || categoryLabel(t.category || '')}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-secondary">
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                t.type === 'income'
                                                    ? 'bg-success/20 text-success'
                                                    : 'bg-red-500/20 text-red-400'
                                            )}>
                                                {categoryLabel(t.category || '')}
                                            </span>
                                            <span>{new Date(t.date).toLocaleDateString('ru-RU')}</span>
                                            {t.client_name && (
                                                <span className="text-primary font-bold"> • Клиент: {t.client_name}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={clsx(
                                        'text-xl font-bold',
                                        t.type === 'income' ? 'text-success' : 'text-red-400'
                                    )}>
                                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)} ₽
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>

            {/* Add Transaction Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <GlassCard className="w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Новая транзакция</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-smooth"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Тип</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setType('income'); setCategory(''); }}
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth',
                                            type === 'income'
                                                ? 'bg-success/20 border-success'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        )}
                                    >
                                        <div className="font-medium text-sm">Доход</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setType('expense'); setCategory(''); }}
                                        className={clsx(
                                            'p-3 rounded-lg border transition-smooth',
                                            type === 'expense'
                                                ? 'bg-red-500/20 border-red-500'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        )}
                                    >
                                        <div className="font-medium text-sm">Расход</div>
                                    </button>
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Категория *</label>
                                <CustomSelect
                                    value={category}
                                    onChange={(val) => setCategory(String(val))}
                                    options={type === 'income' ? incomeCategories : expenseCategories}
                                    placeholder="Выберите категорию"
                                />
                            </div>

                            {/* Client (only for consignment_sale) */}
                            {category === 'consignment_sale' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">Клиент</label>
                                    <CustomSelect
                                        value={clientId || ''}
                                        onChange={(val) => setClientId(val ? String(val) : null)}
                                        options={clients.map(c => ({ value: c.id, label: c.name }))}
                                        placeholder="Выберите клиента"
                                    />
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Сумма *</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                    placeholder="0.00"
                                    step="0.01"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Описание</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary resize-none"
                                    rows={3}
                                    placeholder="Дополнительная информация..."
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Дата</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                />
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={loading || !category || !amount}
                                className={clsx(
                                    'w-full py-3 rounded-lg font-medium transition-smooth',
                                    loading || !category || !amount
                                        ? 'bg-white/10 text-secondary cursor-not-allowed'
                                        : 'bg-primary hover:bg-primary/90 text-white'
                                )}
                            >
                                {loading ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
