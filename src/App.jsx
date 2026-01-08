import { useState } from "react";
import Today from "./pages/Today";
import Friends from "./pages/Friends";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const tabs = [
  {
    key: "today",
    label: "Today",
  },
  {
    key: "friends",
    label: "Friends",
  },
  {
    key: "history",
    label: "History",
  },
  {
    key: "profile",
    label: "Profile",
  },
];

export default function App() {
  const [active, setActive] = useState("today");
  const [authView, setAuthView] = useState("login");
  const [isAuthed, setIsAuthed] = useState(false);
  // TODO: replace local auth state with Supabase session + auth listener.

  const renderPage = () => {
    if (active === "today") return <Today />;
    if (active === "friends") return <Friends />;
    if (active === "history") return <History />;
    return <Profile />;
  };

  const handleAuthSwitch = () => {
    setAuthView((prev) => (prev === "login" ? "signup" : "login"));
  };

  const handleGuest = () => {
    setIsAuthed(true);
  };

  const handleLoginSubmit = (event) => {
    event.preventDefault();
    // TODO: call Supabase signInWithPassword or magic link.
  };

  const handleSignupSubmit = (event) => {
    event.preventDefault();
    // TODO: call Supabase signUp and handle email confirmation.
  };

  return (
    <div className="relative min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.9),_rgba(255,255,255,0))] blur-3xl" />
        <div className="absolute top-32 -right-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(244,68,79,0.28),_rgba(244,68,79,0))] blur-2xl" />
        <div className="absolute bottom-10 -left-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(120,180,255,0.35),_rgba(120,180,255,0))] blur-2xl" />
      </div>

      {isAuthed ? (
        <>
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 z-30">
            <div className="mx-auto max-w-md px-4 pt-4">
              <div className="glass-card flex items-center justify-between rounded-3xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[conic-gradient(from_180deg,_#0ea5e9,_#22d3ee,_#f97316,_#0ea5e9)] text-white font-display text-xl">
                    HP
                  </div>
                  <div>
                    <div className="font-display text-2xl uppercase leading-none">
                      HockeyPikk
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">
                      Share today&apos;s picks with your crew
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
                    Board
                  </span>
                  <span className="rounded-full bg-[rgba(244,194,92,0.32)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                    Draft
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="relative z-10 mx-auto max-w-md space-y-4 px-4 pb-28 pt-32">
            {renderPage()}
          </main>

          {/* Bottom Nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 pb-4">
            <div className="mx-auto max-w-md px-4">
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur">
                {tabs.map((t) => {
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActive(t.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] uppercase tracking-[0.28em] transition",
                        isActive
                          ? "bg-[rgba(15,23,42,0.06)] text-[color:var(--ink)]"
                          : "text-[color:var(--muted)] hover:text-[color:var(--ink)]",
                      ].join(" ")}
                    >
                      {t.label}
                      <span
                        className={[
                          "h-1 w-5 rounded-full transition",
                          isActive
                            ? "bg-[color:var(--accent)]"
                            : "bg-transparent",
                        ].join(" ")}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </>
      ) : (
        <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-start px-4 py-12 sm:justify-center">
          {authView === "login" ? (
            <Login
              onSubmit={handleLoginSubmit}
              onSwitch={handleAuthSwitch}
              onGuest={handleGuest}
            />
          ) : (
            <Signup
              onSubmit={handleSignupSubmit}
              onSwitch={handleAuthSwitch}
              onGuest={handleGuest}
            />
          )}
        </main>
      )}
    </div>
  );
}
