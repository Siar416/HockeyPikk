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

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getDateKey = (input) => {
  if (input && DATE_KEY_REGEX.test(input)) {
    return input;
  }
  return new Date().toISOString().slice(0, 10);
};

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

const findUserByEmail = async (supabase, email) => {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return { user: null, error };
    }

    const users = data?.users ?? [];
    const match = users.find(
      (user) => user.email?.toLowerCase() === normalized
    );

    if (match) {
      return { user: match, error: null };
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return { user: null, error: null };
};

router.get("/", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;

  const { data: friendRows, error: friendsError } = await supabase
    .from("friends")
    .select("friend_id, created_at")
    .eq("user_id", userId);

  if (friendsError) {
    return res.status(500).json({ error: formatSchemaError(friendsError) });
  }

  const friendIds = (friendRows ?? []).map((row) => row.friend_id);
  const { data: friendProfiles, error: friendProfilesError } =
    friendIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", friendIds)
      : { data: [], error: null };

  if (friendProfilesError) {
    return res
      .status(500)
      .json({ error: formatSchemaError(friendProfilesError) });
  }

  const { data: requestRows, error: requestsError } = await supabase
    .from("friend_requests")
    .select("id, sender_id, status, created_at")
    .eq("recipient_id", userId)
    .eq("status", "pending");

  if (requestsError) {
    return res.status(500).json({ error: formatSchemaError(requestsError) });
  }

  const senderIds = (requestRows ?? []).map((row) => row.sender_id);
  const { data: senderProfiles, error: senderProfilesError } =
    senderIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", senderIds)
      : { data: [], error: null };

  if (senderProfilesError) {
    return res
      .status(500)
      .json({ error: formatSchemaError(senderProfilesError) });
  }

  const profileMap = new Map(
    (friendProfiles ?? []).map((profile) => [profile.id, profile])
  );
  const senderMap = new Map(
    (senderProfiles ?? []).map((profile) => [profile.id, profile])
  );

  const friends = (friendRows ?? []).map((row) => ({
    id: row.friend_id,
    createdAt: row.created_at,
    displayName: profileMap.get(row.friend_id)?.display_name || "Unknown",
  }));

  const requests = (requestRows ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    createdAt: row.created_at,
    status: row.status,
    displayName: senderMap.get(row.sender_id)?.display_name || "Unknown",
  }));

  return res.json({ friends, requests });
});

