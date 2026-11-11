const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
require("./models");

const app = express();
// Behind one reverse proxy (Render): use the client IP from X-Forwarded-For so rate limits are per user
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.set("query parser", "simple"); // query values are plain strings, so they cannot smuggle in Mongo operators
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(",") } : undefined));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// Throttle login / code / password endpoints per IP
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT_PER_15_MIN) || 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  })
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/activity", require("./routes/activity"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join("; ") });
  }
  if (err.code === 11000) return res.status(409).json({ error: "Duplicate value" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });
  if (err.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({ error: tooBig ? `File is too large (max ${Number(process.env.MAX_UPLOAD_MB) || 10} MB)` : err.message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Server error" : err.message });
});

module.exports = app;
