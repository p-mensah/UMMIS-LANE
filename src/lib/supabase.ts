/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://puxzctsfjlztnburbplf.supabase.co';
const supabaseUrl = (rawUrl.trim().startsWith('http://') || rawUrl.trim().startsWith('https://')) 
  ? rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  : 'https://puxzctsfjlztnburbplf.supabase.co';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eHpjdHNmamx6dG5idXJicGxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjY3NjQsImV4cCI6MjEwMjc0Mjc2NH0.dzebi6T9C7dLs2U8oNWCgz9gg2tA6UzBQSeWQkiYHQc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});