router.post("/requests", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const rawEmail = String(req.body?.email || "").trim();

  if (!rawEmail) {
    return res.status(400).json({ error: "Friend email is required." });
  }

  if (!rawEmail.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const email = rawEmail.toLowerCase();
  const { user: userRow, error: userError } = await findUserByEmail(
    supabase,
    email
  );

  if (userError) {
    return res.status(500).json({ error: formatSchemaError(userError) });
  }

  if (!userRow) {
    return res.status(404).json({ error: "No user found with that email." });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userRow.id)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: formatSchemaError(profileError) });
  }

  const recipient =
    profile || {
      id: userRow.id,
      display_name: "Player",
    };

  if (recipient.id === userId) {
    return res.status(400).json({ error: "You cannot invite yourself." });
  }

  const { data: existingFriend, error: friendError } = await supabase
    .from("friends")
    .select("id")
    .eq("user_id", userId)
    .eq("friend_id", recipient.id)
    .maybeSingle();

  if (friendError) {
    return res.status(500).json({ error: formatSchemaError(friendError) });
  }

  if (existingFriend) {
    return res.status(409).json({ error: "You are already friends." });
  }

  const { data: existingRequests, error: requestError } = await supabase
    .from("friend_requests")
    .select("id, status, sender_id, recipient_id")
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${recipient.id}),and(sender_id.eq.${recipient.id},recipient_id.eq.${userId})`
    );

  if (requestError) {
    return res.status(500).json({ error: formatSchemaError(requestError) });
  }

  const pendingRequest = (existingRequests ?? []).find(
    (request) => request.status === "pending"
  );

  if (pendingRequest) {
    return res.status(409).json({ error: "A request is already pending." });
  }

  const existingOutbound = (existingRequests ?? []).find(
    (request) =>
      request.sender_id === userId && request.recipient_id === recipient.id
  );

  if (existingOutbound && existingOutbound.status === "accepted") {
    return res.status(409).json({ error: "You are already friends." });
  }

  let requestRow = null;
  let saveError = null;

  if (existingOutbound && existingOutbound.status === "declined") {
    const { data, error } = await supabase
      .from("friend_requests")
      .update({ status: "pending" })
      .eq("id", existingOutbound.id)
      .select("id, sender_id, recipient_id, status, created_at")
      .single();

    requestRow = data;
    saveError = error;
  } else {
    const { data, error } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: userId,
        recipient_id: recipient.id,
        status: "pending",
      })
      .select("id, sender_id, recipient_id, status, created_at")
      .single();

    requestRow = data;
    saveError = error;
  }

  if (saveError) {
    return res.status(500).json({ error: formatSchemaError(saveError) });
  }

  return res.json({
    request: {
      id: requestRow.id,
      senderId: requestRow.sender_id,
      recipientId: requestRow.recipient_id,
      status: requestRow.status,
      createdAt: requestRow.created_at,
    },
    recipient: {
      id: recipient.id,
      displayName: recipient.display_name,
    },
  });
});

router.patch(
  "/requests/:id",
  requireSupabase,
  requireAuth,
  async (req, res) => {
    const supabase = req.supabase;
    const userId = req.user.id;
    const requestId = req.params.id;
    const status = req.body?.status;

    if (!["accepted", "declined"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Status must be accepted or declined." });
    }

    const { data: requestRow, error: requestError } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status, created_at")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      return res.status(500).json({ error: formatSchemaError(requestError) });
    }

    if (!requestRow) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (requestRow.recipient_id !== userId) {
      return res.status(403).json({ error: "Not authorized." });
    }

    if (requestRow.status !== "pending") {
      return res.status(400).json({ error: "Request already handled." });
    }

    const { data: updated, error: updateError } = await supabase
      .from("friend_requests")
      .update({ status })
      .eq("id", requestId)
      .select("id, sender_id, recipient_id, status, created_at")
      .single();

    if (updateError) {
      return res.status(500).json({ error: formatSchemaError(updateError) });
    }

    if (status === "accepted") {
      const rows = [
        { user_id: userId, friend_id: requestRow.sender_id },
        { user_id: requestRow.sender_id, friend_id: userId },
      ];

      const { error: friendsError } = await supabase
        .from("friends")
        .upsert(rows, { onConflict: "user_id,friend_id" });

      if (friendsError) {
        return res.status(500).json({ error: formatSchemaError(friendsError) });
      }
    }

    return res.json({
      request: {
        id: updated.id,
        senderId: updated.sender_id,
        recipientId: updated.recipient_id,
        status: updated.status,
        createdAt: updated.created_at,
      },
    });
  }
);

router.get("/:friendId/board", requireSupabase, requireAuth, async (req, res) => {
  const supabase = req.supabase;
  const userId = req.user.id;
  const friendId = req.params.friendId;
  const dateKey = getDateKey(req.query.date);

  if (!friendId) {
    return res.status(400).json({ error: "friendId is required." });
  }

  const { isFriend, error: friendError } = await areFriends(supabase, {
    userId,
    friendId,
  });

  if (friendError) {
    return res.status(500).json({ error: formatSchemaError(friendError) });
  }

  if (!isFriend) {
    return res.status(403).json({ error: "Not authorized." });
  }

  const { data: friendProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", friendId)
    .maybeSingle();

  if (profileError) {
    return res.status(500).json({ error: formatSchemaError(profileError) });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(
      "id, board_date, status, lock_at, created_by, board_groups (id, label, sort_order)"
    )
    .eq("created_by", friendId)
    .eq("board_date", dateKey)
    .order("sort_order", { foreignTable: "board_groups" })
    .maybeSingle();

  if (boardError) {
    return res.status(500).json({ error: formatSchemaError(boardError) });
  }

  if (!board) {
    return res.json({
      friend: {
        id: friendId,
        displayName: friendProfile?.display_name || "Unknown",
      },
      board: null,
      picks: [],
    });
  }

  const { data: picks, error: picksError } = await supabase
    .from("picks")
    .select(
      "id, player_name, team_code, team_name, opponent_team_code, opponent_team_name, position, line, pp_line, season_games_played, season_goals, season_assists, season_points, season_shots, season_pp_points, season_shooting_pct, season_avg_toi, season_faceoff_pct, last5_games, last5_goals, last5_points, last5_shots, is_locked, board_group_id, nhl_player_id, board_groups (label, sort_order)"
    )
    .eq("board_id", board.id)
    .eq("user_id", friendId)
    .order("sort_order", { foreignTable: "board_groups" });

  if (picksError) {
    return res.status(500).json({ error: formatSchemaError(picksError) });
  }

  return res.json({
    friend: {
      id: friendId,
      displayName: friendProfile?.display_name || "Unknown",
    },
    board,
    picks: picks ?? [],
  });
});

module.exports = router;
