export default function Login({ onSubmit, onSwitch, onGuest, error }) {
  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[conic-gradient(from_180deg,_#0ea5e9,_#22d3ee,_#f97316,_#0ea5e9)] text-white font-display text-xl">
          HP
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Welcome
          </p>
          <h1 className="font-display text-3xl uppercase">Sign In</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Share today&apos;s picks, collect suggestions, and lock your board.
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(15,23,42,0.08)]" />

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="block text-[11px] uppercase tracking-[0.25em] text-[color:var(--muted)]"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            placeholder="you@rinkmail.com"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-[11px] uppercase tracking-[0.25em] text-[color:var(--muted)]"
            >
              Password
            </label>
            <button
              type="button"
              className="text-[11px] text-[color:var(--muted)] hover:text-[color:var(--ink)]"
            >
              Forgot password?
              {/* TODO: connect Supabase reset password flow */}
            </button>
          </div>
          <input
            id="login-password"
            type="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
          />
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            className="w-full rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1d4ed8)] py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_14px_28px_rgba(15,23,42,0.25)] sm:text-xs sm:tracking-[0.28em]"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onGuest}
            className="w-full rounded-2xl border border-white/80 bg-white/70 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ink)] sm:text-xs sm:tracking-[0.28em]"
          >
            Continue as Guest
          </button>
        </div>
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
        New here?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-[color:var(--ink)]"
        >
          Create an account
        </button>
      </div>
    </section>
  );
}
