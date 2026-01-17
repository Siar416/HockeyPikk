// src/components/GroupPickCard.jsx
import { useEffect, useState } from "react";

const buildTeamLogoUrl = (teamCode) => {
  if (!teamCode || teamCode === "TBD") return "";
  return `https://assets.nhle.com/logos/nhl/svg/${teamCode}_dark.svg`;
};

const TeamBadge = ({ teamCode, teamName }) => {
  const normalizedCode = (teamCode || "").toUpperCase();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = buildTeamLogoUrl(normalizedCode);
  const showLogo = logoUrl && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [normalizedCode]);

  return (
    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(228,238,255,0.9))] shadow-[0_10px_20px_rgba(15,23,42,0.14)]">
      {showLogo ? (
        <img
          src={logoUrl}
          alt={teamName ? `${teamName} logo` : `${normalizedCode} logo`}
          className="h-8 w-8 object-contain"
          onError={() => setLogoFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--ink)]">
          {normalizedCode || "TBD"}
        </span>
      )}
    </div>
  );
};

const formatLineLabel = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^\d+$/.test(upper)) return `L${upper}`;
  if (upper.startsWith("L") || upper.startsWith("F") || upper.startsWith("D")) {
    return upper;
  }
  return `L${upper}`;
};

const formatPpLabel = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^\d+$/.test(upper)) return `PP${upper}`;
  if (upper.startsWith("PP")) return upper;
  return `PP${upper}`;
};

