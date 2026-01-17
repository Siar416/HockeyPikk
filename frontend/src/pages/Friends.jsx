import { useEffect, useMemo, useState } from "react";
import GroupPickCard from "../components/GroupPickCard";
import { getTodayDateKey } from "../lib/boardService";
import { createComment, fetchComments } from "../lib/commentsService";
import { fetchFriendBoard } from "../lib/friendBoardsService";
import {
  fetchFriends,
  respondToFriendRequest,
  sendFriendRequest,
} from "../lib/friendsService";
import { fetchPickOptions } from "../lib/picksService";
import { createSuggestion } from "../lib/suggestionsService";

const mapPickRows = (rows = []) =>
  rows
    .map((pick) => ({
      id: pick.id,
      groupLabel: pick.board_groups?.label ?? "Group",
      playerName: pick.player_name,
      teamCode: pick.team_code,
      teamName: pick.team_name,
      opponentTeamCode: pick.opponent_team_code,
      opponentTeamName: pick.opponent_team_name,
      opponentRecord: pick.opponent_record,
      position: pick.position,
      line: pick.line,
      ppLine: pick.pp_line,
      seasonGamesPlayed: pick.season_games_played,
      seasonGoals: pick.season_goals,
      seasonAssists: pick.season_assists,
      seasonPoints: pick.season_points,
      seasonShots: pick.season_shots,
      seasonPowerPlayPoints: pick.season_pp_points,
      seasonShootingPct: pick.season_shooting_pct,
      seasonAvgToi: pick.season_avg_toi,
      seasonFaceoffPct: pick.season_faceoff_pct,
      last5Games: pick.last5_games,
      last5Goals: pick.last5_goals,
      last5Points: pick.last5_points,
      last5Shots: pick.last5_shots,
      isLocked: pick.is_locked,
      sortOrder: pick.board_groups?.sort_order ?? 0,
      boardGroupId: pick.board_group_id,
      playerId: pick.nhl_player_id,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

const COMMENTS_PAGE_SIZE = 5;

const formatLineMeta = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^\d+$/.test(upper)) return `L${upper}`;
  if (upper.startsWith("L") || upper.startsWith("F") || upper.startsWith("D")) {
    return upper;
  }
  return `L${upper}`;
};

const formatPpMeta = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^\d+$/.test(upper)) return `PP${upper}`;
  if (upper.startsWith("PP")) return upper;
  return `PP${upper}`;
};

