import { useState, useEffect, useMemo } from 'react'
import { Users, Plus, Edit2, Trash2, X, List, Map as MapIcon, Search, MapPin, TrendingUp, DollarSign, Upload } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import ClientDetail from '../components/ClientDetail'
import ClientsMap from '../components/ClientsMap'
import AddressAutocomplete from '../components/AddressAutocomplete'
import ImportClientsModal from '../components/ImportClientsModal'
import { supabase, Location } from '../lib/supabase'
import clsx from 'clsx'

interface ClientStats {
    totalClients: number
    withAddress: number
    totalShipments: number
    totalRevenue: number
}

export default function Clients() {
    const [clients, setClients] = useState<Location[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingClient, setEditingClient] = useState<Location | null>(null)
    const [viewingClient, setViewingClient] = useState<Location | null>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'map'>('list')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [contact, setContact] = useState('')
    const [latitude, setLatitude] = useState<number | undefined>()
    const [longitude, setLongitude] = useState<number | undefined>()
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [stats, setStats] = useState<ClientStats>({ totalClients: 0, withAddress: 0, totalShipments: 0, totalRevenue: 0 })

    useEffect(() => {
        loadClients()
        loadStats()
    }, [])

    async function loadClients() {
        const { data } = await supabase
            .from('locations')
            .select('*')
            .eq('type', 'client')
            .order('name')

        setClients(data || [])
    }

    async function loadStats() {
        // Получаем статистику отгрузок
        const { data: moves } = await supabase
            .from('inventory_moves')
            .select('quantity, unit_price, to_location_id')
            .eq('type', 'transfer')

        const totalShipments = moves?.length || 0
        const totalRevenue = moves?.reduce((sum, m) => sum + (m.quantity * (m.unit_price || 0)), 0) || 0

        const { data: clientsData } = await supabase
            .from('locations')
            .select('id, latitude')
            .eq('type', 'client')

        setStats({
            totalClients: clientsData?.length || 0,
            withAddress: clientsData?.filter(c => c.latitude).length || 0,
            totalShipments,
            totalRevenue
        })
    }

    // Фильтрация по поиску
    const filteredClients = useMemo(() => {
        if (!search.trim()) return clients
        const q = search.toLowerCase()
        return clients.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.address?.toLowerCase().includes(q) ||
            c.contact?.toLowerCase().includes(q)
        )
    }, [clients, search])

    function handleAdd() {
        setEditingClient(null)
        setName('')
        setAddress('')
        setContact('')
        setLatitude(undefined)
        setLongitude(undefined)
        setLoading(false)
        setShowModal(true)
    }

    function handleEdit(client: Location) {
        setEditingClient(client)
        setName(client.name)
        setAddress(client.address || '')
        setContact(client.contact || '')
        setLatitude(client.latitude)
        setLongitude(client.longitude)
        setShowModal(true)
    }

    async function handleSave() {
        if (!name) return

        setLoading(true)
        try {
            if (editingClient) {
                await supabase
                    .from('locations')
                    .update({ name, address, contact, latitude, longitude })
                    .eq('id', editingClient.id)
            } else {
                await supabase
                    .from('locations')
                    .insert({ name, type: 'client', address, contact, latitude, longitude })
            }

            setShowModal(false)
            await loadClients()
            await loadStats()
        } catch (err: any) {
            alert(`Ошибка: ${err.message || err}`)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Удалить клиента?')) return

        try {
            await supabase.from('locations').delete().eq('id', id)
            await loadClients()
            await loadStats()
        } catch (err) {
            alert('Ошибка при удалении')
        }
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Клиенты</h1>
                        <p className="text-secondary">Управление списком клиентов</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Tab Buttons */}
                    <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-smooth',
                                activeTab === 'list' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                            )}
                        >
                            <List className="w-4 h-4" />
                            Список
                        </button>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-smooth',
                                activeTab === 'map' ? 'bg-primary text-white' : 'text-secondary hover:text-white'
                            )}
                        >
                            <MapIcon className="w-4 h-4" />
                            Карта
                        </button>
                    </div>

                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-smooth border border-white/10"
                    >
                        <Upload className="w-5 h-5" />
                        Импорт
                    </button>

                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-smooth shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-5 h-5" />
                        Добавить
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            < div className="grid grid-cols-4 gap-4" >
                <GlassCard className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.totalClients}</div>
                            <div className="text-xs text-secondary">Всего клиентов</div>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.withAddress}</div>
                            <div className="text-xs text-secondary">С адресом</div>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.totalShipments}</div>
                            <div className="text-xs text-secondary">Отгрузок</div>
                        </div>
                    </div>
                </GlassCard>
                <GlassCard className="!p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.totalRevenue.toFixed(0)}₽</div>
                            <div className="text-xs text-secondary">Выручка</div>
                        </div>
                    </div>
                </GlassCard>
            </div >

            {/* Tab Content */}
            {
                activeTab === 'list' ? (
                    <GlassCard>
                        {/* Search */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Поиск по имени, адресу, телефону..."
                                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Compact Table */}
                        <div className="overflow-auto max-h-[500px]">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-surface z-10">
                                    <tr className="text-left text-xs text-secondary border-b border-white/10">
                                        <th className="pb-2 font-medium">Название</th>
                                        <th className="pb-2 font-medium">Адрес</th>
                                        <th className="pb-2 font-medium">Контакт</th>
                                        <th className="pb-2 font-medium w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredClients.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-8 text-secondary">
                                                {search ? 'Ничего не найдено' : 'Нет клиентов'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredClients.map(client => (
                                            <tr
                                                key={client.id}
                                                onClick={() => setViewingClient(client)}
                                                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                                            >
                                                <td className="py-2.5 pr-4">
                                                    <div className="font-medium text-sm">{client.name}</div>
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    <div className="text-sm text-secondary truncate max-w-[200px]">
                                                        {client.address || '—'}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    <div className="text-sm text-secondary">{client.contact || '—'}</div>
                                                </td>
                                                <td className="py-2.5">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleEdit(client); }}
                                                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDelete(client.id); }}
                                                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Count */}
                        <div className="mt-3 text-xs text-secondary">
                            Показано {filteredClients.length} из {clients.length}
                        </div>
                    </GlassCard>
                ) : (
                    <GlassCard className="h-[600px]">
                        <ClientsMap clients={clients} onClientClick={client => setViewingClient(client)} />
                    </GlassCard>
                )
            }

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <GlassCard className="w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">
                                    {editingClient ? 'Редактировать' : 'Новый клиент'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-secondary mb-1">Название *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                                        placeholder="ООО Рога и Копыта"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-secondary mb-1">Адрес</label>
                                    <AddressAutocomplete
                                        value={address}
                                        onChange={(addr, lat, lon) => {
                                            setAddress(addr)
                                            setLatitude(lat)
                                            setLongitude(lon)
                                        }}
                                        placeholder="Начните вводить адрес..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-secondary mb-1">Контакт</label>
                                    <input
                                        type="text"
                                        value={contact}
                                        onChange={e => setContact(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                                        placeholder="+7 (999) 123-45-67"
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={loading || !name}
                                    className={clsx(
                                        'w-full py-2.5 rounded-lg font-medium text-sm transition-smooth mt-2',
                                        loading || !name
                                            ? 'bg-white/10 text-secondary cursor-not-allowed'
                                            : 'bg-primary hover:bg-primary/90 text-white'
                                    )}
                                >
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {/* Client Detail Modal */}
            {
                viewingClient && (
                    <ClientDetail
                        client={viewingClient}
                        onClose={() => setViewingClient(null)}
                    />
                )
            }
            {/* Import Modal */}
            {
                showImportModal && (
                    <ImportClientsModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => {
                            loadClients()
                            loadStats()
                        }}
                    />
                )
            }
        </div >
    )
}
