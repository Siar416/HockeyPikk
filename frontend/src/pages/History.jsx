import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHistory } from "../lib/historyService";

const HISTORY_PAGE_SIZE = 12;
const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "locked", label: "Locked" },
  { key: "draft", label: "Draft" },
];

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

const formatBoardDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const buildPickMeta = (pick) => {
  const parts = [];
  if (pick.team_code) parts.push(pick.team_code);
  if (pick.opponent_team_code) parts.push(`vs ${pick.opponent_team_code}`);
  if (pick.position) parts.push(pick.position);
  const lineLabel = formatLineMeta(pick.line);
  if (lineLabel) parts.push(lineLabel);
  const ppLabel = formatPpMeta(pick.pp_line);
  if (ppLabel) parts.push(ppLabel);
  return parts.join(" | ");
};

const formatOpponentRecord = (record) => {
  if (!record || typeof record !== "object") return null;
  const wins = Number(record.wins);
  const losses = Number(record.losses);
  const otLosses = Number(record.otLosses);
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || !Number.isFinite(otLosses)) {
    return null;
  }
  const total = wins + losses + otLosses;
  if (total <= 0) return null;
  return `${wins}-${losses}-${otLosses}`;
};

const getGoalLabel = (pick) => {
  if (pick.played_game === null) return "Pending";
  if (pick.played_game === false) return "No game";
  const goals = Number(pick.goals);
  if (Number.isFinite(goals) && goals > 0) {
    return `${goals} Goal${goals === 1 ? "" : "s"}`;
  }
  return "No goal";
};

const getGoalBadgeStyles = (pick) => {
  if (pick.played_game === null) {
    return "border border-[rgba(255,180,84,0.6)] bg-[rgba(255,180,84,0.2)] text-[color:var(--ink)]";
  }
  if (pick.played_game === false) {
    return "border border-white/80 bg-white/70 text-[color:var(--muted)]";
  }
  if (Number(pick.goals) > 0) {
    return "border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.16)] text-[color:var(--ink)]";
  }
  return "border border-[rgba(15,23,42,0.12)] bg-white/70 text-[color:var(--muted)]";
};

