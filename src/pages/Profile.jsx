export default function Profile() {
  return (
    <div className="space-y-4">
      <section className="glass-card rounded-3xl p-5">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
          Account
        </p>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[conic-gradient(from_180deg,_#0ea5e9,_#22d3ee,_#f97316,_#0ea5e9)] text-sm font-semibold text-white">
              HP
            </div>
            <div>
              <div className="font-display text-2xl uppercase leading-none">
                Guest
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                @hockeyfan
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
          >
            Edit
            {/* TODO: open profile editor */}
          </button>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Stats</h2>
          <span className="text-xs text-[color:var(--muted)]">Season</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Wins", value: "0" },
            { label: "Streak", value: "0" },
            { label: "Accuracy", value: "0%" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/80 bg-white/70 px-3 py-4 text-center"
            >
              <div className="font-display text-2xl uppercase">
                {stat.value}
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        {/* TODO: populate stats from user profile */}
      </section>
    </div>
  );
}
