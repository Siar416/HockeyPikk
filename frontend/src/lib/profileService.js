const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchProfile = async ({ accessToken }) => {
  const response = await fetch(`${API_BASE}/profile/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const updateProfile = async ({ accessToken, displayName }) => {
  const response = await fetch(`${API_BASE}/profile/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName,
    }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};
