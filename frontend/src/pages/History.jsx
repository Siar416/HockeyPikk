import { useEffect, useState } from "react";
import { fetchHistory } from "../lib/historyService";

const formatBoardDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export default function History({ session }) {
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const accessToken = session?.access_token;

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
        limit: 12,
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
  }, [accessToken]);

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
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
          >
            Filter
          </button>
        </div>

        {!accessToken
          ? renderEmptyState("Sign in to view your history.")
          : isLoading
            ? renderEmptyState("Loading history...")
            : loadError
              ? renderEmptyState(loadError)
              : boards.length === 0
                ? renderEmptyState("No history yet.")
                : (
                    <div className="space-y-2">
                      {boards.map((board) => (
                        <div
                          key={board.id}
                          className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">
                              {formatBoardDate(board.board_date)}
                            </span>
                            <span className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                              {board.status === "locked" ? "Locked" : "Draft"}
                            </span>
                          </div>
                          <div className="text-xs text-[color:var(--muted)]">
                            Board #{board.id.slice(0, 6)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
      </section>
    </div>
  );
}
