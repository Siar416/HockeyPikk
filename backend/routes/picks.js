const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { getPicks } = require("../lib/hockeyChallengeClient");
const { getPlayerStats } = require("../lib/nhlStatsClient");
const { getTeamName } = require("../lib/teamNames");

const router = express.Router();

const formatUpstreamError = (error) => error?.message || "Upstream error.";

const buildStatsColumns = (stats) => ({
  season_games_played: stats?.seasonGamesPlayed ?? null,
  season_goals: stats?.seasonGoals ?? null,
  season_assists: stats?.seasonAssists ?? null,
  season_points: stats?.seasonPoints ?? null,
  season_shots: stats?.seasonShots ?? null,
  season_pp_points: stats?.seasonPowerPlayPoints ?? null,
  season_shooting_pct: stats?.seasonShootingPct ?? null,
  season_avg_toi: stats?.seasonAvgToi ?? null,
  season_faceoff_pct: stats?.seasonFaceoffPct ?? null,
  last5_games: stats?.last5Games ?? null,
  last5_goals: stats?.last5Goals ?? null,
  last5_points: stats?.last5Points ?? null,
  last5_shots: stats?.last5Shots ?? null,
});

const buildPlayerMap = (playerLists) => {
  const map = new Map();
  (playerLists || []).forEach((list) => {
    (list.players || []).forEach((player) => {
      if (player?.nhlPlayerId) {
        map.set(player.nhlPlayerId, player);
      }
    });
  });
  return map;
};

router.get("/options", requireSupabase, requireAuth, async (_req, res) => {
  try {
    const data = await getPicks();
    const groups = (data.playerLists || []).map((list) => ({
      id: list.id,
      label: `Group ${list.id}`,
      players: (list.players || []).map((player) => ({
        id: player.nhlPlayerId,
        fullName:
          player.fullName || `${player.firstName || ""} ${player.lastName || ""}`.trim(),
        teamCode: player.team,
        opponentTeam: player.opponentTeam,
        position: player.position,
        line: player.line,
        ppLine: player.ppLine,
        isUnavailable: player.unavailable,
      })),
    }));

    return res.json({
      dateTimeAvailable: data.dateTimeAvailable || null,
      season: data.season || null,
      seasonType: data.seasonType || null,
      groups,
    });
  } catch (error) {
    return res.status(502).json({ error: formatUpstreamError(error) });
  }
});

router.post("/", requireSupabase, requireAuth, async (req, res) => {
  const { boardId, selections } = req.body ?? {};
  const supabase = req.supabase;
  const userId = req.user.id;

  if (!boardId || !Array.isArray(selections)) {
    return res.status(400).json({
      error: "boardId and selections are required.",
    });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, status")
    .eq("id", boardId)
    .eq("created_by", userId)
    .maybeSingle();

  if (boardError) {
    return res.status(500).json({ error: boardError.message });
  }

  if (!board) {
    return res.status(404).json({ error: "Board not found." });
  }

  if (board.status === "locked") {
    return res.status(400).json({ error: "Board is locked." });
  }

  const { data: groups, error: groupsError } = await supabase
    .from("board_groups")
    .select("id, label, sort_order")
    .eq("board_id", boardId);

  if (groupsError) {
    return res.status(500).json({ error: groupsError.message });
  }

  const groupIdSet = new Set((groups || []).map((group) => group.id));

  let pickData;
  try {
    pickData = await getPicks();
  } catch (error) {
    return res.status(502).json({ error: formatUpstreamError(error) });
  }

  const playerMap = buildPlayerMap(pickData.playerLists || []);

  const rows = await Promise.all(
    selections
      .filter((selection) => groupIdSet.has(selection.boardGroupId))
      .map(async (selection) => {
      const playerId = Number(selection.playerId);
      if (!Number.isFinite(playerId)) return null;
      const player = playerMap.get(playerId);
      if (!player) return null;

      const teamCode = player.team || "";
      const opponentCode = player.opponentTeam || null;
      const lineValue = player.line ?? null;
      const ppValue = player.ppLine ?? null;
      const line = lineValue === null || lineValue === undefined ? null : String(lineValue);
      const ppLine = ppValue === null || ppValue === undefined ? null : String(ppValue);
      const stats = await getPlayerStats(player.nhlPlayerId);
      return {
        board_id: boardId,
        board_group_id: selection.boardGroupId,
        user_id: userId,
        nhl_player_id: player.nhlPlayerId,
        player_name:
          player.fullName || `${player.firstName || ""} ${player.lastName || ""}`.trim(),
        team_code: teamCode,
        team_name: getTeamName(teamCode),
        opponent_team_code: opponentCode,
        opponent_team_name: opponentCode ? getTeamName(opponentCode) : null,
        position: player.position || null,
        line,
        pp_line: ppLine,
        is_locked: false,
        ...buildStatsColumns(stats),
      };
      })
  );

  const filteredRows = rows.filter(Boolean);

  if (filteredRows.length === 0) {
    return res.status(400).json({ error: "No valid picks selected." });
  }

  const { data: saved, error: saveError } = await supabase
    .from("picks")
    .upsert(filteredRows, { onConflict: "board_group_id,user_id" })
    .select(
      "id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, season_games_played, season_goals, season_assists, season_points, season_shots, season_pp_points, season_shooting_pct, season_avg_toi, season_faceoff_pct, last5_games, last5_goals, last5_points, last5_shots, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
    );

  if (saveError) {
    return res.status(500).json({ error: saveError.message });
  }

  return res.json({ picks: saved ?? [] });
});

module.exports = router;