const formatPct = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${(num * 100).toFixed(1)}%`;
};

const formatCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const formatRate = (value, games) => {
  const num = Number(value);
  const gp = Number(games);
  if (!Number.isFinite(num) || !Number.isFinite(gp) || gp <= 0) return null;
  return (num / gp).toFixed(2);
};

export default function GroupPickCard({
  groupLabel,
  playerName,
  teamCode,
  teamName,
  opponentTeamCode,
  opponentTeamName,
  position,
  line,
  ppLine,
  seasonGamesPlayed,
  seasonGoals,
  seasonAssists,
  seasonPoints,
  seasonShots,
  seasonPowerPlayPoints,
  seasonShootingPct,
  seasonAvgToi,
  seasonFaceoffPct,
  last5Games,
  last5Goals,
  last5Points,
  last5Shots,
  isLocked,
  onSuggest,
  onChange,
}) {
  const statusLabel = isLocked ? "Locked" : "Draft";
  const matchupTeam = teamCode || teamName || "";
  const opponentLabel = opponentTeamCode || opponentTeamName || "";
  const matchupLabel =
    matchupTeam && opponentLabel ? `${matchupTeam} vs ${opponentLabel}` : "";
  const statPills = [];
  if (position) statPills.push(`Pos ${String(position).toUpperCase()}`);
  const lineLabel = formatLineLabel(line);
  if (lineLabel) statPills.push(lineLabel);
  const ppLabel = formatPpLabel(ppLine);
  if (ppLabel) statPills.push(ppLabel);
  const gpValue = formatCount(seasonGamesPlayed);
  const pointsValue = formatCount(seasonPoints);
  const goalsValue = formatCount(seasonGoals);
  const assistsValue = formatCount(seasonAssists);
  const pointsRate = formatRate(seasonPoints, seasonGamesPlayed);
  const shotsRate = formatRate(seasonShots, seasonGamesPlayed);
  const ppRate = formatRate(seasonPowerPlayPoints, seasonGamesPlayed);
  const seasonSummaryParts = [];

  if (pointsValue) {
    const detailParts = [];
    if (goalsValue) detailParts.push(`${goalsValue}G`);
    if (assistsValue) detailParts.push(`${assistsValue}A`);
    const detailLabel = detailParts.length ? ` (${detailParts.join(" ")})` : "";
    seasonSummaryParts.push(`${pointsValue} PTS${detailLabel}`);
  }
  if (gpValue) {
    seasonSummaryParts.push(`GP ${gpValue}`);
  }

  const seasonSummary = seasonSummaryParts.join(" • ");
  const seasonStats = [
    {
      label: pointsRate ? "PTS/GP" : "PTS",
      value: pointsRate || pointsValue,
    },
    {
      label: shotsRate ? "SOG/GP" : "SOG",
      value: shotsRate || formatCount(seasonShots),
    },
    {
      label: ppRate ? "PP PTS/GP" : "PP PTS",
      value: ppRate || formatCount(seasonPowerPlayPoints),
    },
    { label: "S%", value: formatPct(seasonShootingPct) },
    { label: "TOI", value: seasonAvgToi || null },
    { label: "FO%", value: formatPct(seasonFaceoffPct) },
  ].filter((stat) => stat.value !== null);
  const formStats = [
    { label: "L5 PTS", value: formatCount(last5Points) },
    { label: "L5 G", value: formatCount(last5Goals) },
    { label: "L5 SOG", value: formatCount(last5Shots) },
  ].filter((stat) => stat.value !== null);
  const hasSeasonStats = seasonStats.length > 0 || Boolean(seasonSummary);
  const hasFormStats =
    formStats.length > 0 && (last5Games == null || last5Games >= 1);
  const statusStyles = isLocked
    ? "border border-[rgba(240,78,78,0.3)] bg-[linear-gradient(135deg,_rgba(240,78,78,0.16),_rgba(255,180,120,0.2))] text-[color:var(--accent)]"
    : "border border-[rgba(42,157,244,0.28)] bg-[linear-gradient(135deg,_rgba(42,157,244,0.16),_rgba(129,212,250,0.2))] text-[color:var(--ink)]";

  return (
    <div className="rounded-3xl border border-white/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(242,247,255,0.78))] p-5 shadow-[0_18px_36px_rgba(15,23,42,0.12)] backdrop-blur">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted)] shadow-sm">
            {groupLabel}
          </span>
          {/* TODO: show group rules or context */}
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.3em] shadow-[0_6px_16px_rgba(15,23,42,0.12)] ${statusStyles}`}
        >
          {statusLabel}
          {/* TODO: show lock time when locked */}
        </span>
      </div>

      {/* Selected player label */}
      <div className="mt-3 text-[10px] uppercase tracking-[0.35em] text-[color:var(--muted)]">
        Selected Player
      </div>

      {/* Selected player row */}
      <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(225,238,255,0.85))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <div className="flex items-center gap-3">
          <TeamBadge teamCode={teamCode} teamName={teamName} />

          <div>
            <div className="text-base font-semibold text-[color:var(--ink)]">
              {playerName}
              {/* TODO: handle empty state when no player selected */}
            </div>
            <div className="text-sm text-[color:var(--muted)]">{teamName}</div>
            {matchupLabel ? (
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Matchup:{" "}
                <span className="font-semibold text-[color:var(--ink)]">
                  {matchupLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {onChange ? (
          <button
            type="button"
            onClick={onChange}
            disabled={isLocked}
            className="rounded-full bg-[linear-gradient(135deg,_#0b1424,_#1f3a60)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Picked
          </button>
        ) : (
          <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] shadow-sm">
            Picked
          </span>
        )}
      </div>

      {statPills.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-[color:var(--muted)]">
          {statPills.map((stat) => (
            <span
              key={stat}
              className="rounded-full border border-white/70 bg-white/80 px-2 py-1 shadow-sm"
            >
              {stat}
            </span>
          ))}
        </div>
      ) : null}

      {hasSeasonStats ? (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--muted)]">
            Season snapshot
          </div>
          {seasonSummary ? (
            <div className="mt-2 text-xs text-[color:var(--muted)]">
              {seasonSummary}
            </div>
          ) : null}
          {seasonStats.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {seasonStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm"
                >
                  <div className="text-[9px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                    {stat.label}
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasFormStats ? (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--muted)]">
            Last 5
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {formStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-2 rounded-full border border-[rgba(16,185,129,0.28)] bg-[rgba(16,185,129,0.08)] px-3 py-1.5 text-xs shadow-sm"
              >
                <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  {stat.label}
                </span>
                <span className="font-semibold text-[color:var(--ink)]">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {onSuggest ? (
        <div className="flex items-center justify-end pt-3 text-xs text-[color:var(--muted)]">
          <button
            type="button"
            onClick={onSuggest}
            disabled={isLocked}
            className="rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suggest changes
          </button>
        </div>
      ) : null}
    </div>
  );
}