export default function History({ session, onExitGuest }) {
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedBoardId, setExpandedBoardId] = useState(null);
  const accessToken = session?.access_token;
  const navigate = useNavigate();

  useEffect(() => {
    setLimit(HISTORY_PAGE_SIZE);
    setStatusFilter("all");
    setExpandedBoardId(null);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setBoards([]);
      setLoadError("");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setLoadError("");

      const { data, error } = await fetchHistory({
        accessToken,
        limit,
      });

      if (!isMounted) return;

      if (error) {
        setLoadError(error.message);
        setIsLoading(false);
        return;
      }

      setBoards(data?.boards ?? []);
      setIsLoading(false);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [accessToken, limit]);

  const filteredBoards = useMemo(() => {
    if (statusFilter === "all") return boards;
    return boards.filter((board) => board.status === statusFilter);
  }, [boards, statusFilter]);

  const hasMore = boards.length >= limit;
  const emptyHistoryMessage =
    statusFilter === "locked"
      ? "No locked boards yet."
      : statusFilter === "draft"
        ? "No draft boards yet."
        : "No history yet.";
  const emptyHistoryHint =
    statusFilter === "locked"
      ? "Lock your picks to see them here."
      : "Start today's board to build your history.";

  const handleStartToday = () => navigate("/today");
  const handleSignIn = () => {
    if (onExitGuest) {
      onExitGuest();
      return;
    }
    navigate("/login");
  };

  const renderEmptyState = (message) => (
    <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
      {message}
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Archive
        </p>
        <h1 className="font-display text-3xl uppercase">History</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Track past boards and how your picks performed.
        </p>
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Recent Boards</h2>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  className={[
                    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] shadow-sm transition",
                    isActive
                      ? "border-white/80 bg-white text-[color:var(--ink)]"
                      : "border-white/70 bg-white/70 text-[color:var(--muted)] hover:bg-white/90 hover:text-[color:var(--ink)]",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {!accessToken ? (
          <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
            <div>Sign in to view your history.</div>
            <button
              type="button"
              onClick={handleSignIn}
              className="mt-3 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
            >
              Sign In
            </button>
          </div>
        ) : isLoading
          ? renderEmptyState("Loading history...")
          : loadError
            ? renderEmptyState(loadError)
            : filteredBoards.length === 0
              ? (
                  <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
                    <div>{emptyHistoryMessage}</div>
                    <div className="mt-2 text-xs text-[color:var(--muted)]">
                      {emptyHistoryHint}
                    </div>
                    <button
                      type="button"
                      onClick={handleStartToday}
                      className="mt-3 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
                    >
                      Go to Today
                    </button>
                  </div>
                )
              : (
                  <div className="space-y-2">
                    {filteredBoards.map((board) => {
                      const picks = Array.isArray(board.picks)
                        ? [...board.picks].sort(
                            (a, b) =>
                              (a.board_groups?.sort_order ?? 0) -
                              (b.board_groups?.sort_order ?? 0)
                          )
                        : [];
                      const totalPicks = picks.length;
                      const goalCount = picks.filter((pick) => pick.scored_goal)
                        .length;
                      const noGames =
                        totalPicks > 0 &&
                        picks.every((pick) => pick.played_game === false);
                      const hasUnknown = picks.some(
                        (pick) => pick.played_game === null
                      );
                      const hasPlayed = picks.some(
                        (pick) => pick.played_game === true
                      );
                      const statusNote =
                        totalPicks === 0
                          ? "No picks submitted"
                          : noGames
                            ? "No games on this date"
                          : hasUnknown && hasPlayed
                            ? "Updating results"
                            : hasUnknown
                              ? "Awaiting games"
                              : "Final results";
                      const summaryLabel =
                        totalPicks === 0
                          ? "No picks saved"
                          : noGames
                            ? "No games"
                          : hasUnknown && !hasPlayed
                            ? "Results pending"
                            : `Goals: ${goalCount}/${totalPicks}`;
                      const isExpanded = expandedBoardId === board.id;
                      return (
                        <div
                          key={board.id}
                          className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {formatBoardDate(board.board_date)}
                              </div>
                              <div className="text-xs text-[color:var(--muted)]">
                                Board #{board.id.slice(0, 6)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                                {board.status === "locked" ? "Locked" : "Draft"}
                              </span>
                              <span className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)]">
                                {summaryLabel}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
                            <span>{statusNote}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBoardId((prev) =>
                                  prev === board.id ? null : board.id
                                )
                              }
                              className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ink)] shadow-sm"
                            >
                              {isExpanded ? "Hide picks" : "View picks"}
                            </button>
                          </div>
                          {isExpanded ? (
                            <div className="mt-4 space-y-2">
                              {picks.length === 0 ? (
                                renderEmptyState("No picks for this board.")
                              ) : (
                                picks.map((pick) => {
                                  const meta = buildPickMeta(pick);
                                  const recordLabel = formatOpponentRecord(
                                    pick.opponent_record
                                  );
                                  return (
                                    <div
                                      key={pick.id}
                                      className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">
                                            {pick.board_groups?.label || "Group"}
                                          </div>
                                          <div className="text-sm font-semibold text-[color:var(--ink)]">
                                            {pick.player_name}
                                          </div>
                                          {meta ? (
                                            <div className="text-xs text-[color:var(--muted)]">
                                              {meta}
                                            </div>
                                          ) : null}
                                          {recordLabel ? (
                                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
                                              <span className="rounded-full border border-white/80 bg-white/80 px-2 py-1 shadow-sm">
                                                H2H vs{" "}
                                                {pick.opponent_team_code ||
                                                  pick.opponent_team_name ||
                                                  "Opponent"}
                                                <span className="ml-2 font-semibold tracking-normal text-[color:var(--ink)]">
                                                  {recordLabel}
                                                </span>
                                              </span>
                                            </div>
                                          ) : null}
                                        </div>
                                        <span
                                          className={[
                                            "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                                            getGoalBadgeStyles(pick),
                                          ].join(" ")}
                                        >
                                          {getGoalLabel(pick)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {hasMore ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLimit((prev) => prev + HISTORY_PAGE_SIZE)
                        }
                        className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm"
                      >
                        Show more
                      </button>
                    ) : null}
                  </div>
                )}
      </section>
    </div>
  );
}
