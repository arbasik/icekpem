
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function diagProduction() {
    console.log('--- Starting Production Diagnostics ---')

    // 1. Get a raw material item and warehouse location
    const { data: items } = await supabase.from('items').select('id, name').limit(1)
    const { data: locations } = await supabase.from('locations').select('id, name').eq('type', 'warehouse').limit(1)

    if (!items?.length || !locations?.length) {
        console.error('Missing items or locations to test with.')
        return
    }

    const item = items[0]
    const location = locations[0]
    console.log(`Testing with Item: ${item.name} (${item.id}) and Location: ${location.name} (${location.id})`)

    // 2. Check current inventory
    const { data: invBefore } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('item_id', item.id)
        .eq('location_id', location.id)
        .maybeSingle()

    const qtyBefore = invBefore?.quantity || 0
    console.log(`Initial Inventory: ${qtyBefore}`)

    // 3. Try to INSERT the "Hack" move (Negative Quantity, to_location = from_location)
    const testQty = -1.5
    console.log(`Attempting to insert move with quantity: ${testQty}...`)

    const { data: move, error } = await supabase
        .from('inventory_moves')
        .insert({
            item_id: item.id,
            from_location_id: location.id,
            to_location_id: null, // write_off doesn't need to_location
            quantity: 1.5, // Positive quantity for write_off (trigger subtracts it)
            type: 'write_off',
            unit_price: 0
        })
        .select()
        .single()

    if (error) {
        console.error('INSERT FAILED!', error)
    } else {
        console.log('INSERT SUCCESS:', move)

        // 4. Verify Inventory Update
        // Wait a moment for trigger
        await new Promise(r => setTimeout(r, 1000))

        const { data: invAfter } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('item_id', item.id)
            .eq('location_id', location.id)
            .maybeSingle()

        const qtyAfter = invAfter?.quantity || 0
        console.log(`Inventory After: ${qtyAfter}`)
        console.log(`Expected: ${qtyBefore + testQty}`)

        if (Math.abs(qtyAfter - (qtyBefore + testQty)) < 0.001) {
            console.log('SUCCESS: Trigger handled the negative quantity correctly!')
        } else {
            console.log('FAILURE: Inventory did not update as expected.')
            if (qtyAfter === qtyBefore) {
                console.log('Reason: No change in inventory. Trigger might be ignoring it or rolling back.')
            } else if (qtyAfter > qtyBefore) {
                console.log('Reason: Inventory INCREASED! Trigger treats negative input as positive addition?')
            }
        }

        // Cleanup (optional, but good practice)
        // await supabase.from('inventory_moves').delete().eq('id', move.id)
    }
}

diagProduction()
