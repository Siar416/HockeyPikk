import { useEffect, useMemo, useState } from "react";
import GroupPickCard from "../components/GroupPickCard";
import { fetchTodayBoard, getTodayDateKey, lockBoard } from "../lib/boardService";
import { createComment, fetchComments } from "../lib/commentsService";
import { fetchPickMeta, fetchPickOptions, savePicks } from "../lib/picksService";
import {
  createSuggestion,
  fetchSuggestions,
  updateSuggestion,
} from "../lib/suggestionsService";

const samplePicks = [
  {
    groupLabel: "Group 1",
    playerName: "Connor McDavid",
    teamCode: "EDM",
    teamName: "Oilers",
    opponentTeamCode: "CGY",
    opponentTeamName: "Flames",
    seasonGamesPlayed: 41,
    seasonPoints: 62,
    seasonGoals: 24,
    seasonAssists: 38,
    seasonShots: 190,
    seasonShootingPct: 0.126,
    seasonPowerPlayPoints: 18,
    seasonAvgToi: "21:14",
    seasonFaceoffPct: 0.54,
    last5Points: 6,
    last5Goals: 2,
    last5Shots: 17,
    isLocked: false,
  },
  {
    groupLabel: "Group 2",
    playerName: "Auston Matthews",
    teamCode: "TOR",
    teamName: "Maple Leafs",
    opponentTeamCode: "MTL",
    opponentTeamName: "Canadiens",
    seasonGamesPlayed: 39,
    seasonPoints: 58,
    seasonGoals: 27,
    seasonAssists: 31,
    seasonShots: 176,
    seasonShootingPct: 0.153,
    seasonPowerPlayPoints: 16,
    seasonAvgToi: "20:48",
    seasonFaceoffPct: 0.51,
    last5Points: 5,
    last5Goals: 3,
    last5Shots: 15,
    isLocked: false,
  },
  {
    groupLabel: "Group 3",
    playerName: "Cale Makar",
    teamCode: "COL",
    teamName: "Avalanche",
    opponentTeamCode: "DAL",
    opponentTeamName: "Stars",
    seasonGamesPlayed: 40,
    seasonPoints: 49,
    seasonGoals: 12,
    seasonAssists: 37,
    seasonShots: 142,
    seasonShootingPct: 0.085,
    seasonPowerPlayPoints: 14,
    seasonAvgToi: "23:08",
    seasonFaceoffPct: null,
    last5Points: 7,
    last5Goals: 1,
    last5Shots: 11,
    isLocked: false,
  },
];

const getWeekNumber = (date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / 86400000);
  return Math.ceil((days + start.getDay() + 1) / 7);
};

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

const buildInitialSelections = (groups, picks) => {
  const initial = {};
  (groups || []).forEach((group) => {
    initial[group.id] = "";
  });
  (picks || []).forEach((pick) => {
    if (pick.boardGroupId && pick.playerId) {
      initial[pick.boardGroupId] = String(pick.playerId);
    }
  });
  return initial;
};

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

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

const formatSuggestionStatus = (status) => {
  if (!status) return "";
  if (status === "rejected") return "declined";
  return status;
};

