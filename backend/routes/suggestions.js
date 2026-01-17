const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { getPicks } = require("../lib/hockeyChallengeClient");
const { getPlayerStats, getTeamRecordVsOpponent } = require("../lib/nhlStatsClient");
const { getSeasonIdForDate } = require("../lib/seasonUtils");
const { getTeamName } = require("../lib/teamNames");

const router = express.Router();

const formatSchemaError = (error) => {
  if (error?.message?.includes("schema cache")) {
    return "Database schema missing. Run backend/supabase/schema.sql in Supabase.";
  }
  return error?.message || "Request failed.";
};

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

const buildPlayerName = (player) =>
  player.fullName ||
  `${player.firstName || ""} ${player.lastName || ""}`.trim() ||
  "Unknown";

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

const getBoard = async (supabase, { boardId }) =>
  supabase
    .from("boards")
    .select("id, created_by, status, board_date")
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

  if (!board || board.created_by !== userId) {
    return res.status(404).json({ error: "Board not found." });
  }

  const { data: suggestionRows, error: suggestionsError } = await supabase
    .from("suggestions")
    .select(
      "id, board_id, board_group_id, suggested_by, nhl_player_id, player_name, team_code, team_name, reason, status, created_at, board_groups (label, sort_order)"
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  if (suggestionsError) {
    return res.status(500).json({ error: formatSchemaError(suggestionsError) });
  }

  const userIds = [
    ...new Set((suggestionRows || []).map((row) => row.suggested_by)),
  ];
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

  const suggestions = (suggestionRows || []).map((row) => ({
    id: row.id,
    boardId: row.board_id,
    boardGroupId: row.board_group_id,
    suggestedBy: row.suggested_by,
    nhlPlayerId: row.nhl_player_id,
    playerName: row.player_name,
    teamCode: row.team_code,
    teamName: row.team_name,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    groupLabel: row.board_groups?.label ?? "Group",
    groupSortOrder: row.board_groups?.sort_order ?? 0,
    displayName: profileMap.get(row.suggested_by)?.display_name || "Unknown",
  }));

  return res.json({ suggestions });
});