export default function Friends({ session, onRequestsCount }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [requestActionId, setRequestActionId] = useState(null);
  const [requestActionError, setRequestActionError] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [friendProfile, setFriendProfile] = useState(null);
  const [friendBoard, setFriendBoard] = useState(null);
  const [friendPicks, setFriendPicks] = useState([]);
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionGroupId, setSuggestionGroupId] = useState("");
  const [suggestionPlayerId, setSuggestionPlayerId] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionSaving, setSuggestionSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentFormError, setCommentFormError] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentLimit, setCommentLimit] = useState(COMMENTS_PAGE_SIZE);
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [pickOptions, setPickOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const accessToken = session?.access_token;
  const userId = session?.user?.id;

  const friendGroups = useMemo(() => {
    const groups = friendBoard?.board_groups ?? [];
    return [...groups].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [friendBoard]);

  const friendPickByGroup = useMemo(() => {
    const map = new Map();
    friendPicks.forEach((pick) => {
      if (pick.boardGroupId) {
        map.set(pick.boardGroupId, pick);
      }
    });
    return map;
  }, [friendPicks]);

  useEffect(() => {
    if (!accessToken) {
      setFriends([]);
      setRequests([]);
      setLoadError("");
      setIsLoading(false);
      onRequestsCount?.(0);
      return;
    }

    const loadFriends = async () => {
      setIsLoading(true);
      setLoadError("");

      const { data, error } = await fetchFriends({ accessToken });

      if (error) {
        setLoadError(error.message);
        setIsLoading(false);
        return;
      }

      setFriends(data?.friends ?? []);
      setRequests(data?.requests ?? []);
      setIsLoading(false);
    };

    loadFriends();
  }, [accessToken, onRequestsCount]);

  useEffect(() => {
    onRequestsCount?.(requests.length);
  }, [onRequestsCount, requests.length]);

  useEffect(() => {
    if (friends.length === 0) {
      setSelectedFriendId("");
      setFriendProfile(null);
      setFriendBoard(null);
      setFriendPicks([]);
      return;
    }

    if (!selectedFriendId || !friends.some((friend) => friend.id === selectedFriendId)) {
      setSelectedFriendId(friends[0].id);
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    if (!accessToken || !selectedFriendId) {
      setFriendProfile(null);
      setFriendBoard(null);
      setFriendPicks([]);
      setFriendError("");
      setFriendLoading(false);
      return;
    }

    let isMounted = true;

    const loadFriendBoard = async () => {
      setFriendLoading(true);
      setFriendError("");

      const { data, error } = await fetchFriendBoard({
        accessToken,
        friendId: selectedFriendId,
        dateKey: getTodayDateKey(),
      });

      if (!isMounted) return;

      if (error) {
        setFriendError(error.message);
        setFriendLoading(false);
        return;
      }

      setFriendProfile(data?.friend ?? null);
      setFriendBoard(data?.board ?? null);
      setFriendPicks(mapPickRows(data?.picks ?? []));
      setFriendLoading(false);
    };

    loadFriendBoard();

    return () => {
      isMounted = false;
    };
  }, [accessToken, selectedFriendId]);

  useEffect(() => {
    if (!isSuggesting || !accessToken || pickOptions) return;

    let isMounted = true;

    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError("");

      const { data, error } = await fetchPickOptions({ accessToken });

      if (!isMounted) return;

      if (error) {
        setOptionsError(error.message);
        setOptionsLoading(false);
        return;
      }

      setPickOptions(data);
      setOptionsLoading(false);
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [accessToken, isSuggesting, pickOptions]);

  useEffect(() => {
    if (!isSuggesting) return;
    if (!suggestionGroupId && friendGroups.length > 0) {
      setSuggestionGroupId(friendGroups[0].id);
    }
  }, [friendGroups, isSuggesting, suggestionGroupId]);

  useEffect(() => {
    setIsSuggesting(false);
    setSuggestionGroupId("");
    setSuggestionPlayerId("");
    setSuggestionReason("");
    setSuggestionError("");
    setComments([]);
    setCommentsError("");
    setCommentBody("");
    setCommentFormError("");
    setCommentSaving(false);
    setCommentLimit(COMMENTS_PAGE_SIZE);
    setReplyTargetId(null);
    setReplyBody("");
    setReplySaving(false);
    setReplyError("");
  }, [selectedFriendId]);

  useEffect(() => {
    if (friendBoard?.id) {
      setCommentLimit(COMMENTS_PAGE_SIZE);
    }
  }, [friendBoard?.id]);

  useEffect(() => {
    if (!accessToken || !friendBoard?.id) {
      setComments([]);
      setCommentsError("");
      setCommentsLoading(false);
      return;
    }

    let isMounted = true;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError("");

      const { data, error } = await fetchComments({
        accessToken,
        boardId: friendBoard.id,
      });

      if (!isMounted) return;

      if (error) {
        setCommentsError(error.message);
        setCommentsLoading(false);
        return;
      }

      setComments(data?.comments ?? []);
      setCommentsLoading(false);
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [accessToken, friendBoard?.id]);

  const reloadFriends = async () => {
    if (!accessToken) return;
    setLoadError("");
    const { data, error } = await fetchFriends({ accessToken });

    if (error) {
      setLoadError(error.message);
      return;
    }

    setFriends(data?.friends ?? []);
    setRequests(data?.requests ?? []);
  };

  const reloadFriendBoard = async () => {
    if (!accessToken || !selectedFriendId) return;
    setFriendError("");
    setFriendLoading(true);

    const { data, error } = await fetchFriendBoard({
      accessToken,
      friendId: selectedFriendId,
      dateKey: getTodayDateKey(),
    });

    if (error) {
      setFriendError(error.message);
      setFriendLoading(false);
      return;
    }

    setFriendProfile(data?.friend ?? null);
    setFriendBoard(data?.board ?? null);
    setFriendPicks(mapPickRows(data?.picks ?? []));
    setFriendLoading(false);
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    if (!accessToken) return;
    setInviteError("");
    setInviteNotice("");

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      setInviteError("Enter an email to invite.");
      return;
    }

    setIsInviting(true);
    const { error } = await sendFriendRequest({
      accessToken,
      email: trimmedEmail,
    });

    if (error) {
      setInviteError(error.message);
      setIsInviting(false);
      return;
    }

    setInviteEmail("");
    setInviteNotice("Invite sent.");
    setIsInviting(false);
    reloadFriends();
  };

  const handleRequestAction = async (requestId, status) => {
    if (!accessToken) return;
    setRequestActionError("");
    setRequestActionId(requestId);

    const { error } = await respondToFriendRequest({
      accessToken,
      requestId,
      status,
    });

    if (error) {
      setRequestActionError(error.message);
      setRequestActionId(null);
      return;
    }

    await reloadFriends();
    setRequestActionId(null);
  };

  const pickOptionsGroups = pickOptions?.groups ?? [];

  const getOptionsForGroup = (group, index) =>
    pickOptionsGroups.find((optionGroup) => optionGroup.label === group.label) ||
    pickOptionsGroups[group.sort_order ?? index] ||
    pickOptionsGroups[index] ||
    null;

  const activeSuggestionGroup =
    friendGroups.find((group) => group.id === suggestionGroupId) ||
    friendGroups[0] ||
    null;
  const activeSuggestionIndex = activeSuggestionGroup
    ? friendGroups.findIndex((group) => group.id === activeSuggestionGroup.id)
    : -1;
  const suggestionOptionGroup =
    activeSuggestionGroup && activeSuggestionIndex >= 0
      ? getOptionsForGroup(activeSuggestionGroup, activeSuggestionIndex)
      : null;
  const suggestionPlayers = suggestionOptionGroup?.players ?? [];
  const activeGroupPick = activeSuggestionGroup
    ? friendPickByGroup.get(activeSuggestionGroup.id)
    : null;
  const canSuggestFriend = Boolean(
    accessToken && friendBoard && friendBoard.status !== "locked"
  );
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel = [];
    const repliesMap = new Map();
    const threadActivity = new Map();

    comments.forEach((comment) => {
      const createdAt = new Date(comment.createdAt).getTime();
      if (comment.parentId) {
        if (!repliesMap.has(comment.parentId)) {
          repliesMap.set(comment.parentId, []);
        }
        repliesMap.get(comment.parentId).push(comment);
        const current = threadActivity.get(comment.parentId) || 0;
        if (createdAt > current) {
          threadActivity.set(comment.parentId, createdAt);
        }
        return;
      }
      topLevel.push(comment);
      const current = threadActivity.get(comment.id) || 0;
      if (createdAt > current) {
        threadActivity.set(comment.id, createdAt);
      }
    });

    repliesMap.forEach((list) =>
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
    topLevel.sort((a, b) => {
      const aTime = threadActivity.get(a.id) || 0;
      const bTime = threadActivity.get(b.id) || 0;
      return bTime - aTime;
    });

    return { topLevelComments: topLevel, repliesByParent: repliesMap };
  }, [comments]);
  const hasMoreComments = topLevelComments.length > commentLimit;
  const commentsToShow = topLevelComments.slice(0, commentLimit);

  useEffect(() => {
    if (!canSuggestFriend && isSuggesting) {
      setIsSuggesting(false);
    }
  }, [canSuggestFriend, isSuggesting]);

  const handleFriendSuggest = (groupId) => {
    if (!friendBoard || !canSuggestFriend) return;
    setSuggestionGroupId(groupId || friendGroups[0]?.id || "");
    setSuggestionPlayerId("");
    setSuggestionReason("");
    setSuggestionError("");
    setOptionsError("");
    setIsSuggesting(true);
  };

  const handleSuggestionSubmit = async (event) => {
    event.preventDefault();
    if (!friendBoard?.id || !suggestionGroupId || !suggestionPlayerId) {
      setSuggestionError("Select a group and player.");
      return;
    }
    if (!canSuggestFriend) {
      setSuggestionError("Suggestions are closed for this board.");
      return;
    }

    const currentPick = friendPickByGroup.get(suggestionGroupId);
    if (currentPick?.playerId === Number(suggestionPlayerId)) {
      setSuggestionError("That player is already selected.");
      return;
    }

    setSuggestionSaving(true);
    setSuggestionError("");

    const { error } = await createSuggestion({
      accessToken,
      boardId: friendBoard.id,
      boardGroupId: suggestionGroupId,
      playerId: Number(suggestionPlayerId),
      reason: suggestionReason,
    });

    if (error) {
      setSuggestionError(error.message);
      setSuggestionSaving(false);
      return;
    }

    setSuggestionSaving(false);
    setIsSuggesting(false);
    setSuggestionPlayerId("");
    setSuggestionReason("");
    setSuggestionError("");
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!accessToken || !friendBoard?.id || !commentBody.trim()) return;
    setCommentSaving(true);
    setCommentFormError("");

    const { data, error } = await createComment({
      accessToken,
      boardId: friendBoard.id,
      body: commentBody.trim(),
    });

    if (error) {
      setCommentFormError(error.message);
      setCommentSaving(false);
      return;
    }

    const newComment = data?.comment;
    if (newComment) {
      setComments((prev) => [newComment, ...prev]);
    }

    setCommentBody("");
    setCommentSaving(false);
  };

  const handleReplySubmit = async (event, parentId) => {
    event.preventDefault();
    if (!accessToken || !friendBoard?.id || !parentId || !replyBody.trim()) return;
    setReplySaving(true);
    setReplyError("");

    const { data, error } = await createComment({
      accessToken,
      boardId: friendBoard.id,
      body: replyBody.trim(),
      parentId,
    });

    if (error) {
      setReplyError(error.message);
      setReplySaving(false);
      return;
    }

    const newReply = data?.comment;
    if (newReply) {
      setComments((prev) => [newReply, ...prev]);
    }

    setReplyBody("");
    setReplyTargetId(null);
    setReplySaving(false);
  };

  const renderEmptyState = (message) => (
    <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
      {message}
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="glass-card rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Social
        </p>
        <h1 className="font-display text-3xl uppercase">Friends</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Invite friends and swap suggestions in real time.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-card rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl uppercase">Your Crew</h2>
            <button
              type="button"
              onClick={() => {
                setIsInviteOpen((prev) => !prev);
                setInviteError("");
                setInviteNotice("");
              }}
              disabled={!accessToken}
              className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isInviteOpen ? "Close" : "Invite"}
            </button>
          </div>

          {isInviteOpen ? (
            <form
              className="rounded-2xl border border-white/80 bg-white/70 p-4"
              onSubmit={handleInviteSubmit}
            >
              <label className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                Email
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="name@email.com"
                  className="flex-1 rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                />
                <button
                  type="submit"
                  disabled={isInviting}
                  className="rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1d4ed8)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_12px_26px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
              {inviteError ? (
                <div className="mt-2 text-xs text-[color:var(--accent)]">
                  {inviteError}
                </div>
              ) : null}
              {inviteNotice ? (
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {inviteNotice}
                </div>
              ) : null}
            </form>
          ) : null}

          {!accessToken
            ? renderEmptyState("Sign in to load your friends.")
            : isLoading
              ? renderEmptyState("Loading friends...")
              : loadError
                ? renderEmptyState(loadError)
                : friends.length === 0
                  ? renderEmptyState("No friends yet.")
                  : (
                      <div className="space-y-2">
                        {friends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(225,238,255,0.85))] text-sm font-semibold text-[color:var(--ink)]">
                                {(friend.displayName || "Friend")
                                  .trim()
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-[color:var(--ink)]">
                                  {friend.displayName}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
        </section>

        <section className="glass-card rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl uppercase">Requests</h2>
              {requests.length > 0 ? (
                <span className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
              ) : null}
            </div>
            <span className="text-xs text-[color:var(--muted)]">
              {requests.length}
            </span>
          </div>

          {!accessToken
            ? renderEmptyState("Sign in to view requests.")
            : isLoading
              ? renderEmptyState("Loading requests...")
              : loadError
                ? renderEmptyState(loadError)
                : requests.length === 0
                  ? renderEmptyState("No invites yet.")
                  : (
                      <div className="space-y-2">
                        {requests.map((request) => (
                          <div
                            key={request.id}
                            className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.92),_rgba(236,244,255,0.85))] px-4 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.08)]"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(225,238,255,0.85))] text-sm font-semibold text-[color:var(--ink)]">
                                  {(request.displayName || "Friend")
                                    .trim()
                                    .slice(0, 1)
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-[9px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                                    Request
                                  </div>
                                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                                    {request.displayName}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestAction(request.id, "accepted")
                                  }
                                  disabled={requestActionId === request.id}
                                  className="min-w-[88px] rounded-full bg-[color:var(--ink)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white shadow-[0_10px_18px_rgba(15,23,42,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestAction(request.id, "declined")
                                  }
                                  disabled={requestActionId === request.id}
                                  className="min-w-[88px] rounded-full border border-white/80 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {requestActionError ? (
                          <div className="text-xs text-[color:var(--accent)]">
                            {requestActionError}
                          </div>
                        ) : null}
                      </div>
                    )}
        </section>
      </div>

      <section className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase">Friend Picks</h2>
            <p className="text-xs text-[color:var(--muted)]">
              Review today's picks and send suggestions.
            </p>
          </div>
          {friendProfile ? (
            <div className="text-xs text-[color:var(--muted)]">
              Viewing {friendProfile.displayName}
            </div>
          ) : null}
        </div>

        {!accessToken
          ? renderEmptyState("Sign in to view friend picks.")
          : friends.length === 0
            ? renderEmptyState("Add a friend to view their picks.")
            : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={selectedFriendId}
                      onChange={(event) => setSelectedFriendId(event.target.value)}
                      className="flex-1 rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                    >
                      {friends.map((friend) => (
                        <option key={friend.id} value={friend.id}>
                          {friend.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={reloadFriendBoard}
                      disabled={friendLoading}
                      className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {friendLoading ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {friendLoading
                    ? renderEmptyState("Loading friend picks...")
                    : friendError
                      ? renderEmptyState(friendError)
                      : !friendBoard
                        ? renderEmptyState("No board yet for today.")
                        : (
                            <div className="space-y-4">
                              <div className="space-y-4">
                                {friendGroups.map((group) => {
                                  const pick = friendPickByGroup.get(group.id);
                                  const cardData = pick || {
                                    id: group.id,
                                    groupLabel: group.label,
                                    playerName: "No pick yet",
                                    teamCode: "TBD",
                                    teamName: "Awaiting selection",
                                    isLocked: false,
                                  };
                                  return (
                                    <GroupPickCard
                                      key={group.id}
                                      {...cardData}
                                      onSuggest={
                                        canSuggestFriend
                                          ? () => handleFriendSuggest(group.id)
                                          : undefined
                                      }
                                    />
                                  );
                                })}
                              </div>

                              {isSuggesting ? (
                                <form
                                  className="rounded-2xl border border-white/80 bg-white/70 p-4 space-y-3"
                                  onSubmit={handleSuggestionSubmit}
                                >
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                                        Group
                                      </label>
                                      <select
                                        value={suggestionGroupId}
                                        onChange={(event) => {
                                          setSuggestionGroupId(event.target.value);
                                          setSuggestionPlayerId("");
                                        }}
                                        className="mt-2 w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                                      >
                                        {friendGroups.map((group) => (
                                          <option key={group.id} value={group.id}>
                                            {group.label}
                                          </option>
                                        ))}
                                      </select>
                                      {activeGroupPick ? (
                                        <div className="mt-2 text-xs text-[color:var(--muted)]">
                                          Current pick: {activeGroupPick.playerName}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                                        Player
                                      </label>
                                      <select
                                        value={suggestionPlayerId}
                                        onChange={(event) =>
                                          setSuggestionPlayerId(event.target.value)
                                        }
                                        className="mt-2 w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                                        disabled={optionsLoading || suggestionPlayers.length === 0}
                                      >
                                        <option value="">
                                          {optionsLoading
                                            ? "Loading players..."
                                            : suggestionPlayers.length
                                              ? "Select a player"
                                              : "No players loaded"}
                                        </option>
                                        {suggestionPlayers.map((player) => {
                                          const parts = [];
                                          if (player.teamCode) parts.push(player.teamCode);
                                          if (player.opponentTeam) {
                                            parts.push(`vs ${player.opponentTeam}`);
                                          }
                                          if (player.position) parts.push(player.position);
                                          const lineLabel = formatLineMeta(player.line);
                                          if (lineLabel) parts.push(lineLabel);
                                          const ppLabel = formatPpMeta(player.ppLine);
                                          if (ppLabel) parts.push(ppLabel);
                                          const meta = parts.length
                                            ? ` - ${parts.join(" | ")}`
                                            : "";
                                          const isCurrentPick =
                                            activeGroupPick?.playerId === player.id;
                                          const fullName =
                                            player.fullName || "Player";
                                          const label = `${fullName}${meta}${
                                            player.isUnavailable ? " (Out)" : ""
                                          }`;
                                          return (
                                            <option
                                              key={player.id}
                                              value={player.id}
                                              disabled={player.isUnavailable || isCurrentPick}
                                            >
                                              {isCurrentPick
                                                ? `${label} (Selected)`
                                                : label}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  </div>

                                  <textarea
                                    value={suggestionReason}
                                    onChange={(event) =>
                                      setSuggestionReason(event.target.value)
                                    }
                                    placeholder="Reason (optional)"
                                    rows={2}
                                    className="w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                                  />

                                  {optionsError ? (
                                    <div className="text-xs text-[color:var(--accent)]">
                                      {optionsError}
                                    </div>
                                  ) : null}

                                  {suggestionError ? (
                                    <div className="text-xs text-[color:var(--accent)]">
                                      {suggestionError}
                                    </div>
                                  ) : null}

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      disabled={suggestionSaving || optionsLoading}
                                      className="flex-1 rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1d4ed8)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_12px_26px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {suggestionSaving ? "Sending..." : "Send Suggestion"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsSuggesting(false)}
                                      className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : null}
                            </div>
                          )}
                </div>
              )}
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Comments</h2>
          <span className="text-xs text-[color:var(--muted)]">
            {comments.length}
          </span>
        </div>

        {!accessToken
          ? renderEmptyState("Sign in to view comments.")
          : friends.length === 0
            ? renderEmptyState("Add a friend to view comments.")
            : friendLoading
              ? renderEmptyState("Loading comments...")
              : friendError
                ? renderEmptyState(friendError)
                : !friendBoard
                  ? renderEmptyState("No board yet for today.")
                  : commentsLoading
                    ? renderEmptyState("Loading comments...")
                    : commentsError
                      ? renderEmptyState(commentsError)
                      : comments.length === 0
                        ? renderEmptyState("No comments yet.")
                        : (
                            <div className="space-y-2">
                              {commentsToShow.map((comment) => {
                                const replies = repliesByParent.get(comment.id) || [];
                                const isMine = comment.userId === userId;
                                const displayName =
                                  comment.displayName || (isMine ? "You" : "Friend");
                                const commentCardStyles = isMine
                                  ? "border border-[rgba(42,157,244,0.35)] border-l-4 border-l-[rgba(42,157,244,0.85)] bg-[linear-gradient(135deg,_rgba(42,157,244,0.12),_rgba(255,255,255,0.85))]"
                                  : "border border-[rgba(16,185,129,0.28)] border-l-4 border-l-[rgba(16,185,129,0.75)] bg-[linear-gradient(135deg,_rgba(16,185,129,0.08),_rgba(255,255,255,0.9))]";
                                return (
                                  <div key={comment.id} className="space-y-2">
                                    <div className={`rounded-2xl px-4 py-3 ${commentCardStyles}`}>
                                      <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
                                        <span className="flex items-center gap-2">
                                          <span className="font-semibold text-[color:var(--ink)]">
                                            {displayName}
                                          </span>
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)] ${
                                              isMine
                                                ? "border-[rgba(42,157,244,0.35)] bg-[rgba(42,157,244,0.12)]"
                                                : "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]"
                                            }`}
                                          >
                                            {isMine ? "You" : "Friend"}
                                          </span>
                                        </span>
                                        <span>
                                          {new Date(comment.createdAt).toLocaleString(
                                            "en-US",
                                            {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                            }
                                          )}
                                        </span>
                                      </div>
                                      <div className="mt-2 text-sm text-[color:var(--ink)]">
                                        {comment.body}
                                      </div>
                                      {accessToken ? (
                                        <div className="mt-3 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReplyTargetId(
                                                replyTargetId === comment.id
                                                  ? null
                                                  : comment.id
                                              );
                                              setReplyBody("");
                                              setReplyError("");
                                            }}
                                            className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] shadow-sm"
                                          >
                                            Reply
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>

                                    {replies.length ? (
                                      <div className="space-y-2 pl-6">
                                        {replies.map((reply) => {
                                          const replyIsMine = reply.userId === userId;
                                          const replyName =
                                            reply.displayName ||
                                            (replyIsMine ? "You" : "Friend");
                                          const replyStyles = replyIsMine
                                            ? "border border-[rgba(42,157,244,0.3)] border-l-4 border-l-[rgba(42,157,244,0.7)] bg-[rgba(42,157,244,0.08)]"
                                            : "border border-[rgba(16,185,129,0.22)] border-l-4 border-l-[rgba(16,185,129,0.6)] bg-[rgba(16,185,129,0.06)]";
                                          return (
                                            <div
                                              key={reply.id}
                                              className={`rounded-2xl px-4 py-3 ${replyStyles}`}
                                            >
                                              <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
                                                <span className="flex items-center gap-2">
                                                  <span className="font-semibold text-[color:var(--ink)]">
                                                    {replyName}
                                                  </span>
                                                  <span
                                                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)] ${
                                                      replyIsMine
                                                        ? "border-[rgba(42,157,244,0.35)] bg-[rgba(42,157,244,0.12)]"
                                                        : "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]"
                                                    }`}
                                                  >
                                                    {replyIsMine ? "You" : "Friend"}
                                                  </span>
                                                </span>
                                                <span>
                                                  {new Date(reply.createdAt).toLocaleString(
                                                    "en-US",
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "numeric",
                                                      minute: "2-digit",
                                                    }
                                                  )}
                                                </span>
                                              </div>
                                              <div className="mt-2 text-sm text-[color:var(--ink)]">
                                                {reply.body}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : null}

                                    {replyTargetId === comment.id ? (
                                      <form
                                        onSubmit={(event) =>
                                          handleReplySubmit(event, comment.id)
                                        }
                                        className="space-y-2 pl-6"
                                      >
                                        <textarea
                                          value={replyBody}
                                          onChange={(event) =>
                                            setReplyBody(event.target.value)
                                          }
                                          className="w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
                                          placeholder="Write a reply..."
                                          rows={2}
                                          disabled={replySaving}
                                        />
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="submit"
                                            disabled={replySaving || !replyBody.trim()}
                                            className="rounded-2xl bg-[linear-gradient(135deg,_#0b1424,_#1f3a60)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_12px_26px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {replySaving ? "Sending..." : "Reply"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReplyTargetId(null);
                                              setReplyBody("");
                                              setReplyError("");
                                            }}
                                            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)]"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        {replyError ? (
                                          <div className="text-xs text-[color:var(--accent)]">
                                            {replyError}
                                          </div>
                                        ) : null}
                                      </form>
                                    ) : null}
                                  </div>
                                );
                              })}
                              {hasMoreComments ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentLimit((prev) => prev + COMMENTS_PAGE_SIZE)
                                  }
                                  className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm"
                                >
                                  Show more comments
                                </button>
                              ) : null}
                            </div>
                          )}

        {accessToken && friendBoard ? (
          <form onSubmit={handleCommentSubmit} className="space-y-2">
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
              placeholder="Write a comment..."
              rows={2}
              disabled={commentSaving}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={commentSaving || !commentBody.trim()}
                className="rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1d4ed8)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_12px_26px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commentSaving ? "Sending..." : "Send"}
              </button>
            </div>
            {commentFormError ? (
              <div className="text-xs text-[color:var(--accent)]">
                {commentFormError}
              </div>
            ) : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
