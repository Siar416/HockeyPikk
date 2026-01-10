import { useEffect, useMemo, useState } from "react";
import GroupPickCard from "../components/GroupPickCard";
import { getTodayDateKey } from "../lib/boardService";
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
      isLocked: pick.is_locked,
      sortOrder: pick.board_groups?.sort_order ?? 0,
      boardGroupId: pick.board_group_id,
      playerId: pick.nhl_player_id,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

export default function Friends({ session, onRequestsCount }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteHandle, setInviteHandle] = useState("");
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
  const [pickOptions, setPickOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const accessToken = session?.access_token;

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
  }, [selectedFriendId]);

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

    const trimmedHandle = inviteHandle.trim();
    if (!trimmedHandle) {
      setInviteError("Enter a handle or email to invite.");
      return;
    }

    setIsInviting(true);
    const { error } = await sendFriendRequest({
      accessToken,
      handle: trimmedHandle,
    });

    if (error) {
      setInviteError(error.message);
      setIsInviting(false);
      return;
    }

    setInviteHandle("");
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

  const handleFriendSuggest = (groupId) => {
    if (!friendBoard) return;
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
                Handle or email
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={inviteHandle}
                  onChange={(event) => setInviteHandle(event.target.value)}
                  placeholder="@username or name@email.com"
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
                            className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
                          >
                            <div className="text-sm font-semibold">
                              {friend.displayName}
                            </div>
                            <div className="text-xs text-[color:var(--muted)]">
                              {friend.handle ? `@${friend.handle}` : "@"}
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
                            className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  {request.displayName}
                                </div>
                                <div className="text-xs text-[color:var(--muted)]">
                                  {request.handle ? `@${request.handle}` : "@"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestAction(request.id, "accepted")
                                  }
                                  disabled={requestActionId === request.id}
                                  className="rounded-full bg-[color:var(--ink)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestAction(request.id, "declined")
                                  }
                                  disabled={requestActionId === request.id}
                                  className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
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
              {friendProfile.handle ? ` (@${friendProfile.handle})` : ""}
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
                          {friend.handle ? ` (@${friend.handle})` : ""}
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
                              <div className="grid gap-3 md:grid-cols-2">
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
                                      onSuggest={() => handleFriendSuggest(group.id)}
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
                                          if (player.line) parts.push(`L${player.line}`);
                                          if (player.ppLine) parts.push(`PP${player.ppLine}`);
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
    </div>
  );
}
