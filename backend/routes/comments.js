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

const getBoardForUser = async (supabase, { boardId, userId }) =>
  supabase
    .from("boards")
    .select("id, created_by")
    .eq("id", boardId)
    .maybeSingle()
    .then(({ data, error }) => ({ data, error }));

router.get("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.query.boardId;

  if (!boardId) {
    return res.status(400).json({ error: "boardId is required." });
  }

  const { data: board, error: boardError } = await getBoardForUser(supabase, {
    boardId,
    userId,
  });

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board || board.created_by !== userId) {
    return res.status(404).json({ error: "Board not found." });
  }

  const { data: commentRows, error: commentsError } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  if (commentsError) {
    return res.status(500).json({ error: formatSchemaError(commentsError) });
  }

  const userIds = [...new Set((commentRows || []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, handle")
          .in("id", userIds)
      : { data: [], error: null };

  if (profilesError) {
    return res.status(500).json({ error: formatSchemaError(profilesError) });
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const comments = (commentRows || []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    userId: row.user_id,
    displayName: profileMap.get(row.user_id)?.display_name || "Unknown",
    handle: profileMap.get(row.user_id)?.handle || null,
  }));

  return res.json({ comments });
});

router.post("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.body?.boardId;
  const body = String(req.body?.body || "").trim();

  if (!boardId || !body) {
    return res.status(400).json({ error: "boardId and body are required." });
  }

  const { data: board, error: boardError } = await getBoardForUser(supabase, {
    boardId,
    userId,
  });

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board || board.created_by !== userId) {
    return res.status(404).json({ error: "Board not found." });
  }

  const { data: commentRow, error: insertError } = await supabase
    .from("comments")
    .insert({
      board_id: boardId,
      user_id: userId,
      body,
    })
    .select("id, body, created_at, user_id")
    .single();

  if (insertError) {
    return res.status(500).json({ error: formatSchemaError(insertError) });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: formatSchemaError(profileError) });
  }

  return res.json({
    comment: {
      id: commentRow.id,
      body: commentRow.body,
      createdAt: commentRow.created_at,
      userId: commentRow.user_id,
      displayName: profile?.display_name || "Unknown",
      handle: profile?.handle || null,
    },
  });
});

module.exports = router;
