const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchSuggestions = async ({ accessToken, boardId }) => {
  const query = boardId ? `?boardId=${encodeURIComponent(boardId)}` : "";
  const response = await fetch(`${API_BASE}/suggestions${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const createSuggestion = async ({
  accessToken,
  boardId,
  boardGroupId,
  playerId,
  reason,
}) => {
  const response = await fetch(`${API_BASE}/suggestions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ boardId, boardGroupId, playerId, reason }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const updateSuggestion = async ({
  accessToken,
  suggestionId,
  status,
}) => {
  const response = await fetch(`${API_BASE}/suggestions/${suggestionId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};
