import { useEffect, useState } from "react";
import Today from "./pages/Today";
import Friends from "./pages/Friends";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { getMe, signIn, signUp } from "./lib/authService";
import { fetchFriends } from "./lib/friendsService";

const SESSION_STORAGE_KEY = "hp_session";

const loadStoredSession = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persistSession = (session) => {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
};

const parseAuthHash = () => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  if (!hash && !search) return null;

  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(search);
  const hashAccessToken = hashParams.get("access_token");
  const hashRefreshToken = hashParams.get("refresh_token");
  const accessToken = hashAccessToken || searchParams.get("access_token");
  const refreshToken = hashRefreshToken || searchParams.get("refresh_token");

  if (!accessToken) {
    return null;
  }

  const expiresIn = Number(
    hashParams.get("expires_in") || searchParams.get("expires_in") || 0
  );
  const expiresAt = expiresIn
    ? Math.floor(Date.now() / 1000) + expiresIn
    : null;

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType:
      hashParams.get("token_type") ||
      searchParams.get("token_type") ||
      "bearer",
    source: hashAccessToken || hashRefreshToken ? "hash" : "search",
  };
};

const clearAuthHash = (source) => {
  if (typeof window === "undefined") return;
  const { pathname } = window.location;

  if (source === "search") {
    const params = new URLSearchParams(window.location.search);
    ["access_token", "refresh_token", "expires_in", "token_type", "type"].forEach(
      (key) => params.delete(key)
    );
    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    window.history.replaceState({}, document.title, nextUrl);
    return;
  }

  const nextUrl = `${pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, nextUrl);
};

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
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const isAuthed = Boolean(session) || isGuest;

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const hashTokens = parseAuthHash();

      if (hashTokens?.accessToken) {
        clearAuthHash(hashTokens.source);
        const { data, error } = await getMe({
          accessToken: hashTokens.accessToken,
        });

        if (!isMounted) return;

        if (error) {
          setAuthError(error.message);
          setSession(null);
          return;
        }

        setSession({
          access_token: hashTokens.accessToken,
          refresh_token: hashTokens.refreshToken,
          expires_at: hashTokens.expiresAt ?? undefined,
          token_type: hashTokens.tokenType,
          user: data?.user ?? null,
        });
        setIsGuest(false);
        setAuthNotice("You're confirmed and signed in.");
        return;
      }

      setSession(loadStoredSession());
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    persistSession(session);
  }, [session]);

  useEffect(() => {
    if (!session?.access_token) {
      setFriendRequestCount(0);
      return;
    }

    let isMounted = true;

    const loadRequestCount = async () => {
      const { data, error } = await fetchFriends({
        accessToken: session.access_token,
      });

      if (!isMounted || error) return;

      setFriendRequestCount(data?.requests?.length ?? 0);
    };

    loadRequestCount();

    return () => {
      isMounted = false;
    };
  }, [session?.access_token]);

  const renderPage = () => {
    if (active === "today") return <Today session={session} />;
    if (active === "friends")
      return (
        <Friends
          session={session}
          onRequestsCount={setFriendRequestCount}
        />
      );
    if (active === "history") return <History session={session} />;
    return <Profile session={session} />;
  };

  const handleAuthSwitch = () => {
    setAuthView((prev) => (prev === "login" ? "signup" : "login"));
    setAuthError("");
    setAuthNotice("");
  };

  const handleGuest = () => {
    setIsGuest(true);
    setSession(null);
    setAuthError("");
    setAuthNotice("");
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { data, error } = await signIn({ email, password });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setIsGuest(false);
    setSession(data?.session ?? null);
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    const { data, error } = await signUp({
      email,
      password,
      displayName,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setIsGuest(false);
    setSession(data?.session ?? null);
    setAuthNotice(data?.notice || "");
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
            <div className="mx-auto max-w-md px-4 pt-4 md:max-w-3xl">
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
          <main className="relative z-10 mx-auto max-w-md space-y-4 px-4 pb-28 pt-32 md:max-w-3xl">
            {renderPage()}
          </main>

          {/* Bottom Nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 pb-4">
            <div className="mx-auto max-w-md px-4 md:max-w-3xl">
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur">
                {tabs.map((t) => {
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActive(t.key)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={
                        t.key === "friends" && friendRequestCount > 0
                          ? `${t.label} (${friendRequestCount} new)`
                          : t.label
                      }
                      className={[
                        "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] uppercase tracking-[0.28em] transition",
                        isActive
                          ? "bg-[rgba(15,23,42,0.06)] text-[color:var(--ink)]"
                          : "text-[color:var(--muted)] hover:text-[color:var(--ink)]",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-1">
                        {t.label}
                        {t.key === "friends" && friendRequestCount > 0 ? (
                          <span className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                        ) : null}
                      </span>
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
              error={authError}
            />
          ) : (
            <Signup
              onSubmit={handleSignupSubmit}
              onSwitch={handleAuthSwitch}
              onGuest={handleGuest}
              error={authError}
              notice={authNotice}
            />
          )}
        </main>
      )}
    </div>
  );
}
