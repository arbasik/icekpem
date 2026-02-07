
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    console.log("Starting Trigger Debug (ESM)...");

    // TEST 1: Create a test item with cost 1000 and see if it becomes 1005.
    const testName = `Test_Item_${Date.now()}`;
    console.log(`Creating test item: ${testName} with cost 1000`);

    const { data, error } = await supabase.from('items').insert({
        name: testName,
        type: 'raw_material',
        unit_cost: 1000,
        is_weighted: false,
        sale_price: 0
    }).select().single();

    if (error) {
        console.error('Error creating item:', error);
        return;
    }

    console.log(`Created Item ID: ${data.id}`);
    console.log(`Unit Cost: ${data.unit_cost}`);

    if (data.unit_cost > 1000) {
        console.log(`!!! FOUND IT: Item creation added markup! Cost is ${data.unit_cost}`);
    } else {
        console.log("Item creation cost is correct (1000).");
    }

    // TEST 2: Update item cost to 2000
    console.log("Updating cost to 2000...");
    const { data: updated, error: updateError } = await supabase
        .from('items')
        .update({ unit_cost: 2000 })
        .eq('id', data.id)
        .select()
        .single();

    if (updateError) console.error(updateError);
    else {
        console.log(`Updated Unit Cost: ${updated.unit_cost}`);
        if (updated.unit_cost > 2000) {
            console.log(`!!! FOUND IT: Item update added markup! Cost is ${updated.unit_cost}`);
        }
    }

    // CLEANUP
    console.log("Cleaning up...");
    await supabase.from('items').delete().eq('id', data.id);
}

debug();
