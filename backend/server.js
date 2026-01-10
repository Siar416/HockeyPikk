require("dotenv").config();

const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/health");
const boardRoutes = require("./routes/boards");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const historyRoutes = require("./routes/history");
const friendsRoutes = require("./routes/friends");
const picksRoutes = require("./routes/picks");
const commentsRoutes = require("./routes/comments");
const suggestionsRoutes = require("./routes/suggestions");

const app = express();
const port = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/picks", picksRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/suggestions", suggestionsRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
