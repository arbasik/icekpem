
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log("Checking unit_cost precision...");

    // We can't query information_schema easily with supabase-js unless we have high privs or rpc.
    // Instead, let's insert a value with high precision and see what comes back.

    const testName = `Precision_Test_${Date.now()}`;
    const highPrecisionValue = 1.12345678;

    const { data, error } = await supabase.from('items').insert({
        name: testName,
        type: 'raw_material',
        unit_cost: highPrecisionValue,
        is_weighted: false,
        sale_price: 0
    }).select().single();

    if (error) {
        console.error('Error creating item:', error);
        return;
    }

    console.log(`Inserted Value: ${highPrecisionValue}`);
    console.log(`Returned Value: ${data.unit_cost}`);

    if (data.unit_cost === highPrecisionValue) {
        console.log("Database supports high precision.");
    } else {
        console.log(`Database truncated value to: ${data.unit_cost}`);
        // Check scale
        const decimalPart = data.unit_cost.toString().split('.')[1] || '';
        console.log(`Apparent Scale: ${decimalPart.length}`);
    }

    // Cleanup
    await supabase.from('items').delete().eq('id', data.id);
}

checkSchema();
