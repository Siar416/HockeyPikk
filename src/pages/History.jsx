export default function History() {
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
            {/* TODO: open filters */}
          </button>
        </div>
        <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          No history yet.
        </div>
        {/* TODO: list previous boards with rank + result */}
      </section>
    </div>
  );
}
