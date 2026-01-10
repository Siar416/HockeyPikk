const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchPickOptions = async ({ accessToken }) => {
  const response = await fetch(`${API_BASE}/picks/options`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const savePicks = async ({ accessToken, boardId, selections }) => {
  const response = await fetch(`${API_BASE}/picks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ boardId, selections }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Save failed.") };
  }

  return { data: payload, error: null };
};
