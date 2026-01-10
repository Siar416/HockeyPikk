const { supabaseAdmin, hasSupabaseConfig } = require("../lib/supabaseClient");

module.exports = (req, res, next) => {
  if (!hasSupabaseConfig || !supabaseAdmin) {
    return res.status(500).json({ error: "Supabase is not configured." });
  }

  req.supabase = supabaseAdmin;
  return next();
};
