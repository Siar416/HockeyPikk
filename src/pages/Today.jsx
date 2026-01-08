import GroupPickCard from "../components/GroupPickCard";

export default function Today() {
  // TODO: load today's board + user picks; handle loading/error/empty states.
  // TODO: derive board status (Draft/Locked) + lock time from server state.
  // TODO: gate edit/lock actions based on auth + board ownership rules.
  const samplePicks = [
    {
      groupLabel: "Group 1",
      playerName: "Connor McDavid",
      teamCode: "EDM",
      teamName: "Oilers",
      isLocked: false,
    },
    {
      groupLabel: "Group 2",
      playerName: "Auston Matthews",
      teamCode: "TOR",
      teamName: "Maple Leafs",
      isLocked: false,
    },
    {
      groupLabel: "Group 3",
      playerName: "Cale Makar",
      teamCode: "COL",
      teamName: "Avalanche",
      isLocked: false,
    },
  ];
  // TODO: replace samplePicks with API data; use group id as key.

  return (
    <div className="space-y-5">
      {/* Page header */}
      <section className="glass-card rounded-3xl p-5 motion-safe:animate-fade-up">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
              Today
            </p>
            <h1 className="font-display text-4xl uppercase leading-none">
              Jan 8
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Thursday - Week 14
              {/* TODO: format date + weekday dynamically */}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
              Status
            </span>
            <span className="rounded-full bg-[rgba(244,68,79,0.14)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
              Draft
              {/* TODO: status should change to Locked when user locks picks */}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
          <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1">
            3 groups
          </span>
          <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1">
            0 comments
          </span>
          <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1">
            Lock by 7:00 PM
            {/* TODO: show lock deadline */}
          </span>
        </div>
      </section>

      {/* Your Picks */}
      <section className="glass-card rounded-3xl p-5 space-y-4 motion-safe:animate-fade-up anim-delay-80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl uppercase">Your Picks</h2>
            <p className="text-xs text-[color:var(--muted)]">
              3 groups - 3/3 selected
              {/* TODO: compute selected count */}
            </p>
          </div>

          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
          >
            Edit
            {/* TODO: show Edit only when Draft */}
            {/* TODO: open edit flow (modal/drawer/page) */}
          </button>
        </div>

        {/* TODO: show empty state when no pick is set for a group */}
        <div className="space-y-3">
          {samplePicks.map((pick) => (
            <GroupPickCard key={pick.groupLabel} {...pick} />
          ))}
        </div>
      </section>

      {/* Suggestions */}
      <section className="glass-card rounded-3xl p-5 space-y-3 motion-safe:animate-fade-up anim-delay-160">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Suggestions</h2>
          <span className="text-xs text-[color:var(--muted)]">0</span>
        </div>
        <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          No suggestions yet.
        </div>
        {/* TODO: show suggestion cards with Accept / Reject actions */}
        {/* TODO: include who suggested + timestamp + reason */}
        {/* TODO: allow the user to undo/withdraw their own suggestions */}
      </section>

      {/* Comments */}
      <section className="glass-card rounded-3xl p-5 space-y-3 motion-safe:animate-fade-up anim-delay-240">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Comments</h2>
          <span className="text-xs text-[color:var(--muted)]">0</span>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          No comments yet.
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
            placeholder="Write a comment..."
            // TODO: controlled input state + validation
          />
          <button
            type="button"
            className="rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1d4ed8)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white shadow-[0_12px_26px_rgba(15,23,42,0.25)]"
          >
            Send
            {/* TODO: submit comment (disable while sending) */}
          </button>
        </div>
      </section>

      {/* Lock button (scrolls normally now) */}
      <div className="pt-2 motion-safe:animate-fade-up anim-delay-320">
        <button
          type="button"
          className="w-full rounded-2xl bg-[linear-gradient(135deg,_#f4444f,_#ff885e)] py-3 font-display text-lg uppercase tracking-[0.35em] text-white shadow-[0_18px_40px_rgba(244,68,79,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(244,68,79,0.45)]"
        >
          Lock Picks
          {/* TODO: lock picks action (only owner can lock) */}
          {/* TODO: confirm dialog + require all groups filled */}
        </button>
      </div>
    </div>
  );
}
