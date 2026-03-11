import { useEffect, useState } from "react";
import { fetchProfile, updateProfile } from "../lib/profileService";

export default function Profile({ session, onProfileUpdate, onAuthExit, isGuest }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ wins: 0, streak: 0, accuracy: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState({ displayName: "" });
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const accessToken = session?.access_token;
  const canEdit = Boolean(accessToken);
  const authActionLabel = isGuest ? "Sign in" : "Log out";

  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setStats({ wins: 0, streak: 0, accuracy: 0 });
      setLoadError("");
      setIsLoading(false);
      setIsEditing(false);
      setFormValues({ displayName: "" });
      setSaveError("");
      setIsSaving(false);
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
  const displayName = profile?.displayName || fallbackName;
  const email = profile?.email || session?.user?.email || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    if (!isEditing) {
      setFormValues({
        displayName,
      });
    }
  }, [displayName, isEditing]);

  const handleEditToggle = () => {
    setIsEditing(true);
    setSaveError("");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError("");
    setFormValues({
      displayName,
    });
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    if (!accessToken || isSaving) return;
    setIsSaving(true);
    setSaveError("");

    const trimmedName = formValues.displayName.trim();
    if (!trimmedName) {
      setSaveError("Display name is required.");
      setIsSaving(false);
      return;
    }

    const { data, error } = await updateProfile({
      accessToken,
      displayName: trimmedName,
    });

    if (error) {
      setSaveError(error.message);
      setIsSaving(false);
      return;
    }

    setProfile(data?.profile ?? null);
    onProfileUpdate?.(trimmedName);
    setIsEditing(false);
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-3xl p-5 md:p-6">
        <p className="kicker">Account</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,_#13356b,_#1f66ff)] text-sm font-semibold text-white">
              {initials || "HP"}
            </div>
            <div>
              <div className="font-display text-3xl leading-none">
                {displayName}
              </div>
              {email ? (
                <div className="text-xs text-[color:var(--muted)]">
                  {email}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            {isEditing ? (
              <>
                <button
                  type="submit"
                  form="profile-edit"
                  disabled={isSaving}
                  className="btn-primary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
                >
                  Cancel
                </button>
              </>
            ) : canEdit ? (
              <>
                <button
                  type="button"
                  onClick={handleEditToggle}
                  className="btn-secondary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onAuthExit?.()}
                  className="btn-secondary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
                >
                  {authActionLabel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onAuthExit?.()}
                className="btn-secondary rounded-full px-4 py-2 text-xs tracking-[0.08em]"
              >
                {authActionLabel}
              </button>
            )}
          </div>
        </div>
        {!accessToken ? (
          <div className="mt-3 rounded-2xl border border-[rgba(42,157,244,0.2)] bg-[rgba(42,157,244,0.08)] px-3 py-2 text-xs text-[color:var(--ink)]">
            You&apos;re viewing as a guest. Sign in to save your profile and
            history.
          </div>
        ) : null}
        {isEditing ? (
          <form id="profile-edit" onSubmit={handleProfileSave} className="mt-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                Display name
              </label>
              <input
                value={formValues.displayName}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    displayName: event.target.value,
                  }))
                }
                className="field-input"
                placeholder="Your name"
                disabled={isSaving}
              />
            </div>
          </form>
        ) : null}
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
        {saveError ? (
          <div className="mt-3 rounded-2xl border border-[rgba(244,68,79,0.3)] bg-[rgba(244,68,79,0.1)] px-3 py-2 text-xs text-[color:var(--accent)]">
            {saveError}
          </div>
        ) : null}
      </section>

      <section className="glass-card rounded-3xl p-5 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl leading-none">Stats</h2>
          <span className="text-xs text-[color:var(--muted)]">Season</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Wins", value: stats.wins },
            { label: "Streak", value: stats.streak },
            { label: "Accuracy", value: `${stats.accuracy}%` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="surface-card rounded-2xl px-3 py-4 text-center"
            >
              <div className="font-display text-3xl leading-none">
                {stat.value}
              </div>
              <div className="text-xs font-semibold tracking-[0.08em] text-[color:var(--muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
