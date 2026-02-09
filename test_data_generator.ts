/**
 * 🧪 Test Data Generator for Ice ERP
 * 
 * Создаёт реалистичные тестовые данные:
 * - Сырьё (свежие продукты, упаковка)
 * - Полуфабрикаты (сушёные, обработанные)
 * - Готовая продукция (упакованные товары)
 * - Рецепты переработки
 * - Закупки сырья
 * - Производственные операции
 * - Отгрузки клиентам
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ CONFIGURATION ============
const CONFIG = {
    WAREHOUSE_NAME: 'Главный склад',
    NUM_PURCHASES: 30,      // Количество закупок
    NUM_PRODUCTIONS: 50,    // Количество производств
    NUM_SHIPMENTS: 40,      // Количество отгрузок
}

// ============ DATA DEFINITIONS ============

// Сырьё (свежие продукты + упаковочные материалы)
// unit_cost = цена за 1 кг (для весовых) или за 1 шт
const RAW_MATERIALS = [
    // Свежие продукты (цена за кг)
    { name: 'Рыба свежая (Омуль)', unit_cost: 450, is_weighted: true, icon: '🐟' },
    { name: 'Рыба свежая (Сиг)', unit_cost: 380, is_weighted: true, icon: '🐟' },
    { name: 'Рыба свежая (Хариус)', unit_cost: 520, is_weighted: true, icon: '🐟' },
    { name: 'Мясо свежее (Говядина)', unit_cost: 650, is_weighted: true, icon: '🥩' },
    { name: 'Мясо свежее (Свинина)', unit_cost: 420, is_weighted: true, icon: '🥓' },
    { name: 'Грибы свежие', unit_cost: 280, is_weighted: true, icon: '🍄' },
    { name: 'Ягоды свежие', unit_cost: 350, is_weighted: true, icon: '🫐' },
    { name: 'Травы свежие', unit_cost: 180, is_weighted: true, icon: '🌿' },

    // Упаковочные материалы
    { name: 'Упаковка вакуумная 100г', unit_cost: 8, is_weighted: false, icon: '📦' },
    { name: 'Упаковка вакуумная 250г', unit_cost: 12, is_weighted: false, icon: '📦' },
    { name: 'Упаковка вакуумная 500г', unit_cost: 18, is_weighted: false, icon: '📦' },
    { name: 'Коробка картонная', unit_cost: 25, is_weighted: false, icon: '🗃️' },
    { name: 'Этикетка', unit_cost: 3, is_weighted: false, icon: '🏷️' },

    // Специи и добавки
    { name: 'Соль пищевая', unit_cost: 45, is_weighted: true, icon: '🧂' },
    { name: 'Специи (смесь)', unit_cost: 280, is_weighted: true, icon: '🌶️' },
]

// Полуфабрикаты (обработанные продукты, возвращаются в сырьё)
const SEMI_PRODUCTS = [
    // Сушёные продукты
    { name: 'Омуль сушёный', unit_cost: 0, is_weighted: true, icon: '🐟', returns_to_raw: true },
    { name: 'Сиг сушёный', unit_cost: 0, is_weighted: true, icon: '🐟', returns_to_raw: true },
    { name: 'Хариус сушёный', unit_cost: 0, is_weighted: true, icon: '🐟', returns_to_raw: true },

    // Вяленые продукты
    { name: 'Говядина вяленая', unit_cost: 0, is_weighted: true, icon: '🥩', returns_to_raw: true },
    { name: 'Свинина вяленая', unit_cost: 0, is_weighted: true, icon: '🥓', returns_to_raw: true },

    // Сушёные грибы/ягоды
    { name: 'Грибы сушёные', unit_cost: 0, is_weighted: true, icon: '🍄', returns_to_raw: true },
    { name: 'Ягоды сушёные', unit_cost: 0, is_weighted: true, icon: '🫐', returns_to_raw: true },

    // Копчёные
    { name: 'Омуль копчёный', unit_cost: 0, is_weighted: true, icon: '🐟', returns_to_raw: true },
]

// Готовая продукция (упакованные товары)
const FINISHED_GOODS = [
    { name: 'Омуль сушёный (упак. 100г)', unit_cost: 0, sale_price: 350, icon: '🎁' },
    { name: 'Омуль сушёный (упак. 250г)', unit_cost: 0, sale_price: 800, icon: '🎁' },
    { name: 'Сиг сушёный (упак. 100г)', unit_cost: 0, sale_price: 320, icon: '🎁' },
    { name: 'Хариус сушёный (упак. 100г)', unit_cost: 0, sale_price: 420, icon: '🎁' },
    { name: 'Говядина вяленая (упак. 100г)', unit_cost: 0, sale_price: 480, icon: '🎁' },
    { name: 'Набор сушёной рыбы (коробка)', unit_cost: 0, sale_price: 1500, icon: '🎁' },
    { name: 'Грибы сушёные (упак. 50г)', unit_cost: 0, sale_price: 250, icon: '🎁' },
    { name: 'Ягоды сушёные (упак. 100г)', unit_cost: 0, sale_price: 300, icon: '🎁' },
]

// Рецепты переработки (свежее → сушёное/копчёное)
// Формат: { output: 'название выхода', ingredients: [{ name: 'сырьё', qty: количество }], output_qty: выход, returns_to_raw: true }
const PROCESSING_RECIPES = [
    { output: 'Омуль сушёный', ingredients: [{ name: 'Рыба свежая (Омуль)', qty: 1000 }, { name: 'Соль пищевая', qty: 50 }], output_qty: 350, returns_to_raw: true },
    { output: 'Сиг сушёный', ingredients: [{ name: 'Рыба свежая (Сиг)', qty: 1000 }, { name: 'Соль пищевая', qty: 50 }], output_qty: 380, returns_to_raw: true },
    { output: 'Хариус сушёный', ingredients: [{ name: 'Рыба свежая (Хариус)', qty: 1000 }, { name: 'Соль пищевая', qty: 50 }], output_qty: 320, returns_to_raw: true },
    { output: 'Говядина вяленая', ingredients: [{ name: 'Мясо свежее (Говядина)', qty: 1000 }, { name: 'Соль пищевая', qty: 30 }, { name: 'Специи (смесь)', qty: 20 }], output_qty: 400, returns_to_raw: true },
    { output: 'Свинина вяленая', ingredients: [{ name: 'Мясо свежее (Свинина)', qty: 1000 }, { name: 'Соль пищевая', qty: 30 }, { name: 'Специи (смесь)', qty: 20 }], output_qty: 420, returns_to_raw: true },
    { output: 'Грибы сушёные', ingredients: [{ name: 'Грибы свежие', qty: 1000 }], output_qty: 100, returns_to_raw: true },
    { output: 'Ягоды сушёные', ingredients: [{ name: 'Ягоды свежие', qty: 1000 }], output_qty: 150, returns_to_raw: true },
    { output: 'Омуль копчёный', ingredients: [{ name: 'Рыба свежая (Омуль)', qty: 1000 }, { name: 'Соль пищевая', qty: 30 }], output_qty: 750, returns_to_raw: true },
]

// Рецепты упаковки (полуфабрикат + упаковка → готовый товар)
const PACKAGING_RECIPES = [
    { output: 'Омуль сушёный (упак. 100г)', ingredients: [{ name: 'Омуль сушёный', qty: 100 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Омуль сушёный (упак. 250г)', ingredients: [{ name: 'Омуль сушёный', qty: 250 }, { name: 'Упаковка вакуумная 250г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Сиг сушёный (упак. 100г)', ingredients: [{ name: 'Сиг сушёный', qty: 100 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Хариус сушёный (упак. 100г)', ingredients: [{ name: 'Хариус сушёный', qty: 100 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Говядина вяленая (упак. 100г)', ingredients: [{ name: 'Говядина вяленая', qty: 100 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Набор сушёной рыбы (коробка)', ingredients: [{ name: 'Омуль сушёный', qty: 150 }, { name: 'Сиг сушёный', qty: 150 }, { name: 'Хариус сушёный', qty: 100 }, { name: 'Коробка картонная', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Грибы сушёные (упак. 50г)', ingredients: [{ name: 'Грибы сушёные', qty: 50 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
    { output: 'Ягоды сушёные (упак. 100г)', ingredients: [{ name: 'Ягоды сушёные', qty: 100 }, { name: 'Упаковка вакуумная 100г', qty: 1 }, { name: 'Этикетка', qty: 1 }], output_qty: 1 },
]

// Клиенты для отгрузок
const TEST_CLIENTS = [
    { name: 'Магазин "Байкальские деликатесы"', address: 'ул. Ленина 15, Иркутск', contact: '+7-914-111-2233' },
    { name: 'Ресторан "Омулёвая бочка"', address: 'ул. Карла Маркса 28, Иркутск', contact: '+7-914-222-3344' },
    { name: 'Супермаркет "Слата"', address: 'ул. Байкальская 100, Иркутск', contact: '+7-395-255-5555' },
    { name: 'ИП Петров - опт', address: 'ул. Партизанская 50, Ангарск', contact: '+7-914-333-4455' },
    { name: 'Рынок "Центральный"', address: 'ул. Чехова 5, Иркутск', contact: '+7-914-444-5566' },
]

// ============ HELPER FUNCTIONS ============

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysBack: number): string {
    const date = new Date()
    date.setDate(date.getDate() - randomInt(0, daysBack))
    return date.toISOString()
}

// ============ MAIN GENERATOR ============

async function generateTestData() {
    console.log('🚀 Запуск генератора тестовых данных...\n')

    // 1. Получаем или создаём склад
    console.log('📦 Проверяем склад...')
    let { data: warehouse } = await supabase
        .from('locations')
        .select('*')
        .eq('type', 'warehouse')
        .limit(1)
        .single()

    if (!warehouse) {
        const { data: newWh } = await supabase
            .from('locations')
            .insert({ name: CONFIG.WAREHOUSE_NAME, type: 'warehouse' })
            .select()
            .single()
        warehouse = newWh
    }
    console.log(`   ✓ Склад: ${warehouse?.name}\n`)

    // 2. Создаём товары (сырьё)
    console.log('🥬 Создаём сырьё...')
    const rawMaterialIds: Record<string, string> = {}
    for (const item of RAW_MATERIALS) {
        const { data } = await supabase
            .from('items')
            .insert({ ...item, type: 'raw_material' })
            .select('id, name')
            .single()
        if (data) rawMaterialIds[data.name] = data.id
    }
    console.log(`   ✓ Создано ${Object.keys(rawMaterialIds).length} позиций сырья\n`)

    // 3. Создаём полуфабрикаты (как raw_material с флагом returns_to_raw)
    console.log('🔄 Создаём полуфабрикаты...')
    const semiProductIds: Record<string, string> = {}
    for (const item of SEMI_PRODUCTS) {
        const { returns_to_raw, ...itemData } = item
        const { data } = await supabase
            .from('items')
            .insert({ ...itemData, type: 'raw_material' }) // Полуфабрикаты = сырьё
            .select('id, name')
            .single()
        if (data) {
            semiProductIds[data.name] = data.id
            rawMaterialIds[data.name] = data.id // Добавляем в общий пул сырья
        }
    }
    console.log(`   ✓ Создано ${Object.keys(semiProductIds).length} полуфабрикатов\n`)

    // 4. Создаём готовую продукцию
    console.log('🎁 Создаём готовую продукцию...')
    const finishedGoodIds: Record<string, string> = {}
    for (const item of FINISHED_GOODS) {
        const { data } = await supabase
            .from('items')
            .insert({ ...item, type: 'finished_good' })
            .select('id, name')
            .single()
        if (data) finishedGoodIds[data.name] = data.id
    }
    console.log(`   ✓ Создано ${Object.keys(finishedGoodIds).length} готовых товаров\n`)

    // 5. Создаём рецепты переработки
    console.log('📝 Создаём рецепты переработки...')
    let recipeCount = 0
    for (const recipe of PROCESSING_RECIPES) {
        const outputId = semiProductIds[recipe.output]
        if (!outputId) continue

        for (const ing of recipe.ingredients) {
            const ingId = rawMaterialIds[ing.name]
            if (!ingId) continue

            await supabase.from('recipes').insert({
                finished_good_id: outputId,
                ingredient_id: ingId,
                quantity: ing.qty,
                returns_to_raw: recipe.returns_to_raw || false
            })
            recipeCount++
        }
    }
    console.log(`   ✓ Создано ${recipeCount} ингредиентов для переработки\n`)

    // 6. Создаём рецепты упаковки
    console.log('📦 Создаём рецепты упаковки...')
    let packRecipeCount = 0
    for (const recipe of PACKAGING_RECIPES) {
        const outputId = finishedGoodIds[recipe.output]
        if (!outputId) continue

        for (const ing of recipe.ingredients) {
            const ingId = rawMaterialIds[ing.name]
            if (!ingId) continue

            await supabase.from('recipes').insert({
                finished_good_id: outputId,
                ingredient_id: ingId,
                quantity: ing.qty,
                returns_to_raw: false
            })
            packRecipeCount++
        }
    }
    console.log(`   ✓ Создано ${packRecipeCount} ингредиентов для упаковки\n`)

    // 7. Создаём закупки сырья
    console.log('💰 Генерируем закупки...')
    const rawMaterialNames = RAW_MATERIALS.map(r => r.name)
    for (let i = 0; i < CONFIG.NUM_PURCHASES; i++) {
        const itemName = randomElement(rawMaterialNames)
        const item = RAW_MATERIALS.find(r => r.name === itemName)!
        const itemId = rawMaterialIds[itemName]

        // Случайная цена ±20% от базовой (₽/кг для весовых, ₽/шт для штучных)
        const unitPrice = Math.round(item.unit_cost * (0.8 + Math.random() * 0.4))

        // Для весовых: количество в граммах (2-20 кг)
        // Для штучных: 20-200 штук
        const quantity = item.is_weighted
            ? randomInt(2, 20) * 1000  // 2-20 кг в граммах
            : randomInt(20, 200)        // 20-200 штук

        // Рассчитываем стоимость этой закупки
        // Для весовых: unitPrice = ₽/кг, quantity = граммы, поэтому cost = unitPrice * (quantity/1000)
        // Для штучных: unitPrice = ₽/шт, quantity = штуки, поэтому cost = unitPrice * quantity
        const purchaseCost = item.is_weighted
            ? unitPrice * (quantity / 1000)  // ₽/кг * кг = ₽
            : unitPrice * quantity            // ₽/шт * шт = ₽

        await supabase.from('inventory_moves').insert({
            item_id: itemId,
            to_location_id: warehouse?.id,
            quantity,
            type: 'purchase',
            unit_price: unitPrice,
            created_at: randomDate(60)
        })

        // Обновляем total_value и unit_cost в items (как делает реальное приложение)
        const { data: curItem } = await supabase.from('items').select('total_value').eq('id', itemId).single()
        const { data: curInv } = await supabase.from('inventory').select('quantity').eq('item_id', itemId)

        const currentTotalValue = curItem?.total_value || 0
        const currentQty = curInv?.reduce((sum, inv) => sum + inv.quantity, 0) || 0

        const newTotalValue = currentTotalValue + purchaseCost
        const newAvgCost = currentQty > 0 ? newTotalValue / currentQty : unitPrice

        await supabase.from('items').update({
            total_value: newTotalValue,
            unit_cost: newAvgCost
        }).eq('id', itemId)
    }
    console.log(`   ✓ Создано ${CONFIG.NUM_PURCHASES} закупок\n`)

    // 8. Создаём клиентов
    console.log('👥 Создаём клиентов...')
    const clientIds: string[] = []
    for (const client of TEST_CLIENTS) {
        const { data } = await supabase
            .from('locations')
            .insert({ ...client, type: 'client', status: 'active' })
            .select('id')
            .single()
        if (data) clientIds.push(data.id)
    }
    console.log(`   ✓ Создано ${clientIds.length} клиентов\n`)

    // 9. Симулируем производство (записи в production_queue)
    console.log('🏭 Генерируем производственные операции...')

    // Сначала переработка (свежее → сушёное)
    const processingCount = Math.floor(CONFIG.NUM_PRODUCTIONS * 0.6)
    for (let i = 0; i < processingCount; i++) {
        const recipe = randomElement(PROCESSING_RECIPES)
        const outputId = semiProductIds[recipe.output]
        if (!outputId) continue

        const batchMultiplier = randomInt(1, 5)
        const quantity = recipe.output_qty * batchMultiplier

        const startDate = new Date(randomDate(30))
        const endDate = new Date(startDate.getTime() + randomInt(2, 24) * 60 * 60 * 1000)

        await supabase.from('production_queue').insert({
            finished_good_id: outputId,
            quantity,
            output_weight: quantity,
            started_at: startDate.toISOString(),
            completes_at: endDate.toISOString(),
            status: 'completed',
            location_id: warehouse?.id
        })

        // Добавляем записи движения (расход сырья + приход полуфабриката)
        for (const ing of recipe.ingredients) {
            const ingId = rawMaterialIds[ing.name]
            if (ingId) {
                await supabase.from('inventory_moves').insert({
                    item_id: ingId,
                    from_location_id: warehouse?.id,
                    quantity: ing.qty * batchMultiplier,
                    type: 'production',
                    created_at: endDate.toISOString()
                })
            }
        }

        // Приход полуфабриката
        await supabase.from('inventory_moves').insert({
            item_id: outputId,
            to_location_id: warehouse?.id,
            quantity,
            type: 'production',
            created_at: endDate.toISOString()
        })
    }

    // Упаковка (полуфабрикат + упаковка → готовый товар)
    const packagingCount = CONFIG.NUM_PRODUCTIONS - processingCount
    for (let i = 0; i < packagingCount; i++) {
        const recipe = randomElement(PACKAGING_RECIPES)
        const outputId = finishedGoodIds[recipe.output]
        if (!outputId) continue

        const quantity = randomInt(5, 30) // 5-30 упаковок

        const startDate = new Date(randomDate(20))
        const endDate = new Date(startDate.getTime() + randomInt(1, 4) * 60 * 60 * 1000)

        await supabase.from('production_queue').insert({
            finished_good_id: outputId,
            quantity,
            started_at: startDate.toISOString(),
            completes_at: endDate.toISOString(),
            status: 'completed',
            location_id: warehouse?.id
        })

        // Расход ингредиентов
        for (const ing of recipe.ingredients) {
            const ingId = rawMaterialIds[ing.name]
            if (ingId) {
                await supabase.from('inventory_moves').insert({
                    item_id: ingId,
                    from_location_id: warehouse?.id,
                    quantity: ing.qty * quantity,
                    type: 'production',
                    created_at: endDate.toISOString()
                })
            }
        }

        // Приход готовой продукции
        await supabase.from('inventory_moves').insert({
            item_id: outputId,
            to_location_id: warehouse?.id,
            quantity,
            type: 'production',
            created_at: endDate.toISOString()
        })
    }
    console.log(`   ✓ Создано ${CONFIG.NUM_PRODUCTIONS} производств (${processingCount} переработка + ${packagingCount} упаковка)\n`)

    // 10. Генерируем отгрузки клиентам
    console.log('🚚 Генерируем отгрузки...')
    const finishedGoodNames = Object.keys(finishedGoodIds)
    for (let i = 0; i < CONFIG.NUM_SHIPMENTS; i++) {
        const clientId = randomElement(clientIds)
        const itemName = randomElement(finishedGoodNames)
        const itemId = finishedGoodIds[itemName]
        const item = FINISHED_GOODS.find(f => f.name === itemName)

        const quantity = randomInt(3, 20)
        const salePrice = item?.sale_price || 500

        await supabase.from('inventory_moves').insert({
            item_id: itemId,
            from_location_id: warehouse?.id,
            to_location_id: clientId,
            quantity,
            type: 'transfer',
            sale_price: salePrice,
            payment_status: randomElement(['paid', 'consignment', 'consignment']),
            created_at: randomDate(14)
        })
    }
    console.log(`   ✓ Создано ${CONFIG.NUM_SHIPMENTS} отгрузок\n`)

    // 11. Итоговая статистика
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true })
    const { count: recipesCount } = await supabase.from('recipes').select('*', { count: 'exact', head: true })
    const { count: movesCount } = await supabase.from('inventory_moves').select('*', { count: 'exact', head: true })
    const { count: prodCount } = await supabase.from('production_queue').select('*', { count: 'exact', head: true })
    const { count: clientsCount } = await supabase.from('locations').select('*', { count: 'exact', head: true }).eq('type', 'client')

    console.log(`   📦 Товаров в базе:        ${itemsCount}`)
    console.log(`   📝 Рецептов:              ${recipesCount}`)
    console.log(`   🔄 Движений склада:       ${movesCount}`)
    console.log(`   🏭 Производств:           ${prodCount}`)
    console.log(`   👥 Клиентов:              ${clientsCount}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('✅ Генерация тестовых данных завершена!')
    console.log('   Откройте приложение и проверьте:')
    console.log('   - Склад → список товаров и остатки')
    console.log('   - Производство → рецепты и история')
    console.log('   - Клиенты → список и отгрузки')
}

// Запуск
generateTestData().catch(console.error)
