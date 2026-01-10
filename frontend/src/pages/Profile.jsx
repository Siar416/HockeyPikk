import { useEffect, useState } from "react";
import { fetchProfile } from "../lib/profileService";

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ wins: 0, streak: 0, accuracy: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setStats({ wins: 0, streak: 0, accuracy: 0 });
      setLoadError("");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError("");

      const { data, error } = await fetchProfile({ accessToken });

      if (!isMounted) return;

      if (error) {
        setLoadError(error.message);
        setIsLoading(false);
        return;
      }

      setProfile(data?.profile ?? null);
      setStats(data?.stats ?? { wins: 0, streak: 0, accuracy: 0 });
      setIsLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const fallbackName =
    session?.user?.user_metadata?.display_name ||
    session?.user?.email?.split("@")[0] ||
    "Guest";
  const fallbackHandle = session?.user?.email
    ? `@${session.user.email.split("@")[0]}`
    : "@hockeyfan";

  const displayName = profile?.displayName || fallbackName;
  const handle = profile?.handle ? `@${profile.handle}` : fallbackHandle;

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
                {displayName}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                {handle}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--ink)] shadow-sm hover:bg-white"
          >
            Edit
          </button>
        </div>
        {accessToken && isLoading ? (
          <div className="mt-3 text-xs text-[color:var(--muted)]">
            Loading profile...
          </div>
        ) : null}
        {accessToken && loadError ? (
          <div className="mt-3 rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {loadError}
          </div>
        ) : null}
      </section>

      <section className="glass-card rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Stats</h2>
          <span className="text-xs text-[color:var(--muted)]">Season</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Wins", value: stats.wins },
            { label: "Streak", value: stats.streak },
            { label: "Accuracy", value: `${stats.accuracy}%` },
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
      </section>
    </div>
  );
}
