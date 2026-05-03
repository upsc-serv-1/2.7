import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://ngwsuqzkndlxfoantnlf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk');
(async () => {
  for (const t of ['flashcard_branches','flashcard_branch_cards','folder_algorithm_settings','card_reviews','user_cards']) {
    const { error } = await sb.from(t).select('*', { head: true, count: 'exact' }).limit(1);
    console.log(`${error ? '✗' : '✓'} ${t}${error ? ' — '+error.message : ''}`);
  }
  // Probe user_cards new columns
  const { data, error } = await sb.from('user_cards').select('learning_step,is_relearning,interval_minutes,dirty,client_updated_at,times_seen').limit(1);
  console.log(error ? `✗ user_cards new cols: ${error.message}` : `✓ user_cards has learning_step/is_relearning/interval_minutes/dirty/client_updated_at/times_seen`);
  // Probe card_reviews new columns
  const { error: e2 } = await sb.from('card_reviews').select('rating,learning_step,prev_minutes,new_minutes').limit(1);
  console.log(e2 ? `✗ card_reviews new cols: ${e2.message}` : `✓ card_reviews has rating/learning_step/prev_minutes/new_minutes`);
})();
