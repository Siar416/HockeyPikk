const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const MAX_LIMIT = 50;

const formatSchemaError = (error) => {
  if (error?.message?.includes("schema cache")) {
    return "Database schema missing. Run backend/supabase/schema.sql in Supabase.";
  }
  return error?.message || "Request failed.";
};

router.get("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const limitParam = Number(req.query.limit || 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : 10;

  const { data, error } = await supabase
    .from("boards")
    .select("id, board_date, status, lock_at, created_at")
    .eq("created_by", userId)
    .order("board_date", { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: formatSchemaError(error) });
  }

  return res.json({ boards: data ?? [] });
});

module.exports = router;
