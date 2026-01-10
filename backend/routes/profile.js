const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const formatSchemaError = (error) => {
  if (error?.message?.includes("schema cache")) {
    return "Database schema missing. Run backend/supabase/schema.sql in Supabase.";
  }
  return error?.message || "Request failed.";
};

router.get("/me", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: formatSchemaError(error) });
  }

  let resolvedProfile = profile;

  if (!resolvedProfile) {
    const displayName =
      req.user.user_metadata?.display_name ||
      req.user.email?.split("@")[0] ||
      "Player";
    const handle = req.user.email ? req.user.email.split("@")[0] : null;

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: displayName,
        handle,
      })
      .select("id, display_name, handle, created_at")
      .single();

    if (createError) {
      return res.status(500).json({ error: formatSchemaError(createError) });
    }

    resolvedProfile = created;
  }

  return res.json({
    profile: {
      id: resolvedProfile.id,
      displayName: resolvedProfile.display_name,
      handle: resolvedProfile.handle,
      createdAt: resolvedProfile.created_at,
      email: req.user.email || null,
    },
    stats: {
      wins: 0,
      streak: 0,
      accuracy: 0,
    },
  });
});

module.exports = router;
