const { createSupabaseClient } = require("../lib/supabaseClient");

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token." });
  }

  const authClient = createSupabaseClient();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid auth token." });
  }

  req.user = data.user;
  req.accessToken = token;
  return next();
};
