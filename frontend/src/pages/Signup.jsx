export default function Signup({ onSubmit, onSwitch, onGuest, error, notice }) {
  return (
    <section className="glass-card rounded-3xl p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,_#ce474d,_#ff9f43)] text-white font-display text-xl">
          HP
        </div>
        <div>
          <p className="kicker">Create account</p>
          <h1 className="font-display text-4xl leading-none">Sign up</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        Build your board, invite your crew, and track your picks over time.
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(16,33,57,0.1)]" />

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="signup-name"
            className="block text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]"
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
            className="field-input"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]"
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
            className="field-input"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="signup-password"
            className="block text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]"
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
            className="field-input"
          />
          <p className="text-xs text-[color:var(--muted)]">
            Use at least 8 characters.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="submit"
            className="btn-danger w-full py-3 text-sm tracking-[0.1em]"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={onGuest}
            className="btn-secondary w-full py-3 text-sm tracking-[0.1em]"
          >
            Continue as Guest
          </button>
        </div>
        {notice ? (
          <p
            role="status"
            className="rounded-2xl border border-[rgba(31,102,255,0.2)] bg-[rgba(31,102,255,0.08)] px-3 py-2 text-sm text-[color:var(--ink-2)]"
          >
            {notice}
          </p>
        ) : null}
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
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-[color:var(--ink)] underline-offset-4 hover:underline"
        >
          Sign in
        </button>
      </div>
    </section>
  );
}