router.post("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const boardId = req.body?.boardId;
  const boardGroupId = req.body?.boardGroupId;
  const playerId = Number(req.body?.playerId);
  const reason = String(req.body?.reason || "").trim() || null;

  if (!boardId || !boardGroupId || !Number.isFinite(playerId)) {
    return res
      .status(400)
      .json({ error: "boardId, boardGroupId, and playerId are required." });
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

  if (board.created_by === userId) {
    return res
      .status(400)
      .json({ error: "You cannot suggest on your own board." });
  }

  if (board.status === "locked") {
    return res.status(400).json({ error: "Board is locked." });
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

  const { data: group, error: groupError } = await supabase
    .from("board_groups")
    .select("id, label, sort_order")
    .eq("id", boardGroupId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (groupError) {
    return res.status(500).json({ error: formatSchemaError(groupError) });
  }

  if (!group) {
    return res.status(404).json({ error: "Group not found." });
  }

  let pickData;
  try {
    pickData = await getPicks();
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Upstream error." });
  }

  const playerMap = buildPlayerMap(pickData.playerLists || []);
  const player = playerMap.get(playerId);

  if (!player) {
    return res.status(400).json({ error: "Player not found." });
  }

  const teamCode = player.team || "";
  const playerName = buildPlayerName(player);

  const { data: existingPick, error: pickError } = await supabase
    .from("picks")
    .select("nhl_player_id")
    .eq("board_id", boardId)
    .eq("board_group_id", boardGroupId)
    .eq("user_id", board.created_by)
    .maybeSingle();

  if (pickError) {
    return res.status(500).json({ error: formatSchemaError(pickError) });
  }

  if (existingPick?.nhl_player_id === player.nhlPlayerId) {
    return res.status(409).json({
      error: "That player is already selected for this group.",
    });
  }

  const { data: suggestionRow, error: insertError } = await supabase
    .from("suggestions")
    .insert({
      board_id: boardId,
      board_group_id: boardGroupId,
      suggested_by: userId,
      nhl_player_id: player.nhlPlayerId,
      player_name: playerName,
      team_code: teamCode,
      team_name: getTeamName(teamCode),
      reason,
      status: "pending",
    })
    .select(
      "id, board_id, board_group_id, suggested_by, nhl_player_id, player_name, team_code, team_name, reason, status, created_at"
    )
    .single();

  if (insertError) {
    return res.status(500).json({ error: formatSchemaError(insertError) });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return res.json({
    suggestion: {
      id: suggestionRow.id,
      boardId: suggestionRow.board_id,
      boardGroupId: suggestionRow.board_group_id,
      suggestedBy: suggestionRow.suggested_by,
      nhlPlayerId: suggestionRow.nhl_player_id,
      playerName: suggestionRow.player_name,
      teamCode: suggestionRow.team_code,
      teamName: suggestionRow.team_name,
      reason: suggestionRow.reason,
      status: suggestionRow.status,
      createdAt: suggestionRow.created_at,
      groupLabel: group.label,
      groupSortOrder: group.sort_order ?? 0,
      displayName:
        profile?.display_name ||
        req.user.user_metadata?.display_name ||
        "Player",
    },
  });
});

router.patch("/:id", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const suggestionId = req.params.id;
  const rawStatus = req.body?.status;
  const status = rawStatus === "declined" ? "rejected" : rawStatus;

  if (!["accepted", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({ error: "Status must be accepted or rejected." });
  }

  const { data: suggestion, error: suggestionError } = await supabase
    .from("suggestions")
    .select(
      "id, board_id, board_group_id, nhl_player_id, player_name, team_code, team_name, status"
    )
    .eq("id", suggestionId)
    .maybeSingle();

  if (suggestionError) {
    return res.status(500).json({ error: formatSchemaError(suggestionError) });
  }

  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found." });
  }

  const { data: board, error: boardError } = await getBoard(supabase, {
    boardId: suggestion.board_id,
  });

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board || board.created_by !== userId) {
    return res.status(403).json({ error: "Not authorized." });
  }

  if (suggestion.status !== "pending") {
    return res.status(400).json({ error: "Suggestion already handled." });
  }

  if (board.status === "locked" && status === "accepted") {
    return res.status(400).json({ error: "Board is locked." });
  }

  let pickRow = null;

  if (status === "accepted") {
    let opponentCode = null;
    let opponentName = null;
    let position = null;
    let line = null;
    let ppLine = null;
    const stats = await getPlayerStats(suggestion.nhl_player_id);

    try {
      const pickData = await getPicks();
      const playerMap = buildPlayerMap(pickData.playerLists || []);
      const player = playerMap.get(suggestion.nhl_player_id);
      if (player) {
        opponentCode = player.opponentTeam || null;
        opponentName = opponentCode ? getTeamName(opponentCode) : null;
        position = player.position || null;
        const lineValue = player.line ?? null;
        const ppValue = player.ppLine ?? null;
        line = lineValue === null || lineValue === undefined ? null : String(lineValue);
        ppLine = ppValue === null || ppValue === undefined ? null : String(ppValue);
      }
    } catch {
      // Allow accepting the suggestion even if stats are unavailable.
    }

    const { data: savedPick, error: pickError } = await supabase
      .from("picks")
      .upsert(
        {
          board_id: suggestion.board_id,
          board_group_id: suggestion.board_group_id,
          user_id: userId,
          nhl_player_id: suggestion.nhl_player_id,
          player_name: suggestion.player_name,
          team_code: suggestion.team_code,
          team_name: suggestion.team_name,
          opponent_team_code: opponentCode,
          opponent_team_name: opponentName,
          position,
          line,
          pp_line: ppLine,
          game_goals: null,
          game_played: null,
          game_updated_at: null,
          is_locked: false,
          ...buildStatsColumns(stats),
        },
        { onConflict: "board_group_id,user_id" }
      )
      .select(
        "id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, season_games_played, season_goals, season_assists, season_points, season_shots, season_pp_points, season_shooting_pct, season_avg_toi, season_faceoff_pct, last5_games, last5_goals, last5_points, last5_shots, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
      )
      .single();

    if (pickError) {
      return res.status(500).json({ error: formatSchemaError(pickError) });
    }

    if (savedPick) {
      const seasonId = getSeasonIdForDate(board?.board_date);
      const opponentRecord = await getTeamRecordVsOpponent({
        teamCode: savedPick.team_code,
        opponentCode: savedPick.opponent_team_code,
        seasonId,
      });
      pickRow = {
        ...savedPick,
        opponent_record: opponentRecord,
      };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("suggestions")
    .update({ status })
    .eq("id", suggestionId)
    .select("id, status")
    .single();

  if (updateError) {
    return res.status(500).json({ error: formatSchemaError(updateError) });
  }

  return res.json({
    suggestion: {
      id: updated.id,
      status: updated.status,
    },
    pick: pickRow,
  });
});

module.exports = router;
