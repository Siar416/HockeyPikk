import { useEffect, useState } from "react";
import Today from "./pages/Today";
import Friends from "./pages/Friends";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { getMe, signIn, signUp } from "./lib/authService";
import { fetchFriends } from "./lib/friendsService";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

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
    path: "/today",
  },
  {
    key: "friends",
    label: "Friends",
    path: "/friends",
  },
  {
    key: "history",
    label: "History",
    path: "/history",
  },
  {
    key: "profile",
    label: "Profile",
    path: "/profile",
  },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [pendingSuggestionCount, setPendingSuggestionCount] = useState(0);
  const [commentNotificationCount, setCommentNotificationCount] = useState(0);
  const [boardSummary, setBoardSummary] = useState(null);
  const isAuthed = Boolean(session) || isGuest;
  const location = useLocation();
  const navigate = useNavigate();
  const authView = location.pathname === "/signup" ? "signup" : "login";
  const active =
    location.pathname === "/friends"
      ? "friends"
      : location.pathname === "/history"
        ? "history"
        : location.pathname === "/profile"
          ? "profile"
          : "today";

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
        navigate("/today", { replace: true });
        return;
      }

      setSession(loadStoredSession());
    };

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

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

  useEffect(() => {
    if (!session?.access_token) {
      setPendingSuggestionCount(0);
      setCommentNotificationCount(0);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token || isGuest) {
      setBoardSummary(null);
    }
  }, [isGuest, session?.access_token]);

  const handleAuthSwitch = () => {
    const next = authView === "login" ? "/signup" : "/login";
    navigate(next);
    setAuthError("");
    setAuthNotice("");
  };

  const handleGuest = () => {
    setIsGuest(true);
    setSession(null);
    setAuthError("");
    setAuthNotice("");
    navigate("/today");
  };

  const handleAuthExit = () => {
    setSession(null);
    setIsGuest(false);
    setAuthError("");
    setAuthNotice("");
    navigate("/login");
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
    navigate("/today");
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
    navigate("/today");
  };

  const handleProfileUpdate = (nextDisplayName) => {
    setSession((prev) => {
      if (!prev?.user) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          user_metadata: {
            ...(prev.user.user_metadata || {}),
            display_name: nextDisplayName,
          },
        },
      };
    });
  };

  const fallbackName =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "Player";
  const displayName = isGuest ? "Guest" : fallbackName;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const boardStatusValue = boardSummary?.status;
  const boardStatusLabel = boardStatusValue
    ? boardStatusValue === "locked"
      ? "Locked"
      : "Draft"
    : isGuest
      ? "Preview"
      : "Draft";
  const boardStatusStyles =
    boardStatusValue === "locked"
      ? "border border-[rgba(240,78,78,0.35)] bg-[linear-gradient(135deg,_rgba(240,78,78,0.2),_rgba(255,180,120,0.24))] text-[color:var(--accent)]"
      : boardStatusLabel === "Preview"
      ? "border border-[rgba(42,157,244,0.35)] bg-[linear-gradient(135deg,_rgba(42,157,244,0.2),_rgba(129,212,250,0.22))] text-[color:var(--ink)]"
      : "border border-[rgba(255,180,84,0.45)] bg-[linear-gradient(135deg,_rgba(255,180,84,0.22),_rgba(255,214,124,0.24))] text-[color:var(--ink)]";
  const authActionLabel = isGuest ? "Sign in" : "Log out";
  const todayNotificationCount =
    pendingSuggestionCount + commentNotificationCount;

  return (
    <div className="relative min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-6 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(31,102,255,0.24),_rgba(31,102,255,0))] blur-3xl" />
        <div className="absolute top-20 right-4 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(255,159,67,0.28),_rgba(255,159,67,0))] blur-3xl" />
        <div className="absolute bottom-12 -left-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(16,33,57,0.2),_rgba(16,33,57,0))] blur-3xl" />
      </div>

      {isAuthed ? (
        <>
          {/* Header */}
          <header className="fixed inset-x-0 top-0 z-30">
            <div className="mx-auto max-w-5xl px-4 pt-4">
              <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-[26px] px-4 py-3 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(140deg,_#13356b,_#1f66ff)] text-white font-display text-xl shadow-[0_10px_24px_rgba(19,53,107,0.35)]">
                    HP
                  </div>
                  <div className="min-w-0">
                    <p className="kicker">HockeyPikk</p>
                    <p className="truncate text-sm text-[color:var(--muted)]">
                      {isGuest
                        ? "Guest mode - Explore today's board"
                        : `Welcome back, ${displayName}`}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <span className="grid h-7 w-7 place-items-center rounded-full border border-white/75 bg-white/90 text-[11px] font-semibold text-[color:var(--ink)] shadow-sm">
                    {initials || "HP"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold shadow-[0_8px_16px_rgba(16,33,57,0.12)] ${boardStatusStyles}`}
                  >
                    {boardStatusLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleAuthExit}
                    className="btn-secondary rounded-full px-3 py-2 text-xs tracking-[0.08em]"
                  >
                    {authActionLabel}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="relative z-10 mx-auto max-w-5xl space-y-4 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-36 md:pb-28 md:pt-32">
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route
                path="/today"
                element={
                  <Today
                    session={session}
                    onSuggestionCount={setPendingSuggestionCount}
                    onCommentCount={setCommentNotificationCount}
                    onBoardUpdate={setBoardSummary}
                  />
                }
              />
              <Route
                path="/friends"
                element={
                  <Friends
                    session={session}
                    onRequestsCount={setFriendRequestCount}
                  />
                }
              />
              <Route
                path="/history"
                element={
                  <History session={session} onExitGuest={handleAuthExit} />
                }
              />
              <Route
                path="/profile"
                element={
                  <Profile
                    session={session}
                    onProfileUpdate={handleProfileUpdate}
                    onAuthExit={handleAuthExit}
                    isGuest={isGuest}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </main>

          {/* Bottom Nav */}
          <nav className="fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-5xl px-4">
              <div className="grid grid-cols-4 gap-2 rounded-[24px] border border-white/75 bg-white/90 p-2.5 shadow-[0_18px_40px_rgba(16,33,57,0.18)] backdrop-blur">
                {tabs.map((t) => {
                  const isActive = active === t.key;
                  const showCommentBubble =
                    t.key === "today" && commentNotificationCount > 0;
                  const notificationCount =
                    t.key === "friends"
                      ? friendRequestCount
                      : t.key === "today"
                        ? todayNotificationCount
                        : 0;
                  return (
                    <button
                      key={t.key}
                      onClick={() => navigate(t.path)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={
                        notificationCount > 0
                          ? `${t.label} (${notificationCount} new)`
                          : t.label
                      }
                      className={[
                        "relative flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-semibold transition",
                        isActive
                          ? "bg-[linear-gradient(135deg,_rgba(31,102,255,0.14),_rgba(255,159,67,0.16))] text-[color:var(--ink)] shadow-[0_8px_18px_rgba(16,33,57,0.12)]"
                          : "text-[color:var(--muted)] hover:bg-white/70 hover:text-[color:var(--ink)]",
                      ].join(" ")}
                    >
                      {notificationCount > 0 ? (
                        <span className="pointer-events-none absolute -top-2 right-1 flex items-center gap-1">
                          {showCommentBubble ? (
                            <span className="grid h-5 w-5 place-items-center rounded-full border border-white/70 bg-[linear-gradient(135deg,_#22c55e,_#16a34a)] text-white shadow-[0_4px_10px_rgba(34,197,94,0.35)]">
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-3 w-3"
                                fill="currentColor"
                              >
                                <path d="M7.5 6.5h9A3 3 0 0 1 19.5 9.5v4a3 3 0 0 1-3 3H11l-3 2.2V16.5H7.5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" />
                              </svg>
                            </span>
                          ) : null}
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#f97316,_#ef4444)] px-1 text-[11px] font-semibold leading-none tracking-normal text-white shadow-[0_6px_14px_rgba(244,68,79,0.35)]">
                            {notificationCount > 99 ? "99+" : notificationCount}
                          </span>
                        </span>
                      ) : null}
                      <span className="text-[12px] tracking-[0.06em]">
                        {t.label}
                      </span>
                      <span
                        className={[
                          "h-1 w-5 rounded-full transition",
                          isActive
                            ? "bg-[linear-gradient(90deg,_rgba(31,102,255,0.9),_rgba(227,79,84,0.9))]"
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
        <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-lg flex-col justify-center px-4 py-8 sm:py-10">
          <Routes>
            <Route
              path="/login"
              element={
                <Login
                  onSubmit={handleLoginSubmit}
                  onSwitch={handleAuthSwitch}
                  onGuest={handleGuest}
                  error={authError}
                />
              }
            />
            <Route
              path="/signup"
              element={
                <Signup
                  onSubmit={handleSignupSubmit}
                  onSwitch={handleAuthSwitch}
                  onGuest={handleGuest}
                  error={authError}
                  notice={authNotice}
                />
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}
