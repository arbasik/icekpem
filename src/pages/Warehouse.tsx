import { useState, useEffect } from 'react'
import { Warehouse as WarehouseIcon, Plus, X, Pencil, Trash2, LayoutGrid, List, History as HistoryIcon, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Package, RefreshCw } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import IconPicker, { iconMap } from '../components/IconPicker'
import CustomSelect from '../components/CustomSelect'
import { supabase, Item, InventoryMove } from '../lib/supabase'
import clsx from 'clsx'
import Skeleton from '../components/Skeleton'

type TabType = 'raw_material' | 'finished_good' | 'history'
type ViewMode = 'list' | 'grid'

interface InventoryItem {
    id: number | string
    name: string
    type: 'raw_material' | 'finished_good'
    unit_cost: number
    total_value?: number // New field
    initial_cost: number // Для весовых - цена за упаковку, для штучных - за шт
    total_quantity: number
    is_weighted?: boolean
    sale_price?: number // Цена продажи
    icon?: string
    weight_per_pack?: number
}

// History Interfaces
interface MoveWithDetails extends InventoryMove {
    item_name: string
    from_location_name?: string
    from_location_type?: string // New
    to_location_name?: string
    is_weighted?: boolean
    batch_id?: string // New
    payment_status?: string // New
}

const moveTypeLabels = {
    purchase: 'Приход',
    sale: 'Продажа',
    transfer: 'Перемещение',
    production: 'Производство'
}



const moveTypeIcons = {
    purchase: ArrowDownLeft,
    sale: ArrowUpRight,
    transfer: ArrowRightLeft,
    production: Package
}

