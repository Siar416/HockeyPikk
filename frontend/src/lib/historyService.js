const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchHistory = async ({ accessToken, limit = 10 }) => {
  const response = await fetch(
    `${API_BASE}/history?limit=${encodeURIComponent(limit)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};
