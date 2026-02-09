/**
 * 🧹 Cleanup test data
 * Удаляет все тестовые данные для повторного запуска генератора
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function cleanup() {
    console.log('🧹 Очистка тестовых данных...\n')

    // Порядок удаления важен из-за foreign keys
    console.log('   Удаляем движения склада...')
    await supabase.from('inventory_moves').delete().neq('id', 0)

    console.log('   Удаляем производственную очередь...')
    await supabase.from('production_queue').delete().neq('id', 0)

    console.log('   Удаляем рецепты...')
    await supabase.from('recipes').delete().neq('finished_good_id', '00000000-0000-0000-0000-000000000000')

    console.log('   Удаляем товары...')
    await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('   Удаляем клиентов (не склады)...')
    await supabase.from('locations').delete().eq('type', 'client')

    console.log('\n✅ Очистка завершена!\n')
}

cleanup().catch(console.error)
