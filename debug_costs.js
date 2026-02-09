
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCosts() {
    console.log('Checking ingredient costs...')

    // 1. Get all recipes
    const { data: recipes, error: rError } = await supabase
        .from('recipes')
    console.log(`Found ${recipes.length} recipe rows.`)

    recipes.forEach(r => {
        const pName = r.finished_good?.name
        const iName = r.ingredient?.name
        const qty = r.quantity
        const cost = r.ingredient?.unit_cost

        console.log(`Product: [${pName}] uses [${iName}]`)
        console.log(`  - Qty in Recipe: ${qty}`)
        console.log(`  - Unit Cost: ${cost}`)
        console.log(`  - Est. Cost per 1 product: ${(qty * cost).toFixed(4)}`)
        console.log('---')
    })
}

checkCosts()
