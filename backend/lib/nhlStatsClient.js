const NHL_API_BASE =
  process.env.NHL_API_BASE || "https://api-web.nhle.com/v1";
const CACHE_TTL_MS = Number(process.env.NHL_CACHE_TTL_MS || 3600000);

const requestHeaders = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

const statsCache = new Map();
const gameLogCache = new Map();
const teamRecordCache = new Map();
const scheduleCache = new Map();

const ensureFetch = () => {
  if (typeof fetch !== "function") {
    throw new Error("Node.js 18+ required (fetch is missing).");
  }
};

const fetchJson = async (url) => {
  ensureFetch();
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upstream error ${response.status}: ${body}`);
  }
  return response.json();
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toInt = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
};

const getSeasonTotalsRow = (seasonTotals, seasonId) => {
  if (!Array.isArray(seasonTotals) || !seasonTotals.length) return null;
  if (!seasonId) return null;
  return (
    seasonTotals.find(
      (row) => row.leagueAbbrev === "NHL" && row.gameTypeId === 2 && row.season === seasonId
    ) || null
  );
};

const buildStatsFromLanding = (landing) => {
  if (!landing || typeof landing !== "object") return null;

  const seasonId = landing.featuredStats?.season || null;
  const seasonStats = landing.featuredStats?.regularSeason?.subSeason || {};
  const seasonTotals = getSeasonTotalsRow(landing.seasonTotals, seasonId);
  const last5 = Array.isArray(landing.last5Games) ? landing.last5Games : [];

  let last5Goals = 0;
  let last5Points = 0;
  let last5Shots = 0;

  last5.forEach((game) => {
    last5Goals += toInt(game?.goals) || 0;
    last5Points += toInt(game?.points) || 0;
    last5Shots += toInt(game?.shots) || 0;
  });

  return {
    seasonGamesPlayed: toInt(seasonStats?.gamesPlayed),
    seasonGoals: toInt(seasonStats?.goals),
    seasonAssists: toInt(seasonStats?.assists),
    seasonPoints: toInt(seasonStats?.points),
    seasonShots: toInt(seasonStats?.shots),
    seasonPowerPlayPoints: toInt(seasonStats?.powerPlayPoints),
    seasonShootingPct: toNumber(seasonStats?.shootingPctg),
    seasonAvgToi: seasonTotals?.avgToi || null,
    seasonFaceoffPct: toNumber(seasonTotals?.faceoffWinningPctg),
    last5Games: toInt(last5.length),
    last5Goals,
    last5Points,
    last5Shots,
  };
};

const getPlayerGameLog = async (playerId, seasonId, gameTypeId = 2) => {
  const normalizedId = Number(playerId);
  if (!Number.isFinite(normalizedId)) return null;
  if (!seasonId) return null;

  const cacheKey = `${normalizedId}-${seasonId}-${gameTypeId}`;
  const cached = gameLogCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const payload = await fetchJson(
      `${NHL_API_BASE}/player/${normalizedId}/game-log/${seasonId}/${gameTypeId}`
    );
    const data = {
      gameLog: Array.isArray(payload?.gameLog) ? payload.gameLog : [],
    };
    gameLogCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return data;
  } catch {
    return null;
  }
};

const getPlayerGoalsForDate = async ({ playerId, dateKey, seasonId }) => {
  if (!dateKey || !seasonId) return null;

  let fetchedAny = false;

  const findGoals = async (gameTypeId) => {
    const log = await getPlayerGameLog(playerId, seasonId, gameTypeId);
    if (!log) return null;
    fetchedAny = true;
    const entry = (log.gameLog || []).find(
      (game) => game?.gameDate === dateKey
    );
    if (!entry) return null;
    const goals = toInt(entry.goals) || 0;
    return { goals, played: true, gameTypeId };
  };

  const regular = await findGoals(2);
  if (regular) return regular;

  const playoffs = await findGoals(3);
  if (playoffs) return playoffs;

  if (!fetchedAny) return null;

  return { goals: 0, played: false, gameTypeId: null };
};

const getTeamRecordVsOpponent = async ({ teamCode, opponentCode, seasonId }) => {
  const team = (teamCode || "").toUpperCase();
  const opponent = (opponentCode || "").toUpperCase();
  if (!team || !opponent || !seasonId) return null;

  const cacheKey = `${team}-${opponent}-${seasonId}`;
  const cached = teamRecordCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const payload = await fetchJson(
      `${NHL_API_BASE}/club-schedule-season/${team}/${seasonId}`
    );
    const games = Array.isArray(payload?.games) ? payload.games : [];
    let wins = 0;
    let losses = 0;
    let otLosses = 0;

    games.forEach((game) => {
      if (!game || game.gameType !== 2) return;
      const state = game.gameState;
      if (state !== "FINAL" && state !== "OFF") return;
      const home = game.homeTeam?.abbrev;
      const away = game.awayTeam?.abbrev;
      if (home !== team && away !== team) return;
      const gameOpponent = home === team ? away : home;
      if (gameOpponent !== opponent) return;

      const teamScore =
        home === team ? game.homeTeam?.score : game.awayTeam?.score;
      const oppScore =
        home === team ? game.awayTeam?.score : game.homeTeam?.score;
      if (!Number.isFinite(teamScore) || !Number.isFinite(oppScore)) return;

      if (teamScore > oppScore) {
        wins += 1;
        return;
      }

      if (teamScore < oppScore) {
        const lastPeriod = game.gameOutcome?.lastPeriodType;
        if (lastPeriod === "OT" || lastPeriod === "SO") {
          otLosses += 1;
        } else {
          losses += 1;
        }
      }
    });

    const record = { wins, losses, otLosses };
    teamRecordCache.set(cacheKey, {
      data: record,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return record;
  } catch {
    return null;
  }
};

const getFirstGameStartTime = async (dateKey) => {
  if (!dateKey) return null;
  const cacheKey = `schedule-${dateKey}`;
  const cached = scheduleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const payload = await fetchJson(`${NHL_API_BASE}/schedule/${dateKey}`);
    const days = Array.isArray(payload?.gameWeek) ? payload.gameWeek : [];
    const day = days.find((entry) => entry?.date === dateKey);
    const games = Array.isArray(day?.games) ? day.games : [];

    let earliest = null;
    games.forEach((game) => {
      if (!game || (game.gameType !== 2 && game.gameType !== 3)) return;
      const start = game.startTimeUTC;
      if (!start) return;
      const time = Date.parse(start);
      if (!Number.isFinite(time)) return;
      if (!earliest || time < earliest.time) {
        earliest = { time, value: start };
      }
    });

    const result = earliest ? earliest.value : null;
    scheduleCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  } catch {
    return null;
  }
};

const getPlayerStats = async (playerId) => {
  const normalizedId = Number(playerId);
  if (!Number.isFinite(normalizedId)) return null;

  const cached = statsCache.get(normalizedId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const landing = await fetchJson(`${NHL_API_BASE}/player/${normalizedId}/landing`);
    const stats = buildStatsFromLanding(landing);
    statsCache.set(normalizedId, {
      data: stats,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return stats;
  } catch {
    return null;
  }
};

module.exports = {
  getPlayerStats,
  getPlayerGoalsForDate,
  getTeamRecordVsOpponent,
  getFirstGameStartTime,
};