export default function Today({
  session,
  onSuggestionCount,
  onCommentCount,
  onBoardUpdate,
}) {
  // TODO: derive board status (Draft/Locked) + lock time from server state.
  // TODO: gate edit/lock actions based on auth + board ownership rules.
  const [board, setBoard] = useState(null);
  const [picks, setPicks] = useState([]);
  const [counts, setCounts] = useState({ comments: 0, suggestions: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [pickOptions, setPickOptions] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [selections, setSelections] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState("");
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionGroupId, setSuggestionGroupId] = useState("");
  const [suggestionPlayerId, setSuggestionPlayerId] = useState("");
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [suggestionReason, setSuggestionReason] = useState("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [suggestionFormError, setSuggestionFormError] = useState("");
  const [suggestionSaving, setSuggestionSaving] = useState(false);
  const [suggestionActionId, setSuggestionActionId] = useState(null);
  const [suggestionActionError, setSuggestionActionError] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState("pending");
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
  const [lockByLabel, setLockByLabel] = useState(null);
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const hasBackend = Boolean(userId && accessToken);

  useEffect(() => {
    if (!hasBackend) {
      setBoard(null);
      setPicks([]);
      setCounts({ comments: 0, suggestions: 0 });
      setLoadError("");
      setIsLoading(false);
      setIsEditing(false);
      setPickOptions(null);
      setOptionsLoading(false);
      setOptionsError("");
      setSelections({});
      setIsSaving(false);
      setSaveError("");
      setIsLocking(false);
      setLockError("");
      setShowLockConfirm(false);
      setSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsLoaded(false);
      setSuggestionsError("");
      setIsSuggesting(false);
      setSuggestionGroupId("");
      setSuggestionPlayerId("");
      setSuggestionSearch("");
      setSuggestionReason("");
      setSuggestionNotice("");
      setSuggestionFormError("");
      setSuggestionSaving(false);
      setSuggestionActionId(null);
      setSuggestionActionError("");
      setSuggestionFilter("pending");
      setComments([]);
      setCommentsLoading(false);
      setCommentsError("");
      setCommentBody("");
      setCommentFormError("");
      setCommentSaving(false);
      setCommentLimit(COMMENTS_PAGE_SIZE);
      setReplyTargetId(null);
      setReplyBody("");
      setReplySaving(false);
      setReplyError("");
      return;
    }

    let isMounted = true;

    const loadBoard = async () => {
      setIsLoading(true);
      setLoadError("");

      const dateKey = getTodayDateKey();
      const { data, error } = await fetchTodayBoard({
        accessToken,
        dateKey,
      });

      if (isMounted) {
        if (error) {
          setLoadError(error.message);
          setIsLoading(false);
          return;
        }

        const resolvedBoard = data?.board ?? null;
        const mappedPicks = mapPickRows(data?.picks ?? []);

        setBoard(resolvedBoard);
        setPicks(mappedPicks);
        setCounts(data?.counts ?? { comments: 0, suggestions: 0 });
        setIsLoading(false);
      }
    };

    loadBoard();

    return () => {
      isMounted = false;
    };
  }, [accessToken, hasBackend, userId]);

  useEffect(() => {
    let isMounted = true;

    const loadLockMeta = async () => {
      const dateKey = board?.board_date || getTodayDateKey();
      const { data } = await fetchPickMeta({ dateKey });
      if (!isMounted) return;
      const resolvedLabel =
        formatTimeLabel(data?.lockTime) ||
        data?.lockTimeLabel ||
        formatTimeLabel(data?.dateTimeAvailable);
      setLockByLabel(resolvedLabel);
    };

    loadLockMeta();

    return () => {
      isMounted = false;
    };
  }, [board?.board_date]);

  useEffect(() => {
    const shouldLoadOptions = isEditing || isSuggesting;
    if (!shouldLoadOptions || !hasBackend || pickOptions) return;

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
  }, [accessToken, hasBackend, isEditing, isSuggesting, pickOptions]);

  const orderedGroups = useMemo(() => {
    const groups = board?.board_groups ?? [];
    return [...groups].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }, [board]);

  useEffect(() => {
    if (!hasBackend || !board?.id) {
      setSuggestions([]);
      setSuggestionsError("");
      setSuggestionsLoading(false);
      setSuggestionsLoaded(false);
      return;
    }

    let isMounted = true;

    const loadSuggestions = async () => {
      setSuggestionsLoading(true);
      setSuggestionsError("");
      setSuggestionsLoaded(false);

      const { data, error } = await fetchSuggestions({
        accessToken,
        boardId: board.id,
      });

      if (!isMounted) return;

      if (error) {
        setSuggestionsError(error.message);
        setSuggestionsLoading(false);
        setSuggestionsLoaded(true);
        return;
      }

      const nextSuggestions = data?.suggestions ?? [];
      setSuggestions(nextSuggestions);
      setCounts((prev) => ({
        ...prev,
        suggestions: nextSuggestions.filter((suggestion) => suggestion.status === "pending")
          .length,
      }));
      setSuggestionsLoading(false);
      setSuggestionsLoaded(true);
    };

    loadSuggestions();

    return () => {
      isMounted = false;
    };
  }, [accessToken, board?.id, hasBackend]);

  useEffect(() => {
    if (!hasBackend || !board?.id) {
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
        boardId: board.id,
      });

      if (!isMounted) return;

      if (error) {
        setCommentsError(error.message);
        setCommentsLoading(false);
        return;
      }

      const nextComments = data?.comments ?? [];
      setComments(nextComments);
      setCounts((prev) => ({
        ...prev,
        comments: nextComments.length,
      }));
      setCommentsLoading(false);
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [accessToken, board?.id, hasBackend]);

  useEffect(() => {
    if (board?.id) {
      setCommentLimit(COMMENTS_PAGE_SIZE);
    }
  }, [board?.id]);

  useEffect(() => {
    onBoardUpdate?.(board);
  }, [board, onBoardUpdate]);

  useEffect(() => {
    if (!isSuggesting) return;
    if (!suggestionGroupId && orderedGroups.length > 0) {
      setSuggestionGroupId(orderedGroups[0].id);
    }
  }, [isSuggesting, orderedGroups, suggestionGroupId]);

  const activeDate = useMemo(() => {
    if (board?.board_date) {
      return new Date(`${board.board_date}T00:00:00`);
    }
    return new Date();
  }, [board]);

  const dateLabel = activeDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const weekdayLabel = activeDate.toLocaleDateString("en-US", {
    weekday: "long",
  });
  const weekNumber = getWeekNumber(activeDate);
  const isLocked = board?.status === "locked";
  const statusLabel = isLocked ? "Locked" : "Draft";
  const statusPillStyles = isLocked
    ? "border border-[rgba(240,78,78,0.35)] bg-[linear-gradient(135deg,_rgba(240,78,78,0.18),_rgba(255,180,120,0.24))] text-[color:var(--accent)]"
    : "border border-[rgba(42,157,244,0.35)] bg-[linear-gradient(135deg,_rgba(42,157,244,0.18),_rgba(129,212,250,0.22))] text-[color:var(--ink)]";
  const lockedAtLabel = formatTimeLabel(board?.lock_at);
  const lockTimeLabel = lockByLabel || formatTimeLabel(board?.lock_at) || "7:00 PM";
  const groupCount = hasBackend ? orderedGroups.length : samplePicks.length;
  const selectedGroupCount = useMemo(
    () => new Set(picks.map((pick) => pick.boardGroupId).filter(Boolean)).size,
    [picks]
  );
  const selectedCount = useMemo(() => {
    if (!hasBackend) return samplePicks.length;
    if (isEditing) {
      return Object.values(selections).filter(Boolean).length;
    }
    return picks.length;
  }, [hasBackend, isEditing, picks.length, selections]);
  const shouldShowSample = !hasBackend;
  const picksToRender = shouldShowSample ? samplePicks : picks;
  const showEmptyState =
    hasBackend && !isLoading && picksToRender.length === 0 && !isEditing;
  const isOwner = board?.created_by === userId;
  const canEdit = hasBackend && board && !isLoading && !loadError && !isLocked;
  const canCreateSuggestions =
    hasBackend && board && !isLoading && !loadError && !isLocked && !isOwner;
  const canManageSuggestions = hasBackend && board && !isLoading && !loadError;
  const canAcceptSuggestions = canManageSuggestions && !isLocked;
  const canLock = hasBackend && board && !isLoading && !loadError && !isLocked;
  const canComment = hasBackend && board && !isLoading && !loadError;
  const optionsGroups = pickOptions?.groups ?? [];

  const getOptionsForGroup = (group, index) =>
    optionsGroups.find((optionGroup) => optionGroup.label === group.label) ||
    optionsGroups[group.sort_order ?? index] ||
    optionsGroups[index] ||
    null;

  const activeSuggestionGroup =
    orderedGroups.find((group) => group.id === suggestionGroupId) ||
    orderedGroups[0] ||
    null;
  const activeSuggestionIndex = activeSuggestionGroup
    ? orderedGroups.findIndex((group) => group.id === activeSuggestionGroup.id)
    : -1;
  const suggestionOptionGroup =
    activeSuggestionGroup && activeSuggestionIndex >= 0
      ? getOptionsForGroup(activeSuggestionGroup, activeSuggestionIndex)
      : null;
  const suggestionPlayers = useMemo(
    () => suggestionOptionGroup?.players ?? [],
    [suggestionOptionGroup]
  );
  const currentSuggestionPick = activeSuggestionGroup
    ? picks.find((pick) => pick.boardGroupId === activeSuggestionGroup.id)
    : null;
  const suggestionSearchValue = suggestionSearch.trim().toLowerCase();
  const filteredSuggestionPlayers = useMemo(() => {
    if (!suggestionSearchValue) return suggestionPlayers;
    return suggestionPlayers.filter((player) => {
      const searchable = [
        player.fullName,
        player.teamCode,
        player.opponentTeam,
        player.position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(suggestionSearchValue);
    });
  }, [suggestionPlayers, suggestionSearchValue]);
  const pendingSuggestionCount = useMemo(
    () => suggestions.filter((suggestion) => suggestion.status === "pending").length,
    [suggestions]
  );
  const reviewedSuggestionCount = Math.max(
    0,
    suggestions.length - pendingSuggestionCount
  );
  const suggestionsToRender = useMemo(() => {
    if (suggestionFilter === "pending") {
      return suggestions.filter((suggestion) => suggestion.status === "pending");
    }
    if (suggestionFilter === "reviewed") {
      return suggestions.filter((suggestion) => suggestion.status !== "pending");
    }
    return suggestions;
  }, [suggestionFilter, suggestions]);
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
    if (!suggestionsLoaded) return;
    onSuggestionCount?.(pendingSuggestionCount);
  }, [onSuggestionCount, pendingSuggestionCount, suggestionsLoaded]);

  useEffect(() => {
    if (!hasBackend) {
      onCommentCount?.(0);
      return;
    }
    if (!board?.id) return;
    onCommentCount?.(counts.comments);
  }, [board?.id, counts.comments, hasBackend, onCommentCount]);

  useEffect(() => {
    if (!canCreateSuggestions && isSuggesting) {
      setIsSuggesting(false);
    }
  }, [canCreateSuggestions, isSuggesting]);

  useEffect(() => {
    if (suggestions.length === 0) {
      setSuggestionFilter("pending");
      return;
    }
    if (suggestionFilter === "pending" && pendingSuggestionCount === 0) {
      setSuggestionFilter("all");
    }
  }, [pendingSuggestionCount, suggestionFilter, suggestions.length]);

  useEffect(() => {
    if (!canLock || isLocked) {
      setShowLockConfirm(false);
    }
  }, [canLock, isLocked]);

  const startEditing = () => {
    if (!canEdit) return;
    setSelections(buildInitialSelections(orderedGroups, picks));
    setSaveError("");
    setOptionsError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveError("");
    setOptionsError("");
  };

  const handleSelectionChange = (groupId, value) => {
    setSelections((prev) => ({
      ...prev,
      [groupId]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!board?.id || isSaving) return;
    setIsSaving(true);
    setSaveError("");

    const selectionsPayload = Object.entries(selections)
      .filter(([, playerId]) => playerId)
      .map(([boardGroupId, playerId]) => ({
        boardGroupId,
        playerId: Number(playerId),
      }));

    if (!selectionsPayload.length) {
      setSaveError("Select at least one player before saving.");
      setIsSaving(false);
      return;
    }

    const { data, error } = await savePicks({
      accessToken,
      boardId: board.id,
      selections: selectionsPayload,
    });

    if (error) {
      setSaveError(error.message);
      setIsSaving(false);
      return;
    }

    setPicks(mapPickRows(data?.picks ?? []));
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleLockPicks = () => {
    if (!board?.id || !canLock || isLocking) return;
    if (isEditing) {
      setLockError("Save or cancel your edits before locking picks.");
      return;
    }
    if (orderedGroups.length > 0 && selectedGroupCount < orderedGroups.length) {
      setLockError(
        `Pick all groups before locking (${selectedGroupCount}/${orderedGroups.length} selected).`
      );
      return;
    }
    setShowLockConfirm(true);
    setLockError("");
  };

  const confirmLockPicks = async () => {
    if (!board?.id || !canLock || isLocking) return;
    setShowLockConfirm(false);
    setIsLocking(true);
    setLockError("");

    const { data, error } = await lockBoard({
      accessToken,
      boardId: board.id,
    });

    if (error) {
      setLockError(error.message);
      setIsLocking(false);
      return;
    }

    if (data?.board) {
      setBoard((prev) => ({ ...prev, ...data.board }));
    }

    if (data?.picks) {
      setPicks(mapPickRows(data.picks));
    }

    setIsEditing(false);
    setIsSuggesting(false);
    setSuggestionNotice("");
    setIsLocking(false);
  };

  const startSuggesting = (groupId) => {
    if (!canCreateSuggestions) return;
    setSuggestionGroupId(groupId || orderedGroups[0]?.id || "");
    setSuggestionPlayerId("");
    setSuggestionSearch("");
    setSuggestionReason("");
    setSuggestionNotice("");
    setSuggestionFormError("");
    setSuggestionActionError("");
    setOptionsError("");
    setIsSuggesting(true);
  };

  const cancelSuggesting = () => {
    setIsSuggesting(false);
    setSuggestionSearch("");
    setSuggestionFormError("");
  };

  const handleSuggestionSubmit = async (event) => {
    event.preventDefault();
    if (!board?.id || !suggestionGroupId || !suggestionPlayerId) {
      setSuggestionFormError("Select a group and player.");
      return;
    }
    const nextPlayerId = Number(suggestionPlayerId);
    const groupCurrentPick = picks.find(
      (pick) => pick.boardGroupId === suggestionGroupId
    );
    if (groupCurrentPick?.playerId === nextPlayerId) {
      setSuggestionFormError("That player is already the current pick.");
      return;
    }
    const hasPendingDuplicate = suggestions.some(
      (suggestion) =>
        suggestion.status === "pending" &&
        suggestion.boardGroupId === suggestionGroupId &&
        Number(suggestion.nhlPlayerId) === nextPlayerId
    );
    if (hasPendingDuplicate) {
      setSuggestionFormError("A pending suggestion for that player already exists.");
      return;
    }

    setSuggestionSaving(true);
    setSuggestionFormError("");
    setSuggestionNotice("");

    const { data, error } = await createSuggestion({
      accessToken,
      boardId: board.id,
      boardGroupId: suggestionGroupId,
      playerId: nextPlayerId,
      reason: suggestionReason,
    });

    if (error) {
      setSuggestionFormError(error.message);
      setSuggestionSaving(false);
      return;
    }

    const newSuggestion = data?.suggestion;
    if (newSuggestion) {
      setSuggestions((prev) => [newSuggestion, ...prev]);
      setCounts((prev) => ({
        ...prev,
        suggestions: (prev.suggestions || 0) + 1,
      }));
    }

    setSuggestionSaving(false);
    setIsSuggesting(false);
    setSuggestionSearch("");
    setSuggestionReason("");
    setSuggestionPlayerId("");
    setSuggestionNotice("Suggestion sent. The board owner can review it now.");
  };

  const handleSuggestionAction = async (suggestionId, status) => {
    if (!suggestionId || suggestionActionId) return;
    const nextStatus = status === "declined" ? "rejected" : status;
    const wasPending = suggestions.some(
      (suggestion) => suggestion.id === suggestionId && suggestion.status === "pending"
    );
    setSuggestionActionId(suggestionId);
    setSuggestionActionError("");

    const { data, error } = await updateSuggestion({
      accessToken,
      suggestionId,
      status: nextStatus,
    });

    if (error) {
      setSuggestionActionError(error.message);
      setSuggestionActionId(null);
      return;
    }

    setSuggestions((prev) =>
      prev.map((suggestion) =>
        suggestion.id === suggestionId
          ? { ...suggestion, status: nextStatus }
          : suggestion
      )
    );
    if (wasPending && (nextStatus === "accepted" || nextStatus === "rejected")) {
      setCounts((prev) => ({
        ...prev,
        suggestions: Math.max(0, (prev.suggestions || 0) - 1),
      }));
    }

    if (data?.pick) {
      const mappedPick = mapPickRows([data.pick])[0];
      if (mappedPick) {
        setPicks((prev) => {
          const next = prev.filter(
            (pick) => pick.boardGroupId !== mappedPick.boardGroupId
          );
          next.push(mappedPick);
          return next.sort((a, b) => a.sortOrder - b.sortOrder);
        });
      }
    }

    setSuggestionActionId(null);
    setSuggestionNotice(
      nextStatus === "accepted"
        ? "Suggestion accepted and pick updated."
        : "Suggestion declined."
    );
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!board?.id || !commentBody.trim()) return;
    setCommentSaving(true);
    setCommentFormError("");

    const { data, error } = await createComment({
      accessToken,
      boardId: board.id,
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
      setCounts((prev) => ({
        ...prev,
        comments: (prev.comments || 0) + 1,
      }));
    }

    setCommentBody("");
    setCommentFormError("");
    setCommentSaving(false);
  };

  const handleReplySubmit = async (event, parentId) => {
    event.preventDefault();
    if (!board?.id || !parentId || !replyBody.trim()) return;
    setReplySaving(true);
    setReplyError("");

    const { data, error } = await createComment({
      accessToken,
      boardId: board.id,
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
      setCounts((prev) => ({
        ...prev,
        comments: (prev.comments || 0) + 1,
      }));
    }

    setReplyBody("");
    setReplyTargetId(null);
    setReplySaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <section className="glass-card rounded-3xl p-5 md:p-6 motion-safe:animate-fade-up">
        <div className="flex items-start justify-between">
          <div>
            <p className="kicker">Today</p>
            <h1 className="font-display text-5xl leading-none">
              {dateLabel}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              {weekdayLabel} - Week {weekNumber}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
              Board status
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold shadow-[0_8px_18px_rgba(15,23,42,0.12)] ${statusPillStyles}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--ink-2)]">
          <span className="chip">
            {groupCount} groups
          </span>
          <span className="chip">
            {counts.comments} comments
          </span>
          {isLocked ? (
            <span className="chip">
              Picks were locked in {lockedAtLabel ? `at ${lockedAtLabel}` : ""}
            </span>
          ) : (
            <span className="chip">
              Lock by {lockTimeLabel}
            </span>
          )}
        </div>

        {hasBackend && loadError ? (
          <div className="mt-4 rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {loadError}
          </div>
        ) : null}
      </section>

      {/* Your Picks */}
      <section className="glass-card rounded-3xl p-5 md:p-6 space-y-4 motion-safe:animate-fade-up anim-delay-80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-3xl leading-none">Your picks</h2>
            <p className="text-sm text-[color:var(--muted)]">
              {selectedCount}/{groupCount} selected
            </p>
          </div>

          <button
            type="button"
            onClick={isEditing ? cancelEditing : startEditing}
            disabled={!canEdit || isSaving}
            className="btn-secondary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </div>

        {hasBackend && isLoading ? (
          <div className="empty-state">
            Loading picks...
          </div>
        ) : null}

        {isEditing ? (
          <div className="space-y-4">
            {optionsLoading ? (
              <div className="empty-state">
                Loading players...
              </div>
            ) : null}

            {optionsError ? (
              <div className="rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
                {optionsError}
              </div>
            ) : null}

            {!optionsLoading && !optionsError ? (
              <form className="space-y-4" onSubmit={handleSave}>
                <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-xs text-[color:var(--muted)]">
                  Pick one player per group. Use the dropdown to browse the full list.
                </div>

                {orderedGroups.length === 0 ? (
                  <div className="empty-state">
                    No groups available yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orderedGroups.map((group, index) => {
                      const optionGroup = getOptionsForGroup(group, index);
                      const players = optionGroup?.players ?? [];
                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                            <span>{group.label}</span>
                            <span>{players.length} players</span>
                          </div>
                          <select
                            value={selections[group.id] ?? ""}
                            onChange={(event) =>
                              handleSelectionChange(group.id, event.target.value)
                            }
                            className="mt-4 field-select"
                          >
                            <option value="">Select a player</option>
                            {players.map((player) => {
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
                              const label = `${player.fullName}${meta}${
                                player.isUnavailable ? " (Out)" : ""
                              }`;
                              return (
                                <option
                                  key={player.id}
                                  value={player.id}
                                  disabled={player.isUnavailable}
                                >
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                {saveError ? (
                  <div className="rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
                    {saveError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isSaving || optionsLoading}
                    className="flex-1 btn-primary px-4 py-2"
                  >
                    {isSaving ? "Saving..." : "Save Picks"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="btn-secondary w-full px-4 py-2 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : showEmptyState ? (
          <div className="empty-state">
            No picks yet. Tap Edit to add players.
          </div>
        ) : (
          <div className="space-y-3">
            {picksToRender.map((pick) => (
              <GroupPickCard
                key={pick.id ?? pick.groupLabel}
                {...pick}
                onSuggest={
                  canCreateSuggestions && pick.boardGroupId
                    ? () => startSuggesting(pick.boardGroupId)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Suggestions */}
      <section className="glass-card rounded-3xl p-5 md:p-6 space-y-3 motion-safe:animate-fade-up anim-delay-160">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl leading-none">Suggestions</h2>
            {canManageSuggestions ? (
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Pending {pendingSuggestionCount} of {suggestions.length} total
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageSuggestions && suggestions.length > 0 ? (
              <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1">
                {[
                  { key: "pending", label: "Pending", count: pendingSuggestionCount },
                  { key: "reviewed", label: "Reviewed", count: reviewedSuggestionCount },
                  { key: "all", label: "All", count: suggestions.length },
                ].map((filter) => {
                  const activeFilter = suggestionFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setSuggestionFilter(filter.key)}
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                        activeFilter
                          ? "bg-[color:var(--ink)] text-white shadow-sm"
                          : "text-[color:var(--muted)] hover:text-[color:var(--ink)]",
                      ].join(" ")}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  );
                })}
              </div>
            ) : null}
            {canCreateSuggestions ? (
              <button
                type="button"
                onClick={() =>
                  isSuggesting ? cancelSuggesting() : startSuggesting()
                }
                disabled={!canCreateSuggestions}
                className="btn-secondary rounded-full px-3 py-1 text-xs tracking-[0.08em]"
              >
                {isSuggesting ? "Close" : "New"}
              </button>
            ) : null}
          </div>
        </div>
        {isOwner ? (
          <div className="rounded-2xl border border-[rgba(31,102,255,0.18)] bg-[rgba(31,102,255,0.07)] px-3 py-2 text-xs text-[color:var(--ink-2)]">
            Review incoming suggestions and accept the best swap before locking picks.
          </div>
        ) : null}
        {suggestionNotice ? (
          <div className="rounded-2xl border border-[rgba(30,166,114,0.28)] bg-[rgba(30,166,114,0.1)] px-3 py-2 text-xs text-[color:var(--ink)]">
            {suggestionNotice}
          </div>
        ) : null}

        {isSuggesting ? (
          <form
            className="rounded-2xl border border-white/80 bg-white/70 p-4 space-y-3"
            onSubmit={handleSuggestionSubmit}
          >
            {currentSuggestionPick ? (
              <div className="rounded-2xl border border-[rgba(16,33,57,0.08)] bg-white/80 px-3 py-2 text-xs text-[color:var(--muted)]">
                Current pick:{" "}
                <span className="font-semibold text-[color:var(--ink)]">
                  {currentSuggestionPick.playerName}
                </span>
              </div>
            ) : null}

            <div>
              <label className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                Search players
              </label>
              <input
                type="text"
                value={suggestionSearch}
                onChange={(event) => setSuggestionSearch(event.target.value)}
                className="mt-2 field-input"
                placeholder="Type a name or team code"
              />
              {suggestionSearchValue ? (
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {filteredSuggestionPlayers.length} match
                  {filteredSuggestionPlayers.length === 1 ? "" : "es"}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                  Group
                </label>
                <select
                  value={suggestionGroupId}
                  onChange={(event) => {
                    setSuggestionGroupId(event.target.value);
                    setSuggestionPlayerId("");
                  }}
                  className="mt-2 field-select"
                >
                  {orderedGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                  Player
                </label>
                <select
                  value={suggestionPlayerId}
                  onChange={(event) => setSuggestionPlayerId(event.target.value)}
                  className="mt-2 field-select"
                  disabled={optionsLoading || filteredSuggestionPlayers.length === 0}
                >
                  <option value="">
                    {optionsLoading
                      ? "Loading players..."
                      : filteredSuggestionPlayers.length
                        ? "Select a player"
                        : "No matching players"}
                  </option>
                  {filteredSuggestionPlayers.map((player) => {
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
                    const meta = parts.length ? ` - ${parts.join(" | ")}` : "";
                    const label = `${player.fullName}${meta}${
                      player.isUnavailable ? " (Out)" : ""
                    }`;
                    return (
                      <option
                        key={player.id}
                        value={player.id}
                        disabled={player.isUnavailable}
                      >
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <textarea
              value={suggestionReason}
              onChange={(event) => setSuggestionReason(event.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              className="field-textarea"
            />

            {optionsError ? (
              <div className="text-xs text-[color:var(--accent)]">
                {optionsError}
              </div>
            ) : null}

            {suggestionFormError ? (
              <div className="text-xs text-[color:var(--accent)]">
                {suggestionFormError}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={suggestionSaving || optionsLoading}
                className="flex-1 btn-primary px-4 py-2"
              >
                {suggestionSaving ? "Sending..." : "Send Suggestion"}
              </button>
              <button
                type="button"
                onClick={cancelSuggesting}
                className="btn-secondary w-full px-4 py-2 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {!hasBackend ? (
          <div className="empty-state">
            Sign in to view suggestions.
          </div>
        ) : suggestionsLoading ? (
          <div className="empty-state">
            Loading suggestions...
          </div>
        ) : suggestionsError ? (
          <div className="rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {suggestionsError}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="empty-state">
            No suggestions yet.
          </div>
        ) : suggestionsToRender.length === 0 ? (
          <div className="empty-state">
            No {suggestionFilter} suggestions.
          </div>
        ) : (
          <div className="space-y-3">
            {suggestionsToRender.map((suggestion) => (
              <div
                key={suggestion.id}
                className="surface-card rounded-2xl px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                      {suggestion.groupLabel}
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--ink)]">
                      {suggestion.playerName}
                      {suggestion.teamCode ? ` - ${suggestion.teamCode}` : ""}
                    </div>
                    {suggestion.reason ? (
                      <div className="text-xs text-[color:var(--muted)]">
                        "{suggestion.reason}"
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]",
                      suggestion.status === "pending"
                        ? "border border-[rgba(31,102,255,0.28)] bg-[rgba(31,102,255,0.12)] text-[color:var(--ink)]"
                        : suggestion.status === "accepted"
                          ? "border border-[rgba(30,166,114,0.3)] bg-[rgba(30,166,114,0.12)] text-[color:var(--ink)]"
                          : "border border-[rgba(227,79,84,0.3)] bg-[rgba(227,79,84,0.12)] text-[color:var(--ink)]",
                    ].join(" ")}
                  >
                    {formatSuggestionStatus(suggestion.status)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>
                    {suggestion.displayName}
                  </span>
                  <span>{formatTimestamp(suggestion.createdAt)}</span>
                </div>
                {suggestion.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleSuggestionAction(suggestion.id, "accepted")
                      }
                      disabled={
                        !canAcceptSuggestions || suggestionActionId === suggestion.id
                      }
                      className="btn-primary rounded-full px-3 py-1 text-xs tracking-[0.08em]"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleSuggestionAction(suggestion.id, "rejected")
                      }
                      disabled={
                        !canManageSuggestions || suggestionActionId === suggestion.id
                      }
                      className="btn-secondary rounded-full px-3 py-1 text-xs tracking-[0.08em]"
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {suggestionActionError ? (
              <div className="text-xs text-[color:var(--accent)]">
                {suggestionActionError}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Comments */}
      <section className="glass-card rounded-3xl p-5 md:p-6 space-y-3 motion-safe:animate-fade-up anim-delay-240">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl leading-none">Comments</h2>
          <span className="text-xs text-[color:var(--muted)]">
            {counts.comments}
          </span>
        </div>

        {!hasBackend ? (
          <div className="empty-state">
            Sign in to view comments.
          </div>
        ) : commentsLoading ? (
          <div className="empty-state">
            Loading comments...
          </div>
        ) : commentsError ? (
          <div className="rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {commentsError}
          </div>
        ) : comments.length === 0 ? (
          <div className="empty-state">
            No comments yet.
          </div>
        ) : (
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
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)] ${
                            isMine
                              ? "border-[rgba(42,157,244,0.35)] bg-[rgba(42,157,244,0.12)]"
                              : "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]"
                          }`}
                        >
                          {isMine ? "You" : "Friend"}
                        </span>
                      </span>
                      <span>{formatTimestamp(comment.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--ink)]">
                      {comment.body}
                    </div>
                    {canComment ? (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTargetId(
                              replyTargetId === comment.id ? null : comment.id
                            );
                            setReplyBody("");
                            setReplyError("");
                          }}
                          className="btn-secondary rounded-full px-3 py-1 text-xs tracking-[0.08em]"
                        >
                          Reply
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {replies.length ? (
                    <div className="space-y-2 pl-3 sm:pl-6">
                      {replies.map((reply) => {
                        const replyIsMine = reply.userId === userId;
                        const replyName =
                          reply.displayName || (replyIsMine ? "You" : "Friend");
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
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)] ${
                                    replyIsMine
                                      ? "border-[rgba(42,157,244,0.35)] bg-[rgba(42,157,244,0.12)]"
                                      : "border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)]"
                                  }`}
                                >
                                  {replyIsMine ? "You" : "Friend"}
                                </span>
                              </span>
                              <span>{formatTimestamp(reply.createdAt)}</span>
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
                      onSubmit={(event) => handleReplySubmit(event, comment.id)}
                      className="space-y-2 pl-3 sm:pl-6"
                    >
                      <textarea
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        className="field-textarea"
                        placeholder="Write a reply..."
                        rows={2}
                        disabled={!canComment || replySaving}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="submit"
                          disabled={!canComment || replySaving || !replyBody.trim()}
                          className="btn-primary w-full px-4 py-2 sm:w-auto"
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
                          className="btn-secondary w-full px-4 py-2 sm:w-auto"
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
                className="w-full btn-secondary px-4 py-2 shadow-sm"
              >
                Show more comments
              </button>
            ) : null}
          </div>
        )}

        {hasBackend ? (
          <form onSubmit={handleCommentSubmit} className="space-y-2">
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              className="field-textarea"
              placeholder="Write a comment..."
              rows={2}
              disabled={!canComment || commentSaving}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={!canComment || commentSaving || !commentBody.trim()}
                className="btn-primary w-full px-4 py-2 sm:w-auto"
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

      {/* Lock button (scrolls normally now) */}
      <div className="pt-2 motion-safe:animate-fade-up anim-delay-320">
        {showLockConfirm ? (
          <div className="surface-card mb-3 rounded-2xl px-4 py-3">
            <div className="text-sm font-semibold text-[color:var(--ink)]">
              Confirm lock
            </div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Locking finalizes your board and accepts no more edits.
            </div>
            <div className="mt-2 text-xs text-[color:var(--ink-2)]">
              Selected groups: {selectedGroupCount}/{orderedGroups.length}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowLockConfirm(false)}
                className="btn-secondary w-full px-4 py-2 sm:w-auto"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmLockPicks}
                disabled={isLocking}
                className="btn-danger w-full px-4 py-2 sm:w-auto"
              >
                {isLocking ? "Locking..." : "Yes, lock picks"}
              </button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLockPicks}
          disabled={!canLock || isLocking}
          className="btn-danger w-full py-3 text-sm tracking-[0.1em]"
        >
          {isLocked
            ? "Picks locked"
            : showLockConfirm
              ? "Review lock details"
              : "Lock picks"}
        </button>
        {lockError ? (
          <div className="mt-3 rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {lockError}
          </div>
        ) : null}
      </div>
    </div>
  );
}


