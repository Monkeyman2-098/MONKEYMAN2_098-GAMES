"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  console.error("SESSION_SECRET is missing or too short. Copy .env.example to .env and set a random secret of at least 32 characters.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "games.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const SQLiteStore = SQLiteStoreFactory(session);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "32kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false });
const games = require("./public/games.json");

function safeUser(user) {
  return { id: user.id, username: user.username, createdAt: user.created_at };
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Please sign in first." });
  next();
}
function validUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
function validPassword(password) {
  return typeof password === "string" && password.length >= 10 && password.length <= 72;
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", name: "MONKEYMAN2_098 GAMES", version: "1.0.0" }));
app.get("/api/games", (_req, res) => res.json(games));

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!validUsername(username)) return res.status(400).json({ error: "Username must be 3–20 characters using letters, numbers or underscores." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be 10–72 characters." });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, hash);
    req.session.userId = Number(result.lastInsertRowid);
    const user = db.prepare("SELECT id, username, created_at FROM users WHERE id = ?").get(req.session.userId);
    res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That username is already taken." });
    console.error(error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "Enter your username and password." });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Incorrect username or password." });
  req.session.userId = user.id;
  res.json({ user: safeUser(user) });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT id, username, created_at FROM users WHERE id = ?").get(req.session.userId);
  res.json({ user: user ? safeUser(user) : null });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Could not sign out." });
    res.clearCookie("connect.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    res.json({ ok: true });
  });
});

app.get("/api/progress", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT game_id AS gameId, score, state_json AS state, updated_at AS updatedAt FROM progress WHERE user_id = ?").all(req.session.userId);
  res.json(rows.map(row => ({ ...row, state: JSON.parse(row.state) })));
});

app.put("/api/progress/:gameId", requireAuth, (req, res) => {
  const gameId = Number(req.params.gameId);
  const game = games.find(g => g.id === gameId);
  const score = Number(req.body?.score);
  const state = req.body?.state;
  if (!game || !Number.isSafeInteger(score) || score < 0 || score > 1_000_000_000 || !state || typeof state !== "object" || Array.isArray(state)) {
    return res.status(400).json({ error: "Invalid progress data." });
  }
  const stateJson = JSON.stringify(state);
  if (stateJson.length > 8000) return res.status(400).json({ error: "Progress data is too large." });
  db.prepare(`
    INSERT INTO progress (user_id, game_id, score, state_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, game_id) DO UPDATE SET
      score = MAX(progress.score, excluded.score),
      state_json = excluded.state_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.session.userId, gameId, score, stateJson);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`MONKEYMAN2_098 GAMES running at http://localhost:${PORT}`));
