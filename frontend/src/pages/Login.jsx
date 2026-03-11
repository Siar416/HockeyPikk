export default function Login({ onSubmit, onSwitch, onGuest, error }) {
  return (
    <section className="glass-card rounded-3xl p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,_#12346a,_#1f66ff)] text-white font-display text-xl">
          HP
        </div>
        <div>
          <p className="kicker">Welcome back</p>
          <h1 className="font-display text-4xl leading-none">Sign in</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Check today&apos;s board, compare picks with friends, and lock in your lineup.
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(16,33,57,0.1)]" />

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]"
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
            className="field-input"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            className="field-input"
          />
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            className="btn-primary w-full py-3 text-sm tracking-[0.1em]"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onGuest}
            className="btn-secondary w-full py-3 text-sm tracking-[0.1em]"
          >
            Continue as Guest
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-2xl border border-[rgba(227,79,84,0.3)] bg-[rgba(227,79,84,0.1)] px-3 py-2 text-sm text-[color:var(--accent)]"
          >
            {error}
          </p>
        ) : null}
      </form>

      <div className="pt-4 text-center text-sm text-[color:var(--muted)]">
        New here?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-[color:var(--ink)] underline-offset-4 hover:underline"
        >
          Create an account
        </button>
      </div>
    </section>
  );
}
