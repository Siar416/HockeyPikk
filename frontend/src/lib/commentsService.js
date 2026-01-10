const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchComments = async ({ accessToken, boardId }) => {
  const query = boardId ? `?boardId=${encodeURIComponent(boardId)}` : "";
  const response = await fetch(`${API_BASE}/comments${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const createComment = async ({ accessToken, boardId, body }) => {
  const response = await fetch(`${API_BASE}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ boardId, body }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};
