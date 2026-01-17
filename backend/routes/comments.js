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

const getBoard = async (supabase, { boardId }) =>
  supabase
    .from("boards")
    .select("id, created_by")
    .eq("id", boardId)
    .maybeSingle()
    .then(({ data, error }) => ({ data, error }));

const areFriends = async (supabase, { userId, friendId }) => {
  const { data, error } = await supabase
    .from("friends")
    .select("id")
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )
    .limit(1);

  if (error) {
    return { isFriend: false, error };
  }

  return { isFriend: (data ?? []).length > 0, error: null };
};

router.get("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.query.boardId;

  if (!boardId) {
    return res.status(400).json({ error: "boardId is required." });
  }

  const { data: board, error: boardError } = await getBoard(supabase, {
    boardId,
  });

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board) {
    return res.status(404).json({ error: "Board not found." });
  }

  if (board.created_by !== userId) {
    const { isFriend, error: friendError } = await areFriends(supabase, {
      userId,
      friendId: board.created_by,
    });

    if (friendError) {
      return res.status(500).json({ error: formatSchemaError(friendError) });
    }

    if (!isFriend) {
      return res.status(403).json({ error: "Not authorized." });
    }
  }

  const { data: commentRows, error: commentsError } = await supabase
    .from("comments")
    .select("id, body, created_at, user_id, parent_id")
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
          .select("id, display_name")
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
    parentId: row.parent_id,
    displayName: profileMap.get(row.user_id)?.display_name || "Unknown",
  }));

  return res.json({ comments });
});

router.post("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.body?.boardId;
  const body = String(req.body?.body || "").trim();
  const parentId = req.body?.parentId ?? null;

  if (!boardId || !body) {
    return res.status(400).json({ error: "boardId and body are required." });
  }

  const { data: board, error: boardError } = await getBoard(supabase, {
    boardId,
  });

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board) {
    return res.status(404).json({ error: "Board not found." });
  }

  if (board.created_by !== userId) {
    const { isFriend, error: friendError } = await areFriends(supabase, {
      userId,
      friendId: board.created_by,
    });

    if (friendError) {
      return res.status(500).json({ error: formatSchemaError(friendError) });
    }

    if (!isFriend) {
      return res.status(403).json({ error: "Not authorized." });
    }
  }

  if (parentId) {
    const { data: parentComment, error: parentError } = await supabase
      .from("comments")
      .select("id, board_id")
      .eq("id", parentId)
      .maybeSingle();

    if (parentError) {
      return res.status(500).json({ error: formatSchemaError(parentError) });
    }

    if (!parentComment || parentComment.board_id !== boardId) {
      return res.status(400).json({ error: "Invalid parent comment." });
    }
  }

  const { data: commentRow, error: insertError } = await supabase
    .from("comments")
    .insert({
      board_id: boardId,
      user_id: userId,
      parent_id: parentId,
      body,
    })
    .select("id, body, created_at, user_id, parent_id")
    .single();

  if (insertError) {
    return res.status(500).json({ error: formatSchemaError(insertError) });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
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
      parentId: commentRow.parent_id,
      displayName: profile?.display_name || "Unknown",
    },
  });
});

module.exports = router;
