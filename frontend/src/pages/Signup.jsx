export default function Signup({ onSubmit, onSwitch, onGuest, error, notice }) {
  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[conic-gradient(from_180deg,_#0ea5e9,_#22d3ee,_#f97316,_#0ea5e9)] text-white font-display text-xl">
          HP
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Join
          </p>
          <h1 className="font-display text-3xl uppercase">Sign Up</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Create your HockeyPikk account to share picks with friends.
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(15,23,42,0.08)]" />

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="signup-name"
            className="block text-[11px] uppercase tracking-[0.25em] text-[color:var(--muted)]"
          >
            Display Name
          </label>
          <input
            id="signup-name"
            type="text"
            name="displayName"
            placeholder="Ice Captain"
            autoComplete="nickname"
            required
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="signup-email"
            className="block text-[11px] uppercase tracking-[0.25em] text-[color:var(--muted)]"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            name="email"
            placeholder="you@rinkmail.com"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="signup-password"
            className="block text-[11px] uppercase tracking-[0.25em] text-[color:var(--muted)]"
          >
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            name="password"
            placeholder="Create a password"
            autoComplete="new-password"
            required
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
          />
          <p className="text-xs text-[color:var(--muted)]">
            Use at least 8 characters.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            className="w-full rounded-2xl bg-[linear-gradient(135deg,_#f4444f,_#ff885e)] py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_14px_28px_rgba(244,68,79,0.25)] sm:text-xs sm:tracking-[0.28em]"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={onGuest}
            className="w-full rounded-2xl border border-white/80 bg-white/70 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ink)] sm:text-xs sm:tracking-[0.28em]"
          >
            Continue as Guest
          </button>
        </div>
        {notice ? (
          <p
            role="status"
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs text-[color:var(--muted)]"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]"
          >
            {error}
          </p>
        ) : null}
      </form>

      <div className="pt-4 text-center text-xs text-[color:var(--muted)]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-[color:var(--ink)]"
        >
          Sign in
        </button>
      </div>
    </section>
  );
}