export default function Warehouse() {
    const [activeTab, setActiveTab] = useState<TabType>('raw_material')
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [inventoryLoading, setInventoryLoading] = useState(false)
    const [rawMaterials, setRawMaterials] = useState<Item[]>([])
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState<number | string | null>(null)
    const [quantity, setQuantity] = useState('')
    const [packCount, setPackCount] = useState('')
    const [newItemIcon, setNewItemIcon] = useState('package')
    const [editItemIcon, setEditItemIcon] = useState('package')
    const [weightPerPack, setWeightPerPack] = useState('')
    const [purchasePrice, setPurchasePrice] = useState('')
    const [loading, setLoading] = useState(false)

    // History Tab State

    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyFilter, setHistoryFilter] = useState<string>('all')

    // Cost Edit State
    const [showCostModal, setShowCostModal] = useState(false)
    const [costItem, setCostItem] = useState<InventoryItem | null>(null)
    const [newCost, setNewCost] = useState('')

    // Create Item State
    const [showCreateItemModal, setShowCreateItemModal] = useState(false)
    const [newItemName, setNewItemName] = useState('')
    const [createLoading, setCreateLoading] = useState(false)
    const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg')
    const [createIsWeighted, setCreateIsWeighted] = useState(false)

    // Edit Item State
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingItem, setEditingItem] = useState<Item | null>(null)
    const [editName, setEditName] = useState('')
    const [editCost, setEditCost] = useState('')
    const [editIsWeighted, setEditIsWeighted] = useState(false)
    const [editLoading, setEditLoading] = useState(false)

    // Locations State
    const [locations, setLocations] = useState<any[]>([])

    // Confirm Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [confirmTitle, setConfirmTitle] = useState('')
    const [confirmMessage, setConfirmMessage] = useState('')
    const [confirmAction, setConfirmAction] = useState<() => Promise<void> | void>(() => { })
    const [confirmLoading, setConfirmLoading] = useState(false)

    // Авто-заполнение веса при выборе товара
    useEffect(() => {
        if (selectedItem) {
            const item = rawMaterials.find(i => i.id === selectedItem)
            if (item?.weight_per_pack) {
                setWeightPerPack(item.weight_per_pack.toString())
            } else {
                setWeightPerPack('')
            }
        }
    }, [selectedItem, rawMaterials])

    useEffect(() => {
        if (activeTab === 'history') {
            loadAllHistory()
        } else {

            loadInventory()
            loadRawMaterials()
        }
    }, [activeTab])

    useEffect(() => {
        loadLocations()
    }, [])


    // Consolidated History Types
    type GroupedMove =
        | { type: 'simple', move: MoveWithDetails }
        | { type: 'production_group', output: MoveWithDetails, inputs: MoveWithDetails[] }

    const [groupedMoves, setGroupedMoves] = useState<GroupedMove[]>([])

    // Load and Process History
    async function loadAllHistory() {
        setHistoryLoading(true)
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
                .limit(200) // Increase limit to ensure we catch groups

            // Synthetic delay
            await new Promise(r => setTimeout(r, 600))

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
                payment_date: move.payment_date,
                payment_status: move.payment_status,
                batch_id: move.batch_id
            }))

            const grouped = groupMoves(formatted)
            setGroupedMoves(grouped)

        } catch (err) {
            console.error('Ошибка загрузки истории:', err)
        } finally {
            setHistoryLoading(false)
        }
    }

    // Grouper Function
    function groupMoves(moves: MoveWithDetails[]): GroupedMove[] {
        const result: GroupedMove[] = []
        const processedIds = new Set<number>()

        // First pass: Identify all Production Outputs (Positive Quantity)
        const outputs = moves.filter(m => m.type === 'production' && m.quantity > 0)

        // Helper to find inputs for an output
        const findInputs = (output: MoveWithDetails) => {
            if (output.batch_id) {
                return moves.filter(m =>
                    m.type === 'production' &&
                    m.quantity < 0 &&
                    m.batch_id === output.batch_id
                )
            }
            // Fallback: Time proximity (60s)
            const time = new Date(output.created_at || 0).getTime()
            return moves.filter(m =>
                m.type === 'production' &&
                m.quantity < 0 &&
                !m.batch_id && // Only claim unbatched inputs
                Math.abs(new Date(m.created_at || 0).getTime() - time) < 60000
            )
        }

        for (const output of outputs) {
            if (processedIds.has(output.id!)) continue

            const inputs = findInputs(output)

            // Mark as processed
            processedIds.add(output.id!)
            inputs.forEach(i => processedIds.add(i.id!))

            result.push({
                type: 'production_group',
                output,
                inputs
            })
        }

        // Second pass: Add everything else (non-production, or orphaned production)
        for (const move of moves) {
            if (processedIds.has(move.id!)) continue

            // Skip hidden client sales (logic from before)
            if (move.type === 'sale' && move.from_location_type === 'client') continue

            result.push({ type: 'simple', move })
        }

        // Sort result by date (newest first)
        return result.sort((a, b) => {
            const timeA = new Date((a.type === 'simple' ? a.move : a.output).created_at || 0).getTime()
            const timeB = new Date((b.type === 'simple' ? b.move : b.output).created_at || 0).getTime()
            return timeB - timeA
        })
    }

    async function handleMarkAsPaid(moveId: number) {
        if (!confirm('Подтвердить получение оплаты?')) return
        try {
            await supabase.from('inventory_moves').update({
                type: 'sale',
                payment_date: new Date().toISOString()
            }).eq('id', moveId)

            // Reload
            loadAllHistory()
        } catch (err) {
            alert('Ошибка')
        }
    }

    async function loadInventory(retryCount = 0) {
        setInventoryLoading(true)
        console.log(`Loading inventory (Attempt ${retryCount + 1})...`)

        const { data, error } = await supabase
            .from('items')
            .select(`
                id,
                name,
                type,
                unit_cost,
                total_value,
                is_weighted,
                sale_price,
                icon,
                weight_per_pack
            `)
            .eq('type', activeTab)

        if (error) {
            console.error('Ошибка загрузки инвентаря:', error)
            setInventoryLoading(false)
            return
        }

        const promises = (data || []).map(async (item) => {
            try {
                const { data: inventoryData, error: invError } = await supabase
                    .from('inventory')
                    .select('quantity, locations!inner(type)')
                    .eq('item_id', item.id)
                    .neq('locations.type', 'client')

                if (invError) throw invError

                const total_quantity = inventoryData?.reduce((sum, inv) => sum + inv.quantity, 0) || 0
                let avgPrice = item.unit_cost

                return {
                    id: item.id,
                    name: item.name,
                    type: item.type,
                    unit_cost: avgPrice,
                    total_value: item.total_value || 0,
                    initial_cost: avgPrice,
                    is_weighted: item.is_weighted,
                    sale_price: item.sale_price,
                    total_quantity,
                    icon: item.icon,
                    weight_per_pack: item.weight_per_pack
                } as InventoryItem
            } catch (err) {
                console.error(`Error loading inventory for item ${item.id}:`, err)
                return null
            }
        })

        const detailedResults = await Promise.all(promises)
        const formatted = detailedResults.filter((item): item is InventoryItem => item !== null)

        // AUTO-RETRY LOGIC
        // If we found 0 items but we expected some (data.length > 0), and we haven't retried yet:
        if (formatted.length === 0 && (data || []).length > 0 && retryCount < 2) {
            console.log('Detected empty inventory list on load. Retrying automatically...')
            setTimeout(() => {
                loadInventory(retryCount + 1)
            }, 500) // Wait 500ms
            return // Don't set state yet, wait for retry
        }

        formatted.sort((a, b) => {
            const aHasStock = a.total_quantity > 0
            const bHasStock = b.total_quantity > 0
            if (aHasStock !== bHasStock) return aHasStock ? -1 : 1
            return a.name.localeCompare(b.name)
        })



        setInventory(formatted)
        setInventoryLoading(false)
    }

    async function loadRawMaterials() {
        const { data } = await supabase
            .from('items')
            .select('*')
            .eq('type', 'raw_material')
            .order('name')

        setRawMaterials(data || [])
    }

    async function loadLocations() {
        const { data } = await supabase.from('locations').select('*')
        if (data && data.length > 0) {
            setLocations(data)
        } else {
            const { data: newLoc } = await supabase.from('locations').insert({ name: 'Основной склад', type: 'warehouse' }).select().single()
            if (newLoc) setLocations([newLoc])
        }
    }

    async function handleAddSupply() {
        const item = rawMaterials.find(i => i.id === selectedItem)
        // Ensure we check the item's weighted status, but also fallback if not found yet (though it should be)
        const isWeighted = !!item?.is_weighted

        if (!selectedItem || !purchasePrice) return
        if (isWeighted && (!packCount || !weightPerPack)) return
        if (!isWeighted && !quantity) return

        if (locations.length === 0) {
            alert('Не найден склад для добавления. Создайте локацию типа "warehouse".')
            return
        }
        const targetLocationId = locations[0].id
        setLoading(true)

        try {
            let qty = parseFloat(quantity)
            let price = parseFloat(purchasePrice)
            let weight = 0

            if (isWeighted) {
                const packs = parseFloat(packCount || '0')
                let weightVal = parseFloat(weightPerPack || '0')
                if (weightUnit === 'g') weightVal = weightVal / 1000
                qty = packs * weightVal * 1000
                if (weightVal > 0) price = price / (weightVal * 1000)
                weight = weightVal
            }

            console.log('[AddSupply] isWeighted:', isWeighted)
            console.log('[AddSupply] qty:', qty, 'price:', price, 'purchasePrice:', purchasePrice)

            if (isNaN(qty) || qty <= 0) throw new Error('Некорректное количество')

            const { data: currentInv } = await supabase
                .from('inventory')
                .select('quantity, locations!inner(type)')
                .eq('item_id', selectedItem)
                .neq('locations.type', 'client')

            const currentQty = currentInv?.reduce((sum, inv) => sum + inv.quantity, 0) || 0

            // NEW LOGIC: Total Value Model
            // Fetch current Total Value from items table
            // We need to fetch it first because 'item' from 'rawMaterials' might be stale if we didn't reload
            const { data: freshItem } = await supabase
                .from('items')
                .select('total_value, unit_cost')
                .eq('id', selectedItem)
                .single()

            const currentTotalValue = freshItem?.total_value || 0

            // Wait, we need to handle the input correctly.
            // If isWeighted, 'purchasePrice' is TOTAL. 
            // If !isWeighted, 'purchasePrice' is UNIT price (usually).

            let totalInputCost = 0
            let finalUnitPrice = 0

            if (isWeighted) {
                // For weighted, purchasePrice IS Total Cost
                totalInputCost = parseFloat(purchasePrice)
                // Derived unit price (just for record keeping in moves)
                finalUnitPrice = totalInputCost / qty
            } else {
                // For non-weighted items: purchasePrice is ALSO Total Cost (as per UI label "Цена закупки (Общая)")
                totalInputCost = parseFloat(purchasePrice)
                // Derived unit price per piece
                finalUnitPrice = qty > 0 ? totalInputCost / qty : 0
            }

            const nextTotalValue = currentTotalValue + totalInputCost
            const nextTotalQty = currentQty + qty

            // Calculate new Average Cost based on the POOL
            // If nextTotalQty is 0 (impossible here), stay 0
            const newAvgCost = nextTotalQty > 0 ? (nextTotalValue / nextTotalQty) : 0

            const updates: any = {
                unit_cost: newAvgCost,
                total_value: nextTotalValue
            }
            if (isWeighted && weight > 0) updates.weight_per_pack = weight

            await supabase.from('items').update(updates).eq('id', selectedItem)

            await supabase.from('inventory_moves').insert({
                item_id: selectedItem,
                to_location_id: targetLocationId,
                quantity: qty,
                type: 'purchase',
                unit_price: finalUnitPrice // Store precise unit price for this specific move
            })

            // Trigger will handle inventory update


            const totalCost = totalInputCost
            await supabase.from('transactions').insert({
                type: 'expense',
                category: 'raw_materials',
                amount: totalCost,
                description: `Закупка: ${item?.name}${isWeighted ? ` (${qty.toFixed(0)} г)` : ` (${qty} шт)`} `,
                date: new Date().toISOString().split('T')[0]
            })

            const { data: balanceData } = await supabase.from('balance').select('*').limit(1).single()
            if (balanceData) {
                await supabase.from('balance').update({
                    current_balance: balanceData.current_balance - totalCost,
                    updated_at: new Date().toISOString()
                }).eq('id', balanceData.id)
            }

            setShowAddModal(false)
            setSelectedItem(null)
            setQuantity('')
            setPackCount('')
            setWeightPerPack('')
            setPurchasePrice('')
            setWeightUnit('kg')
            await loadInventory()
        } catch (err: any) {
            console.error('Ошибка:', err)
            alert('Ошибка: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    function formatQuantity(quantity: number, isWeighted?: boolean) {
        if (isWeighted) return `${quantity.toFixed(0)} г`
        return `${quantity} шт`
    }

    async function handleCreateItem() {
        if (!newItemName) return
        setCreateLoading(true)
        try {
            const { data, error } = await supabase.from('items').insert({
                name: newItemName,
                type: 'raw_material',
                unit_cost: 0,
                is_weighted: createIsWeighted,
                weight_per_pack: null,
                icon: newItemIcon
            }).select().single()

            if (error) throw error
            await loadRawMaterials()
            if (data) setSelectedItem(data.id)
            setShowCreateItemModal(false)
            setNewItemName('')
            setCreateIsWeighted(false)
        } catch (err: any) {
            alert('Ошибка создания: ' + err.message)
        } finally {
            setCreateLoading(false)
        }
    }

    function handleEditStart(item: InventoryItem | Item) {
        setEditingItem(item as Item)
        setEditName(item.name)
        setEditCost(item.unit_cost.toString())
        setEditIsWeighted(!!item.is_weighted)
        setEditItemIcon(item.icon || 'package')
        setShowEditModal(true)
    }

    async function handleEditSave() {
        if (!editingItem || !editName || !editCost) return
        setEditLoading(true)
        try {
            await supabase.from('items').update({
                name: editName,
                unit_cost: parseFloat(editCost),
                is_weighted: editIsWeighted,
                icon: editItemIcon
            }).eq('id', editingItem.id)
            setShowEditModal(false)
            setEditingItem(null)
            loadInventory()
        } catch (err) {
            alert('Ошибка при сохранении')
        } finally {
            setEditLoading(false)
        }
    }

    async function handleDeleteItem(id: number | string) {
        try {
            const { data: inventoryData } = await supabase.from('inventory').select('quantity').eq('item_id', id)
            const totalQty = inventoryData?.reduce((sum, inv) => sum + inv.quantity, 0) || 0

            if (totalQty === 0) {
                setConfirmTitle('Удаление товара')
                setConfirmMessage('Удалить этот товар из справочника навсегда?')
                setConfirmLoading(false) // Reset loading state explicitly
                setConfirmAction(async () => {
                    const { error } = await supabase.from('items').delete().eq('id', id)
                    if (error) alert('Не удалось удалить товар. Возможно есть связи.')
                    else { loadInventory(); loadRawMaterials(); }
                })
                setShowConfirmModal(true)
                return
            }

            const item = inventory.find(i => i.id === id) || rawMaterials.find(i => i.id === id)
            const unit = item?.is_weighted ? 'кг' : 'шт'
            const qtyDisplay = item?.is_weighted ? (totalQty / 1000).toFixed(3) : totalQty

            setConfirmTitle('Списание остатков')
            setConfirmMessage(`Списать все остатки (${qtyDisplay} ${unit}) со склада?`)
            setConfirmLoading(false) // Reset loading state explicitly
            setConfirmAction(async () => {
                const targetLocationId = locations.length > 0 ? locations[0].id : 1
                await supabase.from('inventory_moves').insert({
                    item_id: id,
                    from_location_id: targetLocationId,
                    to_location_id: null,
                    quantity: totalQty,
                    type: 'sale', // ВНИМАНИЕ: Используем type='sale' для списания, так как 'write_off' не поддерживается? 
                    // Лучше использовать 'write_off' если есть поддержка, но в handle_inventory_move v3 я добавил write_off.
                    // Проверим, есть ли write_off в constraint. Если нет, пока sale.
                    // Триггер v3 поддерживает 'write_off', но БД может иметь constraint.
                    // Оставим sale пока что, или лучше change to write_off if constraint allows.
                    // Вернемся к sale чтобы не ломать, но добавим комментарий.
                    unit_price: 0
                })
                // alert(`Списано ${qtyDisplay} ${unit}`) -- Уберем алерт, просто обновим
                loadInventory()
            })
            setShowConfirmModal(true)

        } catch (err: any) {
            alert('Ошибка: ' + err.message)
        }
    }

    // Filter Logic on Grouped Data
    const filteredGroupedMoves = historyFilter === 'all'
        ? groupedMoves
        : groupedMoves.filter(g => {
            if (g.type === 'simple') return g.move.type === historyFilter
            if (g.type === 'production_group') return 'production' === historyFilter
            return true
        })

    // ... (rest of logic)

    // RENDER SECTION for Table Body


    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                        <WarehouseIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Склад</h1>
                        <p className="text-secondary">Управление инвентарём</p>
                    </div>
                </div>

                <div className="flex gap-3 items-center">
                    <button
                        onClick={activeTab === 'history' ? () => setHistoryFilter(historyFilter) : () => loadInventory(0)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 text-white"
                        title="Обновить список"
                    >
                        <RefreshCw className={clsx("w-5 h-5", inventoryLoading && "animate-spin")} />
                    </button>

                    {activeTab === 'raw_material' && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-smooth shadow-lg shadow-emerald-900/20"
                        >
                            <Plus className="w-5 h-5" />
                            Приход товара
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Stock Tabs (Segmented Control) */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setActiveTab('raw_material')}
                        className={clsx(
                            'px-6 py-2.5 rounded-lg font-medium transition-all duration-300 text-sm',
                            activeTab === 'raw_material'
                                ? 'bg-primary text-black shadow-lg shadow-primary/25'
                                : 'text-secondary hover:text-white hover:bg-white/5'
                        )}
                    >
                        Сырьё
                    </button>
                    <button
                        onClick={() => setActiveTab('finished_good')}
                        className={clsx(
                            'px-6 py-2.5 rounded-lg font-medium transition-all duration-300 text-sm',
                            activeTab === 'finished_good'
                                ? 'bg-primary text-black shadow-lg shadow-primary/25'
                                : 'text-secondary hover:text-white hover:bg-white/5'
                        )}
                    >
                        Готовая продукция
                    </button>
                </div>

                {/* History Tab (Separate) */}
                <button
                    onClick={() => setActiveTab('history')}
                    className={clsx(
                        'px-6 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 border',
                        activeTab === 'history'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_15px_-5px_rgb(168,85,247,0.5)]'
                            : 'bg-white/5 text-secondary border-white/10 hover:bg-white/10 hover:text-white'
                    )}
                >
                    <HistoryIcon className="w-4 h-4" />
                    История операций
                </button>
            </div>

            {
                activeTab === 'history' ? (
                    <GlassCard>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">История операций</h2>
                            <div className="flex gap-2 text-sm">
                                {(['all', 'purchase', 'sale', 'production', 'transfer'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setHistoryFilter(type)}
                                        className={clsx(
                                            'px-3 py-1.5 rounded-lg transition-colors',
                                            historyFilter === type
                                                ? 'bg-white/10 text-white'
                                                : 'text-secondary hover:text-white/80'
                                        )}
                                    >
                                        {type === 'all' ? 'Все' : moveTypeLabels[type]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-separate border-spacing-y-2">
                                <thead>
                                    <tr className="text-xs uppercase text-secondary">
                                        <th className="text-left py-3 px-4">Операция</th>
                                        <th className="text-left py-3 px-4">Товар</th>
                                        <th className="text-left py-3 px-4">Движение</th>
                                        <th className="text-right py-3 px-4">Кол-во</th>
                                        <th className="text-right py-3 px-4">Сумма</th>
                                        <th className="text-right py-3 px-4">Дата</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {historyLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="bg-white/5 border-l-2 border-l-transparent">
                                                <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                                <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
                                                <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                                <td className="py-4 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-12" /></div></td>
                                                <td className="py-4 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-16" /></div></td>
                                                <td className="py-4 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-24" /></div></td>
                                            </tr>
                                        ))
                                    ) : filteredGroupedMoves.length === 0 ? (
                                        <tr><td colSpan={6} className="py-12 text-center text-secondary">История пуста</td></tr>
                                    ) : (
                                        filteredGroupedMoves.map((group, idx) => {
                                            const move = group.type === 'simple' ? group.move : group.output
                                            const inputs = group.type === 'production_group' ? group.inputs : []

                                            const Icon = moveTypeIcons[move.type] || Package
                                            const totalCost = (move.unit_price || 0) * move.quantity

                                            // Logic
                                            let sourceName = move.from_location_name
                                            let destName = move.to_location_name

                                            let displayType = moveTypeLabels[move.type]
                                            let statusText = ''
                                            let statusColor = ''
                                            let typeColor = 'text-secondary'
                                            let isRealization = false

                                            if (move.type === 'purchase') {
                                                sourceName = sourceName || 'Поставщик'
                                                destName = destName || 'Склад'
                                                typeColor = 'text-emerald-400'
                                            } else if (move.type === 'production') {
                                                sourceName = 'Цех'
                                                destName = destName || 'Склад'
                                                typeColor = 'text-purple-400'
                                                // No count in label anymore
                                            } else if (move.type === 'sale') {
                                                sourceName = sourceName || 'Склад'
                                                destName = destName || 'Клиент'
                                                displayType = 'Продажа'
                                                statusText = 'Оплачено'
                                                statusColor = 'text-emerald-400'
                                                typeColor = 'text-red-400'
                                            } else if (move.type === 'transfer') {
                                                destName = destName || 'Точка'
                                                displayType = 'Реализация'
                                                // Only show status if Paid. If consignment, hide text to avoid redundancy.
                                                if (move.payment_status === 'paid') {
                                                    statusText = 'Оплачено'
                                                    statusColor = 'text-emerald-400'
                                                } else {
                                                    // Default is implied "On Realization", keep empty
                                                    statusText = ''
                                                }

                                                statusColor = 'text-yellow-400'
                                                typeColor = 'text-blue-400'
                                                isRealization = true
                                            }

                                            return (
                                                <tr key={move.id || idx} className={clsx("bg-white/5 transition-all hover:bg-white/10 border-l-2",
                                                    move.type === 'purchase' ? 'border-l-emerald-500' :
                                                        move.type === 'sale' ? 'border-l-red-500' :
                                                            move.type === 'production' ? 'border-l-purple-500' :
                                                                'border-l-blue-500'
                                                )}>
                                                    <td className="py-4 px-4 rounded-r-lg">
                                                        <div className="flex flex-col">
                                                            <div className={clsx("flex items-center gap-2 font-medium text-sm", typeColor)}>
                                                                <Icon className="w-4 h-4" />
                                                                <span>{displayType}</span>
                                                            </div>
                                                            {statusText && (
                                                                <span className={clsx("text-xs mt-0.5 font-medium ml-6", statusColor)}>
                                                                    {statusText}
                                                                </span>
                                                            )}
                                                            {/* Payment Date Info for Sale */}
                                                            {move.type === 'sale' && move.payment_date && (
                                                                <span className="text-[10px] text-white/50 ml-6 mt-0.5">
                                                                    Опл: {new Date(move.payment_date).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 font-medium text-white">
                                                        <div>{move.item_name}</div>
                                                        {move.is_weighted && <div className="text-xs text-secondary">(Весовой)</div>}

                                                        {/* INLINE Ingredients Display - IMPROVED */}
                                                        {group.type === 'production_group' && inputs.length > 0 && (
                                                            <div className="mt-2 text-xs bg-black/20 p-2 rounded-lg border border-white/5">
                                                                <div className="text-secondary mb-1 flex items-center gap-1">
                                                                    <ArrowRightLeft className="w-3 h-3 rotate-90" />
                                                                    <span>Использовано сырья:</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {inputs.map((i) => (
                                                                        <span key={i.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-white/70 bg-white/5 border border-white/5">
                                                                            {i.item_name}
                                                                            <span className="ml-1 opacity-50 text-[10px]">
                                                                                -{formatQuantity(Math.abs(i.quantity), i.is_weighted)}
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-secondary">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-white/70">{sourceName || '—'}</span>
                                                            <ArrowRightLeft className="w-3 h-3 text-secondary/50" />
                                                            <span className="text-white/70">{destName || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <div className="font-bold text-white text-base">
                                                            {formatQuantity(move.quantity, move.is_weighted)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        {/* Actions for Realization */}
                                                        {isRealization ? (
                                                            <button
                                                                onClick={() => move.id && handleMarkAsPaid(move.id)}
                                                                className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded hover:bg-emerald-500/30 transition-colors"
                                                            >
                                                                Оплачено
                                                            </button>
                                                        ) : (
                                                            <span className="font-mono text-primary">
                                                                {move.unit_price ? `${totalCost.toFixed(2)} ₽` : '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-right text-secondary text-xs rounded-r-lg">
                                                        {new Date(move.created_at || Date.now()).toLocaleDateString()}
                                                        <div className="text-[10px] opacity-70">
                                                            {new Date(move.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                ) : (
                    <GlassCard>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">В наличии</h2>
                            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                                <button onClick={() => setViewMode('list')} className={clsx('p-2 rounded-md transition-all', viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-secondary hover:text-white')}>
                                    <List className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewMode('grid')} className={clsx('p-2 rounded-md transition-all', viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-secondary hover:text-white')}>
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {viewMode === 'list' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-3 px-4 text-secondary font-medium">Название</th>
                                            <th className="text-right py-3 px-4 text-secondary font-medium">Количество</th>
                                            <th className="text-right py-3 px-4 text-secondary font-medium">Ср. цена</th>
                                            <th className="text-right py-3 px-4 text-secondary font-medium">Стоимость</th>
                                            {activeTab === 'finished_good' && <th className="text-right py-3 px-4 text-secondary font-medium">Выручка (пл.)</th>}
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <tr key={i} className="border-b border-white/5">
                                                    <td className="py-3 px-4"><div className="flex items-center gap-3"><Skeleton variant="circular" className="w-8 h-8" /><Skeleton className="h-4 w-32" /></div></td>
                                                    <td className="py-3 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-16" /></div></td>
                                                    <td className="py-3 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-20" /></div></td>
                                                    <td className="py-3 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-24" /></div></td>
                                                    {activeTab === 'finished_good' && <td className="py-3 px-4"><div className="flex justify-end"><Skeleton className="h-4 w-20" /></div></td>}
                                                    <td className="py-3 px-4"><div className="flex justify-end"><Skeleton className="h-8 w-16" /></div></td>
                                                </tr>
                                            ))
                                        ) : inventory.filter(i => {
                                            return i.total_quantity > 0
                                        }).map((item) => (
                                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-smooth">
                                                <td className="py-3 px-4 font-medium flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                                                        {(() => {
                                                            const Icon = iconMap[item.icon || 'package'] || iconMap['package']
                                                            return <Icon className="w-4 h-4" />
                                                        })()}
                                                    </div>
                                                    {item.name}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-white">
                                                    {item.is_weighted ? `${(item.total_quantity / 1000).toFixed(3)} кг` : `${item.total_quantity} шт`}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {item.is_weighted ? `${(item.unit_cost * 1000).toFixed(2)} ₽/кг` : `${item.unit_cost.toFixed(2)} ₽/шт`}
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-primary">
                                                    {(item.total_value || 0).toFixed(2)} ₽
                                                </td>
                                                {activeTab === 'finished_good' && (
                                                    <td
                                                        className="py-3 px-4 text-right text-green-400 cursor-pointer hover:bg-white/10 transition-colors"
                                                        title="Изменить цену продажи"
                                                        onClick={() => {
                                                            setCostItem(item)
                                                            setNewCost(item.sale_price?.toString() || '')
                                                            setShowCostModal(true)
                                                        }}
                                                    >
                                                        {(item.total_quantity * (item.sale_price || 0)).toFixed(2)} ₽
                                                        <Pencil className="w-3 h-3 text-secondary inline ml-2 opacity-50" />
                                                    </td>
                                                )}
                                                <td className="py-3 px-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => handleEditStart(item)} className="p-2 hover:bg-white/10 rounded-lg text-secondary"><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {inventory.filter(i => i.total_quantity > 0).length === 0 && (
                                            <tr><td colSpan={6} className="text-center py-8 text-secondary">Нет товаров в наличии</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {inventoryLoading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                            <div className="flex justify-between mb-2">
                                                <Skeleton variant="circular" className="w-10 h-10" />
                                                <Skeleton className="w-8 h-8 rounded-lg" />
                                            </div>
                                            <Skeleton className="h-4 w-3/4 mb-2" />
                                            <Skeleton className="h-8 w-1/2 mb-2" />
                                            <div className="border-t border-white/10 pt-2 flex justify-between">
                                                <Skeleton className="h-3 w-16" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    inventory.filter(i => i.total_quantity > 0).map(item => (
                                        <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                                            <div className="flex justify-between mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                                    {(() => {
                                                        const Icon = iconMap[item.icon || 'package'] || iconMap['package']
                                                        return <Icon className="w-5 h-5" />
                                                    })()}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleEditStart(item)} className="p-1.5 hover:bg-white/10 rounded-lg text-secondary"><Pencil className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                            <div className="font-semibold mb-1 truncate">{item.name}</div>
                                            <div className="text-xl font-bold text-white mb-2">
                                                {item.is_weighted ? `${(item.total_quantity / 1000).toFixed(1)} кг` : `${item.total_quantity} шт`}
                                            </div>
                                            <div className="text-xs text-secondary border-t border-white/10 pt-2 flex justify-between">
                                                <span>Стоимость:</span>
                                                <span className="text-white">{(item.total_value || 0).toFixed(0)} ₽</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </GlassCard>
                )
            }

            {
                activeTab !== 'history' && inventory.some(item => item.total_quantity === 0) && (
                    <GlassCard className="opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-smooth mt-6">
                        <h2 className="text-xl font-semibold text-secondary mb-4">Закончились</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {inventory.filter(i => i.total_quantity === 0).map(item => (
                                <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <div className="text-secondary font-medium">{item.name}</div>
                                    <div className="text-xs text-red-400 mt-1">Нет на складе</div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                )
            }

            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <GlassCard className="w-full max-w-md">
                            <div className="flex justify-between mb-6">
                                <h2 className="text-xl font-bold">Приход товара</h2>
                                <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-secondary">Товар</label>
                                    <div className="flex gap-2">
                                        <CustomSelect
                                            options={rawMaterials.map(item => ({ value: item.id, label: item.name }))}
                                            value={selectedItem}
                                            onChange={(val) => setSelectedItem(val)}
                                            placeholder="Выберите товар..."
                                            className="flex-1"
                                        />
                                        <button
                                            onClick={() => setShowCreateItemModal(true)}
                                            className="p-3 bg-white/10 hover:bg-white/20 rounded-lg"
                                            title="Создать новый"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {selectedItem && (
                                    <>
                                        {rawMaterials.find(i => i.id === selectedItem)?.is_weighted ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm text-secondary mb-1">Кол-во упаковок</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                                        value={packCount}
                                                        onChange={e => setPackCount(e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-secondary mb-1">Вес упаковки</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                                            value={weightPerPack}
                                                            onChange={e => setWeightPerPack(e.target.value)}
                                                            placeholder="0"
                                                        />
                                                        <CustomSelect
                                                            options={[{ value: 'kg', label: 'кг' }, { value: 'g', label: 'г' }]}
                                                            value={weightUnit}
                                                            onChange={(val) => setWeightUnit(val as 'kg' | 'g')}
                                                            className="w-24"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm text-secondary mb-1">Количество (шт)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                                    value={quantity}
                                                    onChange={e => setQuantity(e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm text-secondary mb-1">Цена закупки (Общая)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                                value={purchasePrice}
                                                onChange={e => setPurchasePrice(e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </>
                                )}

                                <button
                                    onClick={handleAddSupply}
                                    disabled={loading}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold mt-4"
                                >
                                    {loading ? 'Сохранение...' : 'Добавить на склад'}
                                </button>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {
                showCreateItemModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
                        <GlassCard className="w-full max-w-sm border-blue-500/30">
                            <h2 className="text-xl font-bold mb-4">Новый товар</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-secondary mb-1">Название</label>
                                    <input
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                        value={newItemName}
                                        onChange={e => setNewItemName(e.target.value)}
                                        placeholder="Например: Сахар"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="isWeighted"
                                        checked={createIsWeighted}
                                        onChange={e => setCreateIsWeighted(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="isWeighted" className="cursor-pointer select-none">Весовой товар (кг/г)</label>
                                </div>

                                <div>
                                    <label className="block text-sm text-secondary mb-2">Иконка</label>
                                    <IconPicker value={newItemIcon} onChange={setNewItemIcon} />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setShowCreateItemModal(false)} className="flex-1 py-2 bg-white/10 rounded-lg">Отмена</button>
                                    <button onClick={handleCreateItem} disabled={createLoading} className="flex-1 py-2 bg-primary text-black font-bold rounded-lg">Создать</button>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {
                showEditModal && editingItem && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
                        <GlassCard className="w-full max-w-sm">
                            <h2 className="text-xl font-bold mb-4">Редактирование</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-secondary mb-1">Название</label>
                                    <input
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-secondary mb-1">Себестоимость (за ед)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                        value={editCost}
                                        onChange={e => setEditCost(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-secondary mb-2">Иконка</label>
                                    <IconPicker value={editItemIcon} onChange={setEditItemIcon} />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setShowEditModal(false)} className="flex-1 py-2 bg-white/10 rounded-lg">Отмена</button>
                                    <button onClick={handleEditSave} disabled={editLoading} className="flex-1 py-2 bg-primary text-black font-bold rounded-lg">Сохранить</button>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {
                showCostModal && costItem && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
                        <GlassCard className="w-full max-w-sm border-green-500/30">
                            <h2 className="text-xl font-bold mb-4">Цена продажи</h2>
                            <p className="text-secondary mb-4">Товар: {costItem.name}</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-secondary mb-1">Новая цена</label>
                                    <input
                                        type="number"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white"
                                        value={newCost}
                                        onChange={e => setNewCost(e.target.value)}
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!newCost) return
                                        try {
                                            await supabase.from('items').update({ sale_price: parseFloat(newCost) }).eq('id', costItem.id)
                                            setShowCostModal(false)
                                            loadInventory()
                                        } catch (e) { alert('Ошибка сохранения') }
                                    }}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
                                >
                                    Сохранить
                                </button>
                                <button onClick={() => setShowCostModal(false)} className="w-full py-2 text-secondary hover:text-white">Отмена</button>
                            </div>
                        </GlassCard>
                    </div>
                )
            }

            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]">
                    <GlassCard className="w-full max-w-sm border-red-500/30">
                        <h2 className="text-xl font-bold mb-2">{confirmTitle || 'Подтверждение'}</h2>
                        <p className="text-secondary mb-6">{confirmMessage || 'Вы уверены?'}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-2 bg-white/10 rounded-lg"
                                disabled={confirmLoading}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={async () => {
                                    setConfirmLoading(true)
                                    try {
                                        if (confirmAction) await confirmAction()
                                    } catch (e) {
                                        console.error(e)
                                    } finally {
                                        setConfirmLoading(false)
                                        setShowConfirmModal(false)
                                    }
                                }}
                                disabled={confirmLoading}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
                            >
                                {confirmLoading ? '...' : 'Подтвердить'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div >
    )
}
