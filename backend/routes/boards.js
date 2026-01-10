const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const DEFAULT_GROUP_LABELS = ["Group 1", "Group 2", "Group 3"];
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formatSchemaError = (error) => {
  if (error?.message?.includes("schema cache")) {
    return "Database schema missing. Run backend/supabase/schema.sql in Supabase.";
  }
  return error?.message || "Request failed.";
};

const getDateKey = (input) => {
  if (input && DATE_KEY_REGEX.test(input)) {
    return input;
  }
  return new Date().toISOString().slice(0, 10);
};

const fetchBoardForDate = async (supabase, { userId, dateKey }) =>
  supabase
    .from("boards")
    .select(
      "id, board_date, status, lock_at, created_by, board_groups (id, label, sort_order)"
    )
    .eq("created_by", userId)
    .eq("board_date", dateKey)
    .order("sort_order", { foreignTable: "board_groups" })
    .maybeSingle();

const createBoardWithGroups = async (supabase, { userId, dateKey }) => {
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .insert({
      board_date: dateKey,
      created_by: userId,
      status: "draft",
    })
    .select("id, board_date, status, lock_at, created_by")
    .single();

  if (boardError) {
    return { data: null, error: boardError };
  }

  const groupsPayload = DEFAULT_GROUP_LABELS.map((label, index) => ({
    board_id: board.id,
    label,
    sort_order: index,
  }));

  const { error: groupsError } = await supabase
    .from("board_groups")
    .insert(groupsPayload);

  if (groupsError) {
    return { data: board, error: groupsError };
  }

  const { data: boardWithGroups, error: boardSelectError } = await supabase
    .from("boards")
    .select(
      "id, board_date, status, lock_at, created_by, board_groups (id, label, sort_order)"
    )
    .eq("id", board.id)
    .order("sort_order", { foreignTable: "board_groups" })
    .single();

  if (boardSelectError) {
    return { data: board, error: boardSelectError };
  }

  return { data: boardWithGroups, error: null };
};

router.get("/today", requireSupabase, requireAuth, async (req, res) => {
  const userId = req.user.id;
  const dateKey = getDateKey(req.query.date);
  const supabase = req.supabase;

  const { data: board, error: boardError } = await fetchBoardForDate(
    supabase,
    {
      userId,
      dateKey,
    }
  );

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  let resolvedBoard = board;

  if (!resolvedBoard) {
    const { data: createdBoard, error: createError } =
      await createBoardWithGroups(supabase, {
        userId,
        dateKey,
      });

    if (createError) {
      if (createError.code === "23505") {
        const { data: retryBoard, error: retryError } =
          await fetchBoardForDate(supabase, {
            userId,
            dateKey,
          });

        if (retryError) {
          return res.status(500).json({ error: formatSchemaError(retryError) });
        }

        resolvedBoard = retryBoard;
      } else {
        return res.status(500).json({ error: formatSchemaError(createError) });
      }
    } else {
      resolvedBoard = createdBoard;
    }
  }

  if (!resolvedBoard) {
    return res.status(500).json({ error: "Unable to load today's board." });
  }

  const [
    { data: picks, error: picksError },
    { count: commentCount, error: commentsError },
    { count: suggestionCount, error: suggestionsError },
  ] = await Promise.all([
    supabase
      .from("picks")
      .select(
        "id, player_name, team_code, team_name, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
      )
      .eq("board_id", resolvedBoard.id)
      .eq("user_id", userId)
      .order("sort_order", { foreignTable: "board_groups" }),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("board_id", resolvedBoard.id),
    supabase
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("board_id", resolvedBoard.id),
  ]);

  const queryError = picksError || commentsError || suggestionsError;

  if (queryError) {
    return res.status(500).json({ error: formatSchemaError(queryError) });
  }

  return res.json({
    board: resolvedBoard,
    picks: picks ?? [],
    counts: {
      comments: commentCount ?? 0,
      suggestions: suggestionCount ?? 0,
    },
  });
});

module.exports = router;
