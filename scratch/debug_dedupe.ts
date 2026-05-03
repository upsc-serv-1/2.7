
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function probe() {
  const term = 'Gandhi';
  const termPattern = `%${term}%`;
  
  // Exact match rows
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, options, explanation_markdown')
    .ilike('question_text', termPattern)
    .limit(100);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} raw rows for "${term}"`);
  
  const ids = data.map(d => d.id);
  const uniqueIds = new Set(ids);
  console.log(`Unique IDs: ${uniqueIds.size}`);

  const texts = data.map(d => d.question_text.substring(0, 50));
  const uniqueTexts = new Set(texts);
  console.log(`Unique Texts (first 50 chars): ${uniqueTexts.size}`);

  // Check for exact duplicates in the sample
  const dupeMap = new Map();
  data.forEach(d => {
    const key = d.question_text;
    dupeMap.set(key, (dupeMap.get(key) || 0) + 1);
  });

  const dupes = Array.from(dupeMap.entries()).filter(([k, v]) => v > 1);
  console.log(`Questions appearing more than once in this sample: ${dupes.length}`);
}

probe();
