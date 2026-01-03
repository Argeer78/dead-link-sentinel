require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Connection...');
console.log('URL:', url ? url.slice(0, 20) + '...' : 'MISSING');
console.log('KEY:', key ? key.slice(0, 10) + '...' : 'MISSING');

if (!url || !key) {
    console.error('ERROR: Missing keys in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    const { data, error } = await supabase.from('sites').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('CONNECTION FAILED:', error.message);
    } else {
        console.log('CONNECTION SUCCESS! Database is reachable.');
    }
}

test();
