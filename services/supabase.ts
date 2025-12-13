
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ceeitvfjmsmaybltfqut.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZWl0dmZqbXNtYXlibHRmcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MjkxMzcsImV4cCI6MjA4MTIwNTEzN30.BPuD6d8e5JqK-XyKgk0UKA_Hy22vZWiR6uLLPHLsvBg';

export const supabase = createClient(supabaseUrl, supabaseKey);
