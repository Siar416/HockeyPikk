const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { getPlayerGoalsForDate, getTeamRecordVsOpponent } = require("../lib/nhlStatsClient");
const { getSeasonIdForDate, getTodayDateKey } = require("../lib/seasonUtils");

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

  if (!data || data.length === 0) {
    return res.json({ boards: [] });
  }

  const boardIds = data.map((board) => board.id);
  const { data: pickRows, error: picksError } = await supabase
    .from("picks")
    .select(
      "id, board_id, board_group_id, nhl_player_id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, game_goals, game_played, game_updated_at, is_locked, board_groups (label, sort_order)"
    )
    .in("board_id", boardIds)
    .eq("user_id", userId)
    .order("sort_order", { foreignTable: "board_groups" });

  if (picksError) {
    return res.status(500).json({ error: formatSchemaError(picksError) });
  }

  const picksByBoard = new Map();
  (pickRows ?? []).forEach((pick) => {
    if (!picksByBoard.has(pick.board_id)) {
      picksByBoard.set(pick.board_id, []);
    }
    picksByBoard.get(pick.board_id).push(pick);
  });

  const todayKey = getTodayDateKey();
  const goalCache = new Map();
  const recordCache = new Map();
  const updates = new Map();
  const updateTimestamp = new Date().toISOString();
  const resolveGoals = async ({ playerId, dateKey }) => {
    if (!playerId || !dateKey) return null;
    const cacheKey = `${playerId}-${dateKey}`;
    if (goalCache.has(cacheKey)) return goalCache.get(cacheKey);
    const seasonId = getSeasonIdForDate(dateKey);
    const result = await getPlayerGoalsForDate({
      playerId,
      dateKey,
      seasonId,
    });
    goalCache.set(cacheKey, result);
    return result;
  };
  const resolveRecord = async ({ teamCode, opponentCode, seasonId }) => {
    if (!teamCode || !opponentCode || !seasonId) return null;
    const cacheKey = `${teamCode}-${opponentCode}-${seasonId}`;
    if (recordCache.has(cacheKey)) return recordCache.get(cacheKey);
    const record = await getTeamRecordVsOpponent({
      teamCode,
      opponentCode,
      seasonId,
    });
    recordCache.set(cacheKey, record);
    return record;
  };

  const boards = await Promise.all(
    data.map(async (board) => {
      const boardPicks = picksByBoard.get(board.id) ?? [];
      const seasonId = getSeasonIdForDate(board.board_date);
      const isPast = Boolean(
        board.board_date && board.board_date < todayKey
      );
      const isToday = board.board_date === todayKey;
      const canResolveResults = Boolean(seasonId) && (isPast || isToday);

      const picks = await Promise.all(
        boardPicks.map(async (pick) => {
          let goals = pick.game_goals;
          let played = pick.game_played;
          let shouldUpdate = false;

          if (
            canResolveResults &&
            pick.nhl_player_id &&
            (goals === null || played === null)
          ) {
            const goalResult = await resolveGoals({
              playerId: pick.nhl_player_id,
              dateKey: board.board_date,
            });

            if (goalResult?.played) {
              goals = goalResult.goals ?? 0;
              played = true;
              shouldUpdate = true;
            } else if (goalResult && goalResult.played === false && isPast) {
              goals = 0;
              played = false;
              shouldUpdate = true;
            }
          }

          if (shouldUpdate && pick.id) {
            updates.set(pick.id, {
              id: pick.id,
              game_goals: goals,
              game_played: played,
              game_updated_at: updateTimestamp,
            });
          }

          const resolvedGoals = played === null ? null : goals;
          const opponentRecord = await resolveRecord({
            teamCode: pick.team_code,
            opponentCode: pick.opponent_team_code,
            seasonId,
          });

          return {
            ...pick,
            opponent_record: opponentRecord,
            goals: resolvedGoals,
            played_game: played ?? null,
            scored_goal:
              typeof resolvedGoals === "number" && resolvedGoals > 0,
          };
        })
      );

      return {
        ...board,
        picks,
      };
    })
  );

  if (updates.size) {
    const updateList = Array.from(updates.values());
    const results = await Promise.all(
      updateList.map((update) =>
        supabase
          .from("picks")
          .update({
            game_goals: update.game_goals,
            game_played: update.game_played,
            game_updated_at: update.game_updated_at,
          })
          .eq("id", update.id)
      )
    );

    const updateError = results.find((result) => result.error)?.error;
    if (updateError) {
      return res.status(500).json({ error: formatSchemaError(updateError) });
    }
  }

  return res.json({ boards });
});

module.exports = router;
