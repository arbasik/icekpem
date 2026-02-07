// Диагностика состояния инвентаря
// Запустить: npx tsx check_inventory.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkInventory() {
    console.log('\n=== ДИАГНОСТИКА ИНВЕНТАРЯ ===\n')

    // 1. Проверяем таблицу items
    console.log('1. ТОВАРЫ (items):')
    const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, name, type, unit_cost, total_value, is_weighted')
        .order('name')
        .limit(20)

    if (itemsError) {
        console.error('   Ошибка:', itemsError.message)
    } else {
        items?.forEach(item => {
            console.log(`   - ${item.name} (${item.type}): unit_cost=${item.unit_cost?.toFixed(2)}, total_value=${item.total_value?.toFixed(2) || '0'}`)
        })
    }

    // 2. Проверяем таблицу inventory
    console.log('\n2. ОСТАТКИ НА СКЛАДЕ (inventory):')
    const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select(`
            item_id,
            location_id,
            quantity,
            items(name),
            locations(name, type)
        `)
        .order('item_id')

    if (invError) {
        console.error('   Ошибка:', invError.message)
    } else if (!inventory || inventory.length === 0) {
        console.log('   ⚠️ ТАБЛИЦА ПУСТА!')
    } else {
        inventory?.forEach((inv: any) => {
            console.log(`   - ${inv.items?.name}: ${inv.quantity} на "${inv.locations?.name}" (${inv.locations?.type})`)
        })
    }

    // 3. Проверяем последние moves
    console.log('\n3. ПОСЛЕДНИЕ ОПЕРАЦИИ (inventory_moves):')
    const { data: moves, error: movesError } = await supabase
        .from('inventory_moves')
        .select(`
            id,
            item_id,
            from_location_id,
            to_location_id,
            quantity,
            type,
            created_at,
            items(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

    if (movesError) {
        console.error('   Ошибка:', movesError.message)
    } else {
        moves?.forEach((move: any) => {
            const from = move.from_location_id ? `from:${move.from_location_id.substring(0, 8)}` : ''
            const to = move.to_location_id ? `to:${move.to_location_id.substring(0, 8)}` : ''
            const time = new Date(move.created_at).toLocaleTimeString('ru-RU')
            console.log(`   - [${move.type}] ${move.items?.name}: ${move.quantity} (${from} ${to}) @ ${time}`)
        })
    }

    // 4. Проверяем locations
    console.log('\n4. ЛОКАЦИИ (locations):')
    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name, type')

    if (locError) {
        console.error('   Ошибка:', locError.message)
    } else {
        locations?.forEach(loc => {
            console.log(`   - ${loc.id.substring(0, 8)}...: "${loc.name}" (${loc.type})`)
        })
    }

    // 5. Итоговая сводка
    console.log('\n5. СВОДКА:')
    const warehouseItems = inventory?.filter((inv: any) => inv.locations?.type === 'warehouse' && inv.quantity > 0) || []
    console.log(`   Товаров на складе (warehouse): ${warehouseItems.length}`)
    warehouseItems.forEach((inv: any) => {
        console.log(`      • ${inv.items?.name}: ${inv.quantity}`)
    })

    console.log('\n=== КОНЕЦ ДИАГНОСТИКИ ===\n')
}

checkInventory().catch(console.error)
