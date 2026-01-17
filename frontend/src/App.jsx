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
  const todayNotificationCount =
    pendingSuggestionCount + commentNotificationCount;

  return (
    <div className="relative min-h-screen text-[color:var(--ink)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-12 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(90,165,255,0.26),_rgba(90,165,255,0))] blur-3xl" />
        <div className="absolute top-24 right-6 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(255,180,120,0.28),_rgba(255,180,120,0))] blur-3xl" />
        <div className="absolute bottom-12 -left-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(15,23,42,0.18),_rgba(15,23,42,0))] blur-3xl" />
      </div>

      {isAuthed ? (
        <>
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 z-30">
            <div className="mx-auto max-w-md px-4 pt-4 md:max-w-3xl">
              <div className="glass-card flex items-center justify-between rounded-[28px] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/70 bg-[linear-gradient(135deg,_#0b1424,_#1f3a60)] text-white font-display text-xl shadow-[0_12px_26px_rgba(15,23,42,0.28)]">
                    HP
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-display text-2xl uppercase leading-none">
                        HockeyPikk
                      </div>
                      <span className="flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink)] shadow-[0_6px_14px_rgba(15,23,42,0.12)]">
                        <span className="grid h-6 w-6 place-items-center rounded-full border border-white/70 bg-[linear-gradient(135deg,_rgba(15,23,42,0.08),_rgba(42,157,244,0.16))] text-[9px] font-semibold text-[color:var(--ink)]">
                          {initials || "HP"}
                        </span>
                        {displayName}
                      </span>
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
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold shadow-[0_8px_18px_rgba(15,23,42,0.12)] ${boardStatusStyles}`}
                  >
                    {boardStatusLabel}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="relative z-10 mx-auto max-w-md space-y-4 px-4 pb-28 pt-32 md:max-w-3xl">
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
              <Route path="/history" element={<History session={session} />} />
              <Route
                path="/profile"
                element={
                  <Profile
                    session={session}
                    onProfileUpdate={handleProfileUpdate}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </main>

          {/* Bottom Nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 pb-4">
            <div className="mx-auto max-w-md px-4 md:max-w-3xl">
              <div className="grid grid-cols-4 gap-2 rounded-[26px] border border-white/70 bg-white/85 p-2.5 shadow-[0_20px_45px_rgba(15,23,42,0.16)] backdrop-blur">
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
                        "relative flex flex-col items-center gap-1.5 rounded-2xl px-2.5 py-2 transition",
                        isActive
                          ? "bg-[linear-gradient(135deg,_rgba(15,23,42,0.08),_rgba(42,157,244,0.12))] text-[color:var(--ink)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
                          : "text-[color:var(--muted)] hover:text-[color:var(--ink)]",
                      ].join(" ")}
                    >
                      {notificationCount > 0 ? (
                        <span className="pointer-events-none absolute -top-2 right-1 flex items-center gap-1">
                          {showCommentBubble ? (
                            <span className="grid h-4 w-4 place-items-center rounded-full border border-white/70 bg-[linear-gradient(135deg,_#22c55e,_#16a34a)] text-white shadow-[0_4px_10px_rgba(34,197,94,0.35)]">
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-2.5 w-2.5"
                                fill="currentColor"
                              >
                                <path d="M7.5 6.5h9A3 3 0 0 1 19.5 9.5v4a3 3 0 0 1-3 3H11l-3 2.2V16.5H7.5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z" />
                              </svg>
                            </span>
                          ) : null}
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[linear-gradient(135deg,_#f97316,_#ef4444)] px-1 text-[9px] font-semibold leading-none tracking-normal text-white shadow-[0_6px_14px_rgba(244,68,79,0.35)]">
                            {notificationCount > 99 ? "99+" : notificationCount}
                          </span>
                        </span>
                      ) : null}
                      <span className="text-[10px] uppercase tracking-[0.22em]">
                        {t.label}
                      </span>
                      <span
                        className={[
                          "h-1.5 w-6 rounded-full transition",
                          isActive
                            ? "bg-[linear-gradient(90deg,_rgba(42,157,244,0.9),_rgba(240,78,78,0.9))]"
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
