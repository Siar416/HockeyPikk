export default function Friends() {
  return (
    <div className="space-y-4">
      <section className="glass-card rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Social
        </p>
        <h1 className="font-display text-3xl uppercase">Friends</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Invite friends and swap suggestions in real time.
        </p>
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Your Crew</h2>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
          >
            Invite
            {/* TODO: open invite flow */}
          </button>
        </div>
        <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          No friends yet.
        </div>
        {/* TODO: list friends with status + shared boards */}
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Requests</h2>
          <span className="text-xs text-[color:var(--muted)]">0</span>
        </div>
        <div className="rounded-2xl border border-dashed border-white/80 bg-white/70 px-4 py-6 text-center text-sm text-[color:var(--muted)]">
          No invites yet.
        </div>
        {/* TODO: show incoming friend requests */}
      </section>
    </div>
  );
}
