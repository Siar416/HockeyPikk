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
    .select("id, display_name, created_at")
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

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: displayName,
      })
      .select("id, display_name, created_at")
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

router.patch("/me", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const rawDisplayName = req.body?.displayName;

  const updates = {};
  if (rawDisplayName !== undefined) {
    const displayName = String(rawDisplayName).trim();
    if (!displayName) {
      return res.status(400).json({ error: "Display name is required." });
    }
    updates.display_name = displayName;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No profile updates provided." });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id, display_name, created_at")
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: formatSchemaError(error) });
  }

  if (!updated) {
    return res.status(404).json({ error: "Profile not found." });
  }

  if (updates.display_name) {
    const currentMetadata = req.user.user_metadata || {};
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...currentMetadata,
          display_name: updates.display_name,
        },
      }
    );
    if (authError) {
      // Best effort: keep profile updated even if auth metadata fails.
    }
  }

  return res.json({
    profile: {
      id: updated.id,
      displayName: updated.display_name,
      createdAt: updated.created_at,
      email: req.user.email || null,
    },
  });
});

module.exports = router;
