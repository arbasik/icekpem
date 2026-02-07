import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    console.log('Checking items table...')
    const { data, error } = await supabase.from('items').select('*').limit(1)

    if (error) {
        console.error('Error fetching items:', error)
    } else {
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]))
        } else {
            console.log('No items found in table, cannot verify columns dynamically without permission.')
            // Try deleting and inserting dummy to check schema? Too risky.
            // Try creating with weight_per_pack
            console.log('Attempting dry-run insert with weight_per_pack...')
            const { error: insertError } = await supabase.from('items').insert({
                name: 'TEST_SCHEMA_CHECK',
                type: 'raw_material',
                unit_cost: 0,
                weight_per_pack: 100 // Test field
            }).select().single()

            if (insertError) {
                console.log('Insert failed (field likely missing):', insertError.message)
            } else {
                console.log('Insert success! Field exists.')
                // Cleanup
                // await supabase.from('items').delete().eq('name', 'TEST_SCHEMA_CHECK')
            }
        }
    }
}

check()
