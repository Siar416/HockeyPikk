const NHL_API_BASE =
  process.env.NHL_API_BASE || "https://api-web.nhle.com/v1";
const CACHE_TTL_MS = Number(process.env.NHL_CACHE_TTL_MS || 3600000);

const requestHeaders = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
};

const statsCache = new Map();

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

module.exports = { getPlayerStats };
