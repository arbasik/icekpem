
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugMoves() {
    const { data: moves, error } = await supabase
        .from('inventory_moves')
        .select(`
            id, created_at, type, quantity, item_id,
            items (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('--- Recent Moves ---')
    moves.forEach(m => {
        console.log(`[${m.id}] ${m.created_at} | ${m.type} | ${m.items?.name} | Qty: ${m.quantity}`)
    })
}

debugMoves()
