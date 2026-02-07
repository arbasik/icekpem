
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    console.log("Fetching recent production queue items...");

    // 1. Get recent completed production
    const { data: queueItems, error: queueError } = await supabase
        .from('production_queue')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

    if (queueError) {
        console.error("Error fetching queue:", queueError);
        return;
    }

    if (!queueItems.length) {
        console.log("No completed production items found.");
        return;
    }

    console.log(`Found ${queueItems.length} items.`);

    for (const item of queueItems) {
        console.log(`\n--- Production ID: ${item.id} ---`);
        console.log(`Finished Good ID: ${item.finished_good_id}`);
        console.log(`Quantity (Input?): ${item.quantity}`);
        console.log(`Output Weight: ${item.output_weight}`);
        console.log(`Estimated Cost: ${item.estimated_cost}`);

        // 2. Calculate observed unit cost
        const finalQty = item.output_weight || item.quantity;
        const unitCost = item.estimated_cost / finalQty;
        console.log(`Calculated Unit Cost: ${unitCost} (Total / ${finalQty})`);

        // 3. Check Recipe
        const { data: recipeItems, error: recipeError } = await supabase
            .from('recipes')
            .select(`
                quantity,
                ingredient_id,
                items!recipes_ingredient_id_fkey(id, name, unit_cost)
            `)
            .eq('finished_good_id', item.finished_good_id);

        if (recipeError) {
            console.error("Error fetching recipe:", recipeError);
            continue;
        }

        console.log("Recipe Ingredients:");
        let expectedTotalCost = 0;
        for (const r of recipeItems) {
            // Check if r.items is array or object (Supabase can return array for M:1 if not handled, but usually it's object or null)
            const ing = Array.isArray(r.items) ? r.items[0] : r.items;

            if (!ing) {
                console.log(`Missing ingredient item data for id ${r.ingredient_id}`);
                continue;
            }

            const ing_name = ing.name;
            const ing_id = ing.id;
            const ing_cost = ing.unit_cost;
            const qty_per_unit = r.quantity;

            // Logic reversal: 
            // In ProductionOperations.tsx: requiredQty = item.quantity * qty (where qty is production input)
            // item.quantity from recipe seems to be 1 for Returns to Raw? 

            const costContribution = qty_per_unit * item.quantity * ing_cost;
            expectedTotalCost += costContribution;

            console.log(`- [ID: ${ing_id}] ${ing_name}: QtyPerUnit=${qty_per_unit}, UnitCost=${ing_cost}`);
            console.log(`  Expected contribution: ${qty_per_unit} * ${item.quantity} * ${ing_cost} = ${costContribution}`);
        }

        console.log(`Expected Total Cost: ${expectedTotalCost}`);
        console.log(`Difference: ${item.estimated_cost - expectedTotalCost}`);
    }
}

debug();
