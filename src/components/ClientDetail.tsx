import { useState, useEffect } from 'react'
import { X, TruckIcon, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import GlassCard from './GlassCard'
import { supabase, Location } from '../lib/supabase'
import clsx from 'clsx'

interface ClientDetailProps {
    client: Location
    onClose: () => void
}



interface Shipment {
    id: number
    created_at: string
    item_name: string
    quantity: number
    sale_price: number
    payment_status: string
}

export default function ClientDetail({ client, onClose }: ClientDetailProps) {
    const [activeTab, setActiveTab] = useState<'shipments' | 'debt'>('shipments')
    const [shipments, setShipments] = useState<Shipment[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [client.id])

    async function loadData() {
        setLoading(true)
        try {
            // История отгрузок
            const { data: shipData } = await supabase
                .from('inventory_moves')
                .select(`
                    id,
                    created_at,
                    quantity,
                    sale_price,
                    payment_status,
                    items(name)
                `)
                .eq('to_location_id', client.id)
                .eq('type', 'transfer')
                .order('created_at', { ascending: false })

            const formattedShip = shipData?.map(s => ({
                id: s.id,
                created_at: s.created_at,
                item_name: (s.items as any)?.name || 'Неизвестно',
                quantity: s.quantity,
                sale_price: s.sale_price || 0,
                payment_status: s.payment_status || 'consignment'
            })) || []

            setShipments(formattedShip)
        } catch (err) {
            console.error('Ошибка загрузки данных клиента:', err)
        } finally {
            setLoading(false)
        }
    }

    const totalDebt = shipments
        .filter(s => s.payment_status === 'consignment')
        .reduce((sum, s) => sum + (s.quantity * s.sale_price), 0)

    const totalPaid = shipments
        .filter(s => s.payment_status === 'paid')
        .reduce((sum, s) => sum + (s.quantity * s.sale_price), 0)

    // Payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentDescription, setPaymentDescription] = useState('Оплата реализации')

    async function handlePayment() {
        if (!paymentAmount) return

        setLoading(true)
        try {
            const amount = parseFloat(paymentAmount)
            if (isNaN(amount) || amount <= 0) throw new Error('Некорректная сумма')

            // 1. Создать транзакцию дохода
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    type: 'income',
                    category: 'consignment_sale',
                    amount: amount,
                    client_id: client.id,
                    description: paymentDescription,
                    date: new Date().toISOString().split('T')[0]
                })

            if (transactionError) throw transactionError

            // 2. Обновить баланс
            const { data: balanceData } = await supabase
                .from('balance')
                .select('*')
                .limit(1)
                .single()

            if (balanceData) {
                await supabase
                    .from('balance')
                    .update({
                        current_balance: balanceData.current_balance + amount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', balanceData.id)
            }

            // 3. (Опционально) Можно обновить статус отгрузок, но пока просто фиксируем приход денег
            // Это сложная логика распределения платежа по отгрузкам, пока оставим как общий приход

            alert(`Оплата ${amount}₽ успешно принята`)
            setShowPaymentModal(false)
            setPaymentAmount('')
            loadData() // Перезагрузить данные (хотя долг пересчитывается от отгрузок, а не транзакций, но полезно)

        } catch (err: any) {
            console.error('Ошибка оплаты:', err)
            alert('Ошибка при проведении оплаты: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function updateClientStatus(newStatus: string) {
        if (!confirm('Изменить статус клиента?')) return
        try {
            await supabase.from('locations').update({ status: newStatus }).eq('id', client.id)
            onClose() // Close to refresh parent
        } catch (e) {
            console.error(e)
            alert('Ошибка обновления статуса')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <GlassCard className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold">{client.name}</h2>
                            {client.status === 'lead' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">ЛИД</span>}
                            {client.status === 'contacted' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">КОНТАКТ</span>}
                            {client.status === 'active' && <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">АКТИВЕН</span>}
                        </div>
                        {client.address && <p className="text-sm text-secondary mt-1">📍 {client.address}</p>}
                        {client.contact && <p className="text-sm text-secondary">📞 {client.contact}</p>}

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-3">
                            {client.status === 'lead' && (
                                <button
                                    onClick={() => updateClientStatus('contacted')}
                                    className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg transition-colors border border-yellow-500/30"
                                >
                                    Отметить контакт
                                </button>
                            )}
                            {(client.status === 'lead' || client.status === 'contacted') && (
                                <button
                                    onClick={() => updateClientStatus('active')}
                                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg transition-colors border border-emerald-500/30"
                                >
                                    Активировать
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-smooth"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">

                    <button
                        onClick={() => setActiveTab('shipments')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'shipments'
                                ? 'bg-primary/20 text-primary border border-primary'
                                : 'bg-white/5 text-secondary hover:bg-white/10'
                        )}
                    >
                        <TruckIcon className="w-4 h-4" />
                        Отгрузки
                    </button>
                    <button
                        onClick={() => setActiveTab('debt')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-smooth',
                            activeTab === 'debt'
                                ? 'bg-primary/20 text-primary border border-primary'
                                : 'bg-white/5 text-secondary hover:bg-white/10'
                        )}
                    >
                        <DollarSign className="w-4 h-4" />
                        Задолженность
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="text-center py-16 text-secondary">Загрузка...</div>
                    ) : (
                        <>
                            {/* Отгрузки */}
                            {activeTab === 'shipments' && (
                                <div className="space-y-2">
                                    {shipments.length === 0 ? (
                                        <div className="text-center py-16 text-secondary">Нет отгрузок</div>
                                    ) : (
                                        shipments.map(ship => (
                                            <div key={ship.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-medium">{ship.item_name}</div>
                                                        <div className="text-sm text-secondary mt-1">
                                                            {new Date(ship.created_at).toLocaleDateString('ru-RU')} • {ship.quantity} шт × {ship.sale_price}₽ = {ship.quantity * ship.sale_price}₽
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {ship.payment_status === 'paid' ? (
                                                            <span className="flex items-center gap-1 text-green-400 text-sm">
                                                                <CheckCircle className="w-4 h-4" />
                                                                Оплачено
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                                <XCircle className="w-4 h-4" />
                                                                Под реализацию
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Задолженность */}
                            {activeTab === 'debt' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                            <div className="text-sm text-secondary">Под реализацию</div>
                                            <div className="text-2xl font-bold text-yellow-400">{totalDebt}₽</div>
                                        </div>
                                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                            <div className="text-sm text-secondary">Оплачено</div>
                                            <div className="text-2xl font-bold text-green-400">{totalPaid}₽</div>
                                        </div>
                                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                                            <div className="text-sm text-secondary">Всего отгружено</div>
                                            <div className="text-2xl font-bold text-primary">{totalDebt + totalPaid}₽</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end sticky bottom-0 bg-void pt-4 border-t border-white/10">
                                        <button
                                            onClick={() => setShowPaymentModal(true)}
                                            className="flex items-center gap-2 px-6 py-3 bg-success hover:bg-success/90 text-white rounded-lg font-bold transition-smooth shadow-lg shadow-success/20"
                                        >
                                            <DollarSign className="w-5 h-5" />
                                            Внести оплату
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </GlassCard>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <GlassCard className="w-full max-w-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">Внесение оплаты</h2>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-smooth"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Сумма (₽)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary transition-smooth text-lg font-bold"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Комментарий</label>
                                <input
                                    type="text"
                                    value={paymentDescription}
                                    onChange={(e) => setPaymentDescription(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary transition-smooth"
                                    placeholder="Оплата реализации..."
                                />
                            </div>

                            <button
                                onClick={handlePayment}
                                disabled={loading || !paymentAmount}
                                className={clsx(
                                    'w-full py-3 rounded-lg font-medium transition-smooth mt-2',
                                    loading || !paymentAmount
                                        ? 'bg-white/10 text-secondary cursor-not-allowed'
                                        : 'bg-success hover:bg-success/90 text-white'
                                )}
                            >
                                {loading ? 'Обработка...' : 'Подтвердить оплату'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
