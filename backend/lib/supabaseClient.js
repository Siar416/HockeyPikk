const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceKey);

const createSupabaseClient = () =>
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const supabaseAdmin = hasSupabaseConfig ? createSupabaseClient() : null;

module.exports = { supabaseAdmin, hasSupabaseConfig, createSupabaseClient };
