const API_BASE = "/api";

const buildHeaders = (accessToken) => {
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
};

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const getTodayDateKey = (today = new Date()) =>
  today.toLocaleDateString("en-CA");

export const fetchTodayBoard = async ({ accessToken, dateKey }) => {
  const query = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  const response = await fetch(`${API_BASE}/boards/today${query}`, {
    headers: buildHeaders(accessToken),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      data: null,
      error: new Error(payload?.error || "Request failed."),
    };
  }

  return { data: payload, error: null };
};

export const lockBoard = async ({ accessToken, boardId }) => {
  const response = await fetch(`${API_BASE}/boards/${boardId}/lock`, {
    method: "POST",
    headers: buildHeaders(accessToken),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return {
      data: null,
      error: new Error(payload?.error || "Request failed."),
    };
  }

  return { data: payload, error: null };
};
