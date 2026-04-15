// ============================================================
//  Dream-Chain AI — Supabase Configuration
// ============================================================

const SUPABASE_URL     = 'https://kbloonpekxxzfqkozvm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibG9vbmtwZWt4eHpmcWtvenZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTEzMTMsImV4cCI6MjA5MTgyNzMxM30.LMpz_xraAuZYt_lr9e0h826QCSbKaOZS3kCWLAwILBc';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
