
import { supabase } from './src/lib/supabase';

async function checkTable() {
  const { data, error } = await supabase.from('user_tags').select('id').limit(1);
  if (error) {
    console.log('user_tags table does not exist or error:', error.message);
  } else {
    console.log('user_tags table exists!');
  }
}

checkTable();
