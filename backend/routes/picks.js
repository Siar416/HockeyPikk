const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { getPicks } = require("../lib/hockeyChallengeClient");
const {
  getFirstGameStartTime,
  getPlayerStats,
  getTeamRecordVsOpponent,
} = require("../lib/nhlStatsClient");
const { getSeasonIdForDate, getTodayDateKey } = require("../lib/seasonUtils");
const { getTeamName } = require("../lib/teamNames");

const router = express.Router();

const formatUpstreamError = (error) => error?.message || "Upstream error.";

const SOURCE_TIME_ZONE = "America/Edmonton";
const DISPLAY_TIME_ZONE = "America/New_York";

const parseDateTimeParts = (value) => {
  if (!value || typeof value !== "string") return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second || 0),
  };
};

const getTimeZoneOffsetMinutes = (timeZone, date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcTime = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return (utcTime - date.getTime()) / 60000;
};

const getZonedDate = (parts, timeZone) => {
  if (!parts) return null;
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const guessDate = new Date(utcGuess);
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, guessDate);
  return new Date(utcGuess - offsetMinutes * 60000);
};

const formatTimeInZone = (value, timeZone) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
};

const formatTimeLabel = (value) => {
  return formatTimeInZone(value, DISPLAY_TIME_ZONE);
};

const formatAvailableTimeLabel = (value) => {
  const parts = parseDateTimeParts(value);
  if (!parts) return null;
  const zonedDate = getZonedDate(parts, SOURCE_TIME_ZONE);
  return formatTimeInZone(zonedDate, DISPLAY_TIME_ZONE);
};

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

router.get("/meta", async (req, res) => {
  try {
    const data = await getPicks();
    const dateKey = String(req.query?.date || "").trim() || getTodayDateKey();
    const lockTime = await getFirstGameStartTime(dateKey);
    const dateTimeAvailable = data.dateTimeAvailable || null;
    const lockTimeLabel =
      formatTimeLabel(lockTime) || formatAvailableTimeLabel(dateTimeAvailable);
    return res.json({
      dateTimeAvailable,
      season: data.season || null,
      seasonType: data.seasonType || null,
      lockTime,
      lockTimeLabel,
    });
  } catch (error) {
    return res.status(502).json({ error: formatUpstreamError(error) });
  }
});

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
    .select("id, status, board_date")
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
        game_goals: null,
        game_played: null,
        game_updated_at: null,
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

  const seasonId = getSeasonIdForDate(board?.board_date);
  const recordCache = new Map();
  const resolveRecord = async (teamCode, opponentCode) => {
    if (!seasonId || !teamCode || !opponentCode) return null;
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

  const picksWithRecords = await Promise.all(
    (saved ?? []).map(async (pick) => ({
      ...pick,
      opponent_record: await resolveRecord(
        pick.team_code,
        pick.opponent_team_code
      ),
    }))
  );

  return res.json({ picks: picksWithRecords });
});

module.exports = router;
