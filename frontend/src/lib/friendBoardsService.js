const API_BASE = "/api";

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const fetchFriendBoard = async ({
  accessToken,
  friendId,
  dateKey,
}) => {
  if (!friendId) {
    return { data: null, error: new Error("Friend is required.") };
  }

  const query = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
  const response = await fetch(
    `${API_BASE}/friends/${friendId}/board${query}`,
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
