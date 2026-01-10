const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const signUp = async ({ email, password, displayName }) => {
  const response = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Sign up failed.") };
  }

  return { data: payload, error: null };
};

export const signIn = async ({ email, password }) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Sign in failed.") };
  }

  return { data: payload, error: null };
};

export const getMe = async ({ accessToken }) => {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Auth failed.") };
  }

  return { data: payload, error: null };
};
