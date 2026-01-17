const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchFriends = async ({ accessToken }) => {
  const response = await fetch(`${API_BASE}/friends`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const sendFriendRequest = async ({ accessToken, email }) => {
  const response = await fetch(`${API_BASE}/friends/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return { data: null, error: new Error(payload?.error || "Request failed.") };
  }

  return { data: payload, error: null };
};

export const respondToFriendRequest = async ({
  accessToken,
  requestId,
  status,
}) => {
  const response = await fetch(`${API_BASE}/friends/requests/${requestId}`, {
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
