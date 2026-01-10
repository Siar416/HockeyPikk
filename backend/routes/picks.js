const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { getPicks } = require("../lib/hockeyChallengeClient");
const { getTeamName } = require("../lib/teamNames");

const router = express.Router();

const formatUpstreamError = (error) => error?.message || "Upstream error.";

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
    .select("id")
    .eq("id", boardId)
    .eq("created_by", userId)
    .maybeSingle();

  if (boardError) {
    return res.status(500).json({ error: boardError.message });
  }

  if (!board) {
    return res.status(404).json({ error: "Board not found." });
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

  const rows = selections
    .filter((selection) => groupIdSet.has(selection.boardGroupId))
    .map((selection) => {
      const playerId = Number(selection.playerId);
      if (!Number.isFinite(playerId)) return null;
      const player = playerMap.get(playerId);
      if (!player) return null;

      const teamCode = player.team || "";
      return {
        board_id: boardId,
        board_group_id: selection.boardGroupId,
        user_id: userId,
        nhl_player_id: player.nhlPlayerId,
        player_name:
          player.fullName || `${player.firstName || ""} ${player.lastName || ""}`.trim(),
        team_code: teamCode,
        team_name: getTeamName(teamCode),
        is_locked: false,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid picks selected." });
  }

  const { data: saved, error: saveError } = await supabase
    .from("picks")
    .upsert(rows, { onConflict: "board_group_id,user_id" })
    .select(
      "id, player_name, team_code, team_name, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
    );

  if (saveError) {
    return res.status(500).json({ error: saveError.message });
  }

  return res.json({ picks: saved ?? [] });
});

module.exports = router;
