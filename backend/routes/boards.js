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
        "id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, season_games_played, season_goals, season_assists, season_points, season_shots, season_pp_points, season_shooting_pct, season_avg_toi, season_faceoff_pct, last5_games, last5_goals, last5_points, last5_shots, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
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
      .eq("board_id", resolvedBoard.id)
      .eq("status", "pending"),
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

router.post("/:id/lock", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.params.id;

  if (!boardId) {
    return res.status(400).json({ error: "boardId is required." });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, status, lock_at, created_by")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board) {
    return res.status(404).json({ error: "Board not found." });
  }

  if (board.created_by !== userId) {
    return res.status(403).json({ error: "Not authorized." });
  }

  const lockAt = board.lock_at || new Date().toISOString();

  const { data: lockedBoard, error: lockError } = await supabase
    .from("boards")
    .update({ status: "locked", lock_at: lockAt })
    .eq("id", boardId)
    .select("id, status, lock_at")
    .single();

  if (lockError) {
    return res.status(500).json({ error: formatSchemaError(lockError) });
  }

  const { data: lockedPicks, error: picksError } = await supabase
    .from("picks")
    .update({ is_locked: true })
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select(
      "id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, season_games_played, season_goals, season_assists, season_points, season_shots, season_pp_points, season_shooting_pct, season_avg_toi, season_faceoff_pct, last5_games, last5_goals, last5_points, last5_shots, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
    )
    .order("sort_order", { foreignTable: "board_groups" });

  if (picksError) {
    return res.status(500).json({ error: formatSchemaError(picksError) });
  }

  return res.json({
    board: lockedBoard,
    picks: lockedPicks ?? [],
  });
});

module.exports = router;
