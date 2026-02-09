
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://milzxytxahejynyehsfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbHp4eXR4YWhlanlueWVoc2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjkzNTYsImV4cCI6MjA4NTUwNTM1Nn0.UXxJJ6z_HxecRIq1-5in79ZgOtmBHtqm5Qrl-3SQeqE'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSchema() {
    console.log('Checking locations table schema...')

    // Try to select 'status' from locations
    const { data, error } = await supabase
        .from('locations')
        .select('id, name, status')
        .limit(1)

    if (error) {
        console.error('Error selecting status:', error.message)
    } else {
        console.log('Successfully selected status column. Data:', data)
    }
}

checkSchema()
