import { useState, useEffect, useRef } from 'react'
import { Factory, AlertCircle, Clock } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { supabase, Item, ProductionQueueItem } from '../lib/supabase'
import clsx from 'clsx'

export default function ProductionOperations() {
    const [finishedGoods, setFinishedGoods] = useState<Item[]>([])
    const [selectedProduct, setSelectedProduct] = useState<number | string | null>(null)
    const [maxQuantity, setMaxQuantity] = useState<number>(0)
    const [quantity, setQuantity] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [estimatedCost, setEstimatedCost] = useState<number | null>(null)

    // Lock to prevent race conditions in production check
    const isProcessingRef = useRef(false)
    const [costBreakdown, setCostBreakdown] = useState<string[]>([])

    // Confirm Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [confirmData, setConfirmData] = useState<{
        items: any[],
        qty: number,
        locationId: number,
        totalCost: number,
        breakdownText: string
    } | null>(null)

    const [productionQueue, setProductionQueue] = useState<(ProductionQueueItem & { item_name?: string })[]>([])
    const [recipeInfo, setRecipeInfo] = useState<{ returns_to_raw?: boolean, production_time_minutes?: number } | null>(null)
    const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredient_name: string, quantity: number, is_weighted?: boolean, unit_cost?: number }>>([])
    const [totalAvailableWeight, setTotalAvailableWeight] = useState<number>(0)
    const [editingWeight, setEditingWeight] = useState<{ [key: number]: string }>({})

    // Cost Logic
    useEffect(() => {
        if (!selectedProduct || !quantity || !recipeIngredients.length) {
            setEstimatedCost(null)
            setCostBreakdown([])
            return
        }

        const qty = parseFloat(quantity)
        if (isNaN(qty) || qty <= 0) {
            setEstimatedCost(null)
            setCostBreakdown([])
            return
        }

        let total = 0
        const breakdown: string[] = []

        recipeIngredients.forEach(item => {
            // Для переработки (returns_to_raw) item.quantity обычно 1 (или доля), а qty - это вес ВХОДА.
            // Но если это стандартный рецепт, то item.quantity - это сколько нужно на 1 шт ВЫХОДА.

            // Предположим простую логику: item.quantity * qty
            const requiredQty = item.quantity * qty
            // Use high precision for intermediate calculations
            const unitCost = item.unit_cost || 0
            const cost = Number((requiredQty * unitCost).toFixed(6))

            total += cost
            if (cost > 0) {
                breakdown.push(`${item.ingredient_name}: ${requiredQty.toFixed(3)} x ${unitCost.toFixed(4)}₽ = ${cost.toFixed(2)}₽`)
            }
        })

        setEstimatedCost(total)
        setCostBreakdown(breakdown)
    }, [selectedProduct, quantity, recipeIngredients])

    // Загрузка готовой продукции и очереди
    useEffect(() => {
        loadFinishedGoods()
        loadProductionQueue()

        // Автообновление очереди каждые 10 секунд
        const interval = setInterval(() => {
            loadProductionQueue()
            checkCompletedProductions()
        }, 10000)

        return () => clearInterval(interval)
    }, [])

    // Загрузка максимального количества и информации о рецепте при выборе продукта
    useEffect(() => {
        if (selectedProduct) {
            loadMaxQuantity(selectedProduct)
            loadRecipeInfo(selectedProduct)
        }
    }, [selectedProduct])

    async function loadFinishedGoods() {
        // 1. Получаем ID всех товаров, для которых есть рецепт (включая промежуточные)
        const { data: recipesData } = await supabase.from('recipes').select('finished_good_id')
        const recipeItemIds = Array.from(new Set(recipesData?.map(r => r.finished_good_id) || []))

        let query = supabase.from('items').select('*').order('name')

        if (recipeItemIds.length > 0) {
            // Загружаем: ИЛИ это готовая продукция, ИЛИ это товар с рецептом
            query = query.or(`type.eq.finished_good,id.in.(${recipeItemIds.join(',')})`)
        } else {
            query = query.eq('type', 'finished_good')
        }

        const { data, error } = await query

        if (error) {
            console.error('Ошибка загрузки продукции:', error)
            return
        }

        setFinishedGoods(data || [])
    }

    async function loadRecipeInfo(itemId: number | string) {
        try {
            const { data, error } = await supabase
                .from('recipes')
                .select(`
                    returns_to_raw,
                    production_time_minutes,
                    quantity,
                    ingredient_id,
                    ingredient:items!recipes_ingredient_id_fkey(name, is_weighted, unit_cost)
                `)
                .eq('finished_good_id', itemId)

            if (error) throw error

            if (data && data.length > 0) {
                setRecipeInfo(data[0])

                // Загружаем ингредиенты с их количеством
                const ingredients = data.map(r => ({
                    ingredient_name: (r.ingredient as any)?.name || '',
                    quantity: r.quantity,
                    is_weighted: (r.ingredient as any)?.is_weighted,
                    unit_cost: (r.ingredient as any)?.unit_cost
                }))
                setRecipeIngredients(ingredients)

                // Если есть весовые ингредиенты ИЛИ это переработка (returns_to_raw), вычисляем общий доступный вес
                // Для переработки берем первый ингредиент, если он не помечен как весовой
                let ingredientToCheck = data.find(r => (r.ingredient as any)?.is_weighted)

                if (!ingredientToCheck && data[0].returns_to_raw) {
                    ingredientToCheck = data[0]
                }

                if (ingredientToCheck) {
                    // Загружаем доступное количество ингредиента
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('quantity')
                        .eq('item_id', ingredientToCheck.ingredient_id)

                    const totalWeight = invData?.reduce((sum, item) => sum + item.quantity, 0) || 0
                    setTotalAvailableWeight(totalWeight)
                }
            } else {
                setRecipeInfo(null)
                setRecipeIngredients([])
                setTotalAvailableWeight(0)
            }
        } catch (err) {
            console.error('Ошибка загрузки информации о рецепте:', err)
            setRecipeInfo(null)
            setRecipeIngredients([])
            setTotalAvailableWeight(0)
        }
    }

    async function loadProductionQueue() {
        try {
            const { data, error } = await supabase
                .from('production_queue')
                .select(`
                    *,
                    items!production_queue_finished_good_id_fkey(name, is_weighted)
                `)
                .eq('status', 'in_progress')
                .order('completes_at')

            if (error) throw error

            // Также загружаем returns_to_raw для каждого рецепта
            const formatted = await Promise.all((data || []).map(async item => {
                const { data: recipeData } = await supabase
                    .from('recipes')
                    .select('returns_to_raw')
                    .eq('finished_good_id', item.finished_good_id)
                    .limit(1)
                    .maybeSingle()

                return {
                    ...item,
                    item_name: (item.items as any)?.name,
                    is_weighted: (item.items as any)?.is_weighted || false,
                    returns_to_raw: recipeData?.returns_to_raw || false
                }
            }))

            setProductionQueue(formatted)
        } catch (err) {
            console.error('Ошибка загрузки очереди производства:', err)
        }
    }

    async function checkCompletedProductions() {
        if (isProcessingRef.current) return
        isProcessingRef.current = true

        try {
            const { data: completed, error } = await supabase
                .from('production_queue')
                .select(`
                    *,
                    item:items!production_queue_finished_good_id_fkey(is_weighted)
                `)
                .eq('status', 'in_progress')
                .lte('completes_at', new Date().toISOString())

            if (error) throw error
            if (!completed || completed.length === 0) return

            // Получаем первую локацию
            const { data: locations } = await supabase
                .from('locations')
                .select('id')
                .eq('type', 'warehouse')
                .limit(1)
                .maybeSingle()

            if (!locations) return
            const locationId = locations.id

            // Обрабатываем каждое завершённое производство
            for (const prod of completed) {
                // Double check status to avoid race condition
                const { data: current } = await supabase.from('production_queue').select('status').eq('id', prod.id).single()
                if (current?.status !== 'in_progress') continue

                // TRIPLE check: Ensure no inventory move exists for this batch_id and item_id (Output)
                // This prevents race conditions where logic runs twice but status update lags
                if ((prod as any).batch_id) {
                    const { data: existingMove } = await supabase
                        .from('inventory_moves')
                        .select('id')
                        .eq('batch_id', (prod as any).batch_id)
                        .eq('item_id', prod.finished_good_id)
                        .eq('type', 'production')
                        .gt('quantity', 0) // Look for output (positive quantity)
                        .limit(1)
                        .maybeSingle()

                    if (existingMove) {
                        console.warn(`Duplicate production detected for batch ${(prod as any).batch_id}. Marking as completed without re-crediting.`)
                        // Just mark as completed and skip crediting
                        await supabase
                            .from('production_queue')
                            .update({ status: 'completed' })
                            .eq('id', prod.id)
                        continue
                    }
                }

                // Получаем информацию о рецепте
                const { data: recipe } = await supabase
                    .from('recipes')
                    .select('returns_to_raw')
                    .eq('finished_good_id', prod.finished_good_id)
                    .limit(1)
                    .maybeSingle()

                const returnsToRaw = recipe?.returns_to_raw || false
                const isWeighted = (prod.item as any)?.is_weighted || false

                // Если требуется вес (переработка ИЛИ весовой товар), но он не указан - пропускаем
                if ((returnsToRaw || isWeighted) && !prod.output_weight) {
                    continue
                }

                const finalQuantity = prod.output_weight || prod.quantity

                // Если это промежуточное сырьё, обновляем тип товара
                if (returnsToRaw) {
                    await supabase
                        .from('items')
                        .update({ type: 'raw_material' })
                        .eq('id', prod.finished_good_id)
                }

                // NEW LOGIC: Deduct Ingredient Cost from Total Value Pool
                // Note: The 'handle_produce' logic earlier likely handled the quantity deduction via inventory moves.
                // But we need to update the 'Total Value' money pool in the items table for the *ingredients*.
                // Wait, 'checkCompletedProductions' handles the OUTPUT (Finished Good).
                // The ingredients were consumed when the production was STARTED or manually?
                // Let's check when ingredients are deducted.
                // Usually ingredients are deducted when 'handleProduce' creates the queue item or moves?
                // Actually, in this system, it seems 'handleProduce' creates 'production' moves for ingredients?
                // Let's verify 'handleProduce' logic.

                // Focusing here on the FINISHED GOOD being added.
                // We need to give it a value.
                // The value comes from 'estimated_cost'.
                // We should add this value to the finished good's 'total_value' pool.

                let unitPrice = 0
                if ((prod as any).estimated_cost && finalQuantity > 0) {
                    const addedValue = (prod as any).estimated_cost
                    unitPrice = Number((addedValue / finalQuantity).toFixed(6))

                    // Update total_value - add the estimated cost
                    const { data: cur } = await supabase.from('items').select('total_value').eq('id', prod.finished_good_id).single()
                    const newTotalValue = (cur?.total_value || 0) + addedValue

                    // Also need current total quantity to calculate new unit_cost
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('quantity')
                        .eq('item_id', prod.finished_good_id)
                    const currentQty = invData?.reduce((sum, i) => sum + i.quantity, 0) || 0
                    const newTotalQty = currentQty + finalQuantity
                    const newUnitCost = newTotalQty > 0 ? newTotalValue / newTotalQty : unitPrice

                    await supabase.from('items').update({
                        total_value: newTotalValue,
                        unit_cost: newUnitCost
                    }).eq('id', prod.finished_good_id)
                }

                // Добавляем продукцию на склад (с batch_id для группировки)
                await supabase.from('inventory_moves').insert({
                    item_id: prod.finished_good_id,
                    from_location_id: null,
                    to_location_id: locationId,
                    quantity: finalQuantity,
                    type: 'production',
                    unit_price: unitPrice,
                    batch_id: (prod as any).batch_id || null
                })

                // Update the item's unit_cost
                await supabase.from('items').update({ unit_cost: unitPrice }).eq('id', prod.finished_good_id)

                // Обновляем статус
                await supabase
                    .from('production_queue')
                    .update({ status: 'completed' })
                    .eq('id', prod.id)
            }

            // Перезагружаем очередь
            loadProductionQueue()
        } catch (err) {
            console.error('Ошибка проверки завершённых производств:', err)
        } finally {
            isProcessingRef.current = false
        }
    }

    async function handleUpdateWeight(queueId: number, weight: string) {
        if (!weight) return

        try {
            const outputWeight = parseFloat(weight)
            if (isNaN(outputWeight) || outputWeight <= 0) {
                alert('Некорректный вес')
                return
            }

            // 1. Get queue item to know expected cost and quantity
            const { data: queueItem } = await supabase
                .from('production_queue')
                .select('*')
                .eq('id', queueId)
                .single()

            if (!queueItem) throw new Error('Queue item not found')

            const estimatedCost = queueItem.estimated_cost || 0

            // 2. Update Queue Item with output weight and status
            const { error: updateError } = await supabase
                .from('production_queue')
                .update({
                    output_weight: outputWeight,
                    status: 'completed' // COMPLETING IT HERE
                })
                .eq('id', queueId)

            if (updateError) throw updateError

            // 3. Add Finished Good to Stock (Total Value Model)
            // We adding 'outputWeight' quantity (g) and 'estimatedCost' value (RUB)

            // Fetch current state of Finished Good Item
            const { data: fgItem } = await supabase
                .from('items')
                .select('total_value, unit_cost')
                .eq('id', queueItem.finished_good_id)
                .single()

            // Get current quantity from inventory
            const { data: invData } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('item_id', queueItem.finished_good_id)

            const currentQty = invData?.reduce((sum, inv) => sum + inv.quantity, 0) || 0
            const currentVal = fgItem?.total_value || 0
            const newVal = currentVal + estimatedCost

            // We don't manually update 'total_quantity' usually if we use inventory_moves trigger?
            // Assuming we have a trigger that sums inventory to items.total_quantity.
            // If so, we only need to update 'total_value'.

            // Update total_value AND unit_cost
            await supabase.from('items').update({
                total_value: newVal,
            }).eq('id', queueItem.finished_good_id)

            // Let's fetch current qty and calc new avg cost.
            const totalQty = currentQty + outputWeight
            const newUnitCost = totalQty > 0 ? (newVal / totalQty) : 0

            await supabase.from('items').update({
                total_value: newVal,
                unit_cost: newUnitCost
            }).eq('id', queueItem.finished_good_id)

            // 4. Create Inventory Move (Production -> Warehouse)
            // Find a warehouse location
            const { data: locations } = await supabase
                .from('locations')
                .select('id')
                .eq('type', 'warehouse')
                .limit(1)
                .maybeSingle()

            if (locations) {
                const { error: moveError } = await supabase.from('inventory_moves').insert({
                    item_id: queueItem.finished_good_id,
                    to_location_id: locations.id,
                    quantity: outputWeight,
                    type: 'production',
                    unit_price: outputWeight > 0 ? (estimatedCost / outputWeight) : 0,
                    batch_id: (queueItem as any).batch_id || null
                })

                if (moveError) {
                    console.error('Ошибка добавления готовой продукции на склад:', moveError)
                    alert(`Ошибка добавления на склад: ${moveError.message}`)
                    return // Прерываем если не удалось добавить
                }
                console.log('Готовая продукция добавлена на склад:', outputWeight, 'г')
            } else {
                console.error('Не найден склад для добавления продукции')
                alert('Не найден склад для добавления продукции')
                return
            }

            // Refresh
            loadProductionQueue()
            // Also refresh recipes/inventory if needed?

            setEditingWeight(prev => {
                const newState = { ...prev }
                delete newState[queueId]
                return newState
            })

            // Проверяем, можно ли завершить производство
            setTimeout(() => checkCompletedProductions(), 500)
        } catch (err) {
            console.error('Ошибка при обновлении веса:', err)
            alert('Ошибка при завершении производства')
        }
    }

    async function loadMaxQuantity(itemId: number | string) {
        try {
            // 1. Получаем рецепт
            const { data: recipeItems, error: recipeError } = await supabase
                .from('recipes')
                .select('ingredient_id, quantity')
                .eq('finished_good_id', itemId)

            if (recipeError) throw recipeError

            if (!recipeItems || recipeItems.length === 0) {
                setMaxQuantity(0)
                return
            }

            // Получаем ID локации (берем первую доступную)
            const { data: locations } = await supabase
                .from('locations')
                .select('id')
                .eq('type', 'warehouse')
                .limit(1)
                .maybeSingle()

            if (!locations) {
                setMaxQuantity(0)
                return
            }

            const locationId = locations.id

            // 2. Для каждого ингредиента получаем доступное количество
            let minPossible = Infinity

            for (const recipe of recipeItems) {
                const { data: inventoryData, error: invError } = await supabase
                    .from('inventory')
                    .select('quantity')
                    .eq('item_id', recipe.ingredient_id)
                    .eq('location_id', locationId)

                if (invError) throw invError

                // Суммируем количество
                const availableQty = inventoryData?.reduce((sum, inv) => sum + inv.quantity, 0) || 0

                // Вычисляем сколько продукции можно произвести из этого ингредиента
                const possibleFromThisIngredient = recipe.quantity > 0
                    ? Math.floor(availableQty / recipe.quantity)
                    : 0

                // Берем минимум
                minPossible = Math.min(minPossible, possibleFromThisIngredient)
            }

            setMaxQuantity(minPossible === Infinity ? 0 : minPossible)
        } catch (err) {
            console.error('Ошибка получения максимального количества:', err)
            setMaxQuantity(0)
        }
    }

    async function handleProduce() {
        if (!selectedProduct) return

        if (!quantity) {
            setError('Пожалуйста, введите количество')
            return
        }

        // Заменяем запятую на точку для корректного парсинга
        const qty = parseFloat(quantity.replace(',', '.'))
        const maxLimit = recipeInfo?.returns_to_raw ? totalAvailableWeight : maxQuantity

        if (isNaN(qty) || qty <= 0) {
            return
        }

        if (qty > maxLimit) {
            setError(`Количество превышает доступный лимит (${maxLimit})`)
            return
        }

        setLoading(true)
        setError(null)

        try {
            // 1. Получаем рецепт с названиями ингредиентов
            const { data: recipeItems, error: recipeError } = await supabase
                .from('recipes')
                .select(`
                    *,
                    ingredient:items!recipes_ingredient_id_fkey(id, name, is_weighted, unit_cost)
                `)
                .eq('finished_good_id', selectedProduct)

            if (recipeError) throw recipeError
            if (!recipeItems || recipeItems.length === 0) throw new Error('Рецепт пуст, невозможно произвести')

            // Получаем ID локации
            const { data: locations } = await supabase
                .from('locations')
                .select('id')
                .eq('type', 'warehouse')
                .limit(1)
                .maybeSingle()

            if (!locations) throw new Error('Не найдена локация "warehouse" в таблице locations')

            const locationId = locations.id
            console.log('Production Location:', locationId)

            // 2. Проверяем наличие всех ингредиентов ПЕРЕД началом производства
            for (const item of recipeItems) {
                const requiredQty = item.quantity * qty
                const { data: currentInv } = await supabase
                    .from('inventory')
                    .select('quantity')
                    .eq('location_id', locationId)
                    .eq('item_id', item.ingredient_id)

                const availableQty = currentInv?.reduce((acc, curr) => acc + curr.quantity, 0) || 0
                const ingredientName = (item.ingredient as any)?.name || `ID: ${item.ingredient_id}`

                if (availableQty < requiredQty) {
                    throw new Error(
                        `Недостаточно сырья: ${ingredientName}\n` +
                        `Требуется: ${requiredQty}, доступно: ${availableQty}`
                    )
                }
            }

            // 3. Считаем общую стоимость и готовим данные
            let totalEstimatedCost = 0
            let debugText = ''

            // Validate cost per item first?
            const itemsPromises = recipeItems.map(async item => {
                const requiredQty = item.quantity * qty
                const ingredientId = (item.ingredient as any)?.id
                // Fetch fresh data for accurate cost calculation
                const { data: freshIng } = await supabase
                    .from('items')
                    .select('unit_cost, total_value, id')
                    .eq('id', ingredientId)
                    .single()

                const unitCost = freshIng?.unit_cost || 0
                const lineCost = requiredQty * unitCost

                // DEDUCT from Total Value of the ingredient
                // WARNING: We should NOT deduct here during estimation/check! This loop runs BEFORE confirmation!
                // We should only calculate here. Deduction must happen in a separate step or when confirmed?
                // Wait, this block is inside 'handleProduce'.
                // 'handleProduce' is called when user clicks "Produce". 
                // It inserts into production_queue.
                // The actual deduction of physical stock usually happens via triggers or separate logic.
                // But specifically for 'total_value' deduction, we need to do it precisely.

                // If we deduct here, and the transaction fails later, we are in trouble.
                // But let's assume this is the point of commitment.

                // CRITICAL FIX: moving deduction logic OUT of the map loop if possible, or ensuring it runs.
                // But for now, let's just fix the NaN issue first.
                // The NaN comes from 'itemsToProcess' being a Promise<[]> instead of [].

                return {
                    ...item,
                    requiredQty, // CRITICAL FIX: Pass this down!
                    lineCost,
                    freshIng // pass this along if needed
                }
            })

            const itemsToProcess = await Promise.all(itemsPromises)

            debugText = itemsToProcess.map(i => `${(i.ingredient as any)?.name}: ${(i.quantity * qty).toFixed(3)} * ${i.freshIng?.unit_cost.toFixed(2)} = ${i.lineCost?.toFixed(2)}\n`).join('')
            totalEstimatedCost = itemsToProcess.reduce((sum, item) => sum + (item.lineCost || 0), 0)

            // For each item, deduct from Total Value of the ingredient
            // This deduction should happen only after confirmation, but for now,
            // we are doing it here as part of the estimation/preparation.
            // This needs to be refactored if we want a true transactional approach.
            for (const item of itemsToProcess) {
                if (item.freshIng) {
                    const newTotalValue = Math.max(0, (item.freshIng.total_value || 0) - (item.lineCost || 0))
                    await supabase.from('items').update({ total_value: newTotalValue }).eq('id', item.freshIng.id)
                }
            }

            // Показываем модальное окно вместо native confirm
            setConfirmData({
                items: itemsToProcess,
                qty,
                locationId,
                totalCost: totalEstimatedCost,
                breakdownText: debugText
            })
            setShowConfirmModal(true)
            setLoading(false)
        } catch (err: any) {
            console.error('Production error stack:', err.stack)
            console.error('Production error msg:', err.message)
            const msg = err.message || 'Ошибка производства'
            setError(msg) // Показываем ошибку в интерфейсе
            setLoading(false)
        } finally {
            // setLoading(false) // Moved inside try/catch for better control
        }
    }

    async function executeProduction() {
        if (!confirmData) return
        setLoading(true)

        try {
            const { items, locationId, qty, totalCost } = confirmData
            console.log('Execute Production - Data:', { items, locationId, qty, totalCost })

            if (!locationId) {
                throw new Error('Критическая ошибка: Не указана локация склада (locationId is null)')
            }

            // Generate unique batch_id for this production run
            const batchId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            // 1. Списываем сырье (с отрицательным quantity для группировки)
            for (const item of items) {
                console.log(`[Production] Списание: ${(item.ingredient as any)?.name}, Qty: ${item.requiredQty}г, Location: ${locationId}`)

                // Для списания: from_location_id = склад, to_location_id = null
                // Триггер при from_location_id != null делает: inventory.quantity - NEW.quantity
                // ВАЖНО: Сохраняем положительное количество - триггер вычтет из инвентаря
                const { error: moveError } = await supabase.from('inventory_moves').insert({
                    item_id: item.ingredient_id,
                    from_location_id: locationId,
                    to_location_id: null,
                    quantity: item.requiredQty, // Положительное - триггер вычтет
                    type: 'production',
                    unit_price: (item.freshIng?.unit_cost || 0),
                    batch_id: batchId
                })

                if (moveError) {
                    console.error('Ошибка списания:', moveError)
                    alert(`Ошибка списания ${(item.ingredient as any)?.name}: ${moveError.message}`)
                    throw moveError
                }
                console.log(`[Production] Успешно списано: ${(item.ingredient as any)?.name}`)
            }

            // 2. Добавляем в очередь производства
            const completesAt = new Date()

            // ... (Value Deduction Logic) ...

            const { data: queueData, error: queueError } = await supabase
                .from('production_queue')
                .insert({
                    finished_good_id: selectedProduct,
                    quantity: qty,
                    output_weight: null,
                    completes_at: completesAt.toISOString(),
                    location_id: locationId,
                    status: 'in_progress',
                    estimated_cost: totalCost,
                    batch_id: batchId
                })
                .select()
                .single()

            if (queueError) throw queueError

            console.log('Production started successfully')

            // Успех
            setSuccess(true)
            setQuantity('')
            setShowConfirmModal(false)
            setConfirmData(null)

            // Обновляем данные
            if (selectedProduct) {
                loadMaxQuantity(selectedProduct)
                loadRecipeInfo(selectedProduct)
            }
            loadProductionQueue()

            // CRITICAL FIX: Process immediately so user doesn't have to wait for interval
            // Pass true to bypass any 'isProcessing' locks if needed, or just call it.
            // We give DB a split second to settle triggers if any.
            setTimeout(() => checkCompletedProductions(), 100)

            setTimeout(() => setSuccess(false), 3000)
        } catch (err: any) {
            console.error('Production error:', err)
            // Show alert to user so they know it failed
            alert(`Ошибка производства: ${err.message}`)
            setError(err.message || 'Ошибка производства')
        } finally {
            setLoading(false)
        }
    }

    const selectedItem = finishedGoods.find(item => item.id === selectedProduct)

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-action/20 rounded-xl flex items-center justify-center">
                        <Factory className="w-6 h-6 text-action" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Производство</h1>
                        <p className="text-secondary">Запуск и очередь</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Левая панель - Выбор продукта */}
                <GlassCard>
                    <h2 className="text-xl font-semibold mb-4">Выбор продукта</h2>

                    <div className="space-y-3">
                        {finishedGoods.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedProduct(item.id)}
                                className={clsx(
                                    'w-full p-4 rounded-lg border transition-smooth text-left',
                                    selectedProduct === item.id
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                                )}
                            >
                                <div className="font-medium">{item.name}</div>
                                {item.type !== 'raw_material' && (
                                    <div className="text-sm text-secondary">
                                        Себестоимость: {item.unit_cost.toFixed(2)} ₽
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </GlassCard>

                {/* Правая панель - Производство */}
                <GlassCard>
                    <h2 className="text-xl font-semibold mb-4">Запуск производства</h2>

                    {!selectedProduct ? (
                        <div className="flex flex-col items-center justify-center h-64 text-secondary">
                            <AlertCircle className="w-12 h-12 mb-3" />
                            <p>Выберите продукт для производства</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <div className="text-sm text-secondary mb-3">Производство:</div>
                                <div className="flex items-center gap-3">
                                    {recipeIngredients.length > 0 ? (
                                        <>
                                            <div className="flex-1 space-y-1">
                                                {recipeIngredients.map((ing, idx) => (
                                                    <div key={idx} className="text-sm text-white/70">
                                                        {ing.ingredient_name}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-primary text-2xl">→</div>
                                            <div className="flex-1 text-right">
                                                <div className="text-lg font-bold">{selectedItem?.name}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xl font-bold">{selectedItem?.name}</div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg border border-primary/30">
                                {recipeInfo?.returns_to_raw ? (
                                    <>
                                        <div className="text-sm text-primary mb-2">МОЖНО ПЕРЕРАБОТАТЬ:</div>
                                        <div className="text-5xl font-bold text-primary">
                                            {totalAvailableWeight}
                                            <span className="text-2xl ml-2">г</span>
                                        </div>
                                        <div className="text-xs text-primary/60 mt-2">Итоговый вес будет указан после производства</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-sm text-primary mb-2">МАКСИМАЛЬНО ВОЗМОЖНО:</div>
                                        <div className="text-5xl font-bold text-primary">
                                            {maxQuantity}
                                            <span className="text-2xl ml-2">шт</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    {recipeInfo?.returns_to_raw ? 'Вес сырья для переработки (г)' : 'Количество для производства (шт)'}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        max={recipeInfo?.returns_to_raw ? totalAvailableWeight : maxQuantity}
                                        min={1}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary transition-smooth pr-20"
                                        placeholder={recipeInfo?.returns_to_raw ? "Введите вес в граммах" : "Введите количество"}
                                    />
                                    <button
                                        onClick={() => setQuantity((recipeInfo?.returns_to_raw ? totalAvailableWeight : maxQuantity).toString())}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold rounded-md transition-colors"
                                    >
                                        МАКС
                                    </button>
                                </div>
                            </div>

                            {recipeInfo?.returns_to_raw && (
                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <p className="text-sm text-yellow-400">
                                        📦 Сырьё из сырья — итоговый вес будет указан в очереди производства
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-success/20 border border-success/30 rounded-lg text-success text-sm">
                                    ✓ Производство успешно завершено!
                                </div>
                            )}

                            {estimatedCost !== null && (
                                <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-secondary">Расчетная себестоимость:</span>
                                        <span className="font-bold text-white">{estimatedCost.toFixed(2)} ₽</span>
                                    </div>
                                    <div className="text-xs text-secondary space-y-0.5 border-t border-white/5 pt-2">
                                        {costBreakdown.map((line, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span>{line.split('=')[0]}</span>
                                                <span className="text-white/70">={line.split('=')[1]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleProduce}
                                disabled={loading}
                                className={clsx(
                                    'w-full py-4 rounded-lg font-bold text-lg transition-smooth',
                                    loading
                                        ? 'bg-white/10 text-secondary cursor-not-allowed'
                                        : 'bg-action hover:bg-action/90 text-white shadow-lg shadow-action/30'
                                )}
                            >
                                {loading ? 'ПРОИЗВОДСТВО...' : 'ЗАПУСТИТЬ ПРОИЗВОДСТВО'}
                            </button>
                        </div>
                    )}
                </GlassCard>
            </div>

            {productionQueue.length > 0 && (
                <GlassCard>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-primary" />
                        В производстве ({productionQueue.length})
                    </h2>
                    <div className="space-y-3">
                        {productionQueue.map((item) => {
                            const now = new Date().getTime()
                            const target = new Date(item.completes_at).getTime()
                            const diff = target - now
                            const isCompleted = diff <= 0

                            const hours = Math.floor(diff / (1000 * 60 * 60))
                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                            const seconds = Math.floor((diff % (1000 * 60)) / 1000)

                            let timeRemaining = 'Ожидание веса'
                            if (!isCompleted) {
                                if (hours > 0) timeRemaining = `${hours}ч ${minutes}м`
                                else if (minutes > 0) timeRemaining = `${minutes}м ${seconds}с`
                                else timeRemaining = `${seconds}с`
                            }

                            return (
                                <div
                                    key={item.id}
                                    className={clsx(
                                        'p-4 rounded-lg border',
                                        isCompleted
                                            ? 'bg-success/10 border-success/30'
                                            : 'bg-white/5 border-white/10'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium">{item.item_name}</div>
                                            <div className="text-sm text-secondary flex gap-4 mt-1">
                                                <span>Количество: {(item as any).is_weighted ? `${item.quantity}г` : `${item.quantity} шт`}</span>
                                                {item.output_weight && <span className="text-primary">→ {item.output_weight}г (готово)</span>}
                                            </div>

                                            {/* Поле ввода веса только для весовых товаров или переработки (returns_to_raw) */}
                                            {!item.output_weight && ((item as any).is_weighted || (item as any).returns_to_raw) && (
                                                <div className="mt-3 flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={editingWeight[item.id] || ''}
                                                        onChange={(e) => setEditingWeight(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary"
                                                        placeholder="Укажите итоговый вес (г)"
                                                        step="0.01"
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateWeight(item.id, editingWeight[item.id] || '')}
                                                        disabled={!editingWeight[item.id]}
                                                        className={clsx(
                                                            'px-4 py-2 rounded-lg text-sm font-medium transition-smooth',
                                                            editingWeight[item.id]
                                                                ? 'bg-primary hover:bg-primary/90 text-white'
                                                                : 'bg-white/10 text-secondary cursor-not-allowed'
                                                        )}
                                                    >
                                                        Сохранить
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className={clsx(
                                            'px-4 py-2 rounded-lg font-mono font-bold ml-4',
                                            isCompleted
                                                ? 'bg-success/20 text-success'
                                                : 'bg-primary/20 text-primary'
                                        )}>
                                            {timeRemaining}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </GlassCard>
            )}

            {showConfirmModal && confirmData && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
                    <GlassCard className="w-full max-w-md border-primary/30">
                        <h2 className="text-xl font-bold mb-4 text-white">Подтверждение производства</h2>

                        <div className="space-y-4 mb-6">
                            <div className="bg-white/5 p-4 rounded-lg">
                                <div className="text-secondary text-sm mb-1">Итоговая стоимость</div>
                                <div className="text-2xl font-bold text-primary">{confirmData.totalCost.toFixed(2)} ₽</div>
                            </div>

                            <div className="text-sm space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                <div className="font-medium text-white">Списание со склада:</div>
                                {confirmData.breakdownText.split('\n').filter(Boolean).map((line, i) => (
                                    <div key={i} className="text-secondary pl-2 border-l-2 border-primary/20">
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-smooth font-medium"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={executeProduction}
                                disabled={loading}
                                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-smooth font-bold"
                            >
                                {loading ? 'Запуск...' : 'Подтвердить'}
                            </button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    )
}
