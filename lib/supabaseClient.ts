
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iunzukceyvrufiphgdmz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1bnp1a2NleXZydWZpcGhnZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDAwNzIsImV4cCI6MjA3OTk3NjA3Mn0.W9P-QNeZo656OiLFuSWpah5IK0OnQcWg1zyxF1mavAM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
