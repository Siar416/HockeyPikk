const express = require("express");
const requireSupabase = require("../middleware/requireSupabase");
const requireAuth = require("../middleware/requireAuth");
const { createSupabaseClient } = require("../lib/supabaseClient");

const router = express.Router();

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;
const appUrl = isNonEmptyString(process.env.APP_URL)
  ? process.env.APP_URL.trim()
  : isNonEmptyString(process.env.CORS_ORIGIN)
    ? process.env.CORS_ORIGIN.trim()
    : "http://localhost:5173";

router.post("/signup", requireSupabase, async (req, res) => {
  const { email, password, displayName } = req.body ?? {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const supabase = createSupabaseClient();
  const userData = {};
  if (isNonEmptyString(displayName)) {
    userData.display_name = displayName.trim();
  }

  const signUpOptions = {};
  if (Object.keys(userData).length) {
    signUpOptions.data = userData;
  }
  if (isNonEmptyString(appUrl)) {
    signUpOptions.emailRedirectTo = appUrl;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: Object.keys(signUpOptions).length ? signUpOptions : undefined,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const needsConfirmation = Boolean(data?.user && !data?.session);

  return res.json({
    session: data?.session ?? null,
    user: data?.user ?? null,
    notice: needsConfirmation
      ? "Check your email to confirm your account."
      : "",
  });
});

router.post("/login", requireSupabase, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.json({
    session: data?.session ?? null,
    user: data?.user ?? null,
  });
});

router.get("/me", requireSupabase, requireAuth, (req, res) => {
  return res.json({ user: req.user ?? null });
});

module.exports = router;
