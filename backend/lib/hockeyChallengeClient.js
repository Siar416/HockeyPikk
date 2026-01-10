const API_BASE =
  process.env.HCH_API_BASE || "https://api.hockeychallengehelper.com/api";
const CACHE_TTL_MS = Number(process.env.HCH_CACHE_TTL_MS || 300000);

const requestHeaders = {
  "User-Agent": "Mozilla/5.0",
  Origin: "https://hockeychallengehelper.com",
  Referer: "https://hockeychallengehelper.com/",
  Accept: "application/json",
};

let cachedPicks = null;
let cachedAt = 0;

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

const getPicks = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedPicks && now - cachedAt < CACHE_TTL_MS) {
    return cachedPicks;
  }

  const data = await fetchJson(`${API_BASE}/picks`);
  cachedPicks = data;
  cachedAt = now;
  return data;
};

module.exports = { getPicks };
