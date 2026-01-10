// src/components/GroupPickCard.jsx

export default function GroupPickCard({
  groupLabel,
  playerName,
  teamCode,
  teamName,
  isLocked,
  onSuggest,
  onChange,
}) {
  const statusLabel = isLocked ? "Locked" : "Draft";
  const statusStyles = isLocked
    ? "bg-[rgba(244,68,79,0.18)] text-[color:var(--accent)]"
    : "bg-[rgba(34,197,94,0.18)] text-[color:var(--ink)]";

  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.1)] backdrop-blur">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
            {groupLabel}
          </span>
          {/* TODO: show group rules or context */}
        </div>

        <span
          className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.3em] ${statusStyles}`}
        >
          {statusLabel}
          {/* TODO: show lock time when locked */}
        </span>
      </div>

      {/* Selected player label */}
      <div className="mt-3 text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Selected Player
      </div>

      {/* Selected player row */}
      <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.9),_rgba(220,235,255,0.8))] px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[conic-gradient(from_180deg,_#0ea5e9,_#22d3ee,_#f97316,_#0ea5e9)] text-xs font-semibold text-white">
            {teamCode}
            {/* TODO: replace with team logo */}
          </div>

          <div>
            <div className="text-sm font-semibold text-[color:var(--ink)]">
              {playerName}
              {/* TODO: handle empty state when no player selected */}
            </div>
            <div className="text-xs text-[color:var(--muted)]">{teamName}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onChange}
          disabled={isLocked || !onChange}
          className="rounded-full bg-[color:var(--ink)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          // TODO: pass onChange when Draft (change selected player)
        >
          Picked
        </button>
      </div>

      {/* Actions row (optional) */}
      <div className="flex items-center justify-between pt-3 text-xs text-[color:var(--muted)]">
        <div>
          {statusLabel}
          {/* TODO: show "Locked at ." */}
        </div>

        <button
          type="button"
          onClick={onSuggest}
          disabled={isLocked || !onSuggest}
          className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          // TODO: pass onSuggest (friends suggestion flow)
        >
          Suggest changes
        </button>
      </div>
    </div>
  );
}
