# MONKEYMAN2_098 GAMES

A full-stack browser gaming portal built with Node.js, Express, SQLite and vanilla JavaScript.

## Features

- Responsive black and electric-blue gaming interface
- Search and category filtering
- 52 browser mini-games, including 12 original clicker/idle-style games
- Registration, login and logout
- Password hashing with bcrypt
- Server-side sessions stored in SQLite
- Per-account game progress saving
- Basic security headers and login rate limiting

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Extract the project ZIP.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Set `SESSION_SECRET` in `.env` to a long random secret (at least 32 characters).
6. Start the server:

   ```bash
   npm start
   ```

7. Open http://localhost:3000

For development with automatic server restart:

```bash
npm run dev
```

## Account rules

- Usernames: 3–20 letters, numbers or underscores.
- Passwords: 10–72 characters.
- Passwords are hashed; raw passwords are never stored.
- The site does not ask for email, real name, date of birth or payment details.

## Project structure

```text
MONKEYMAN2_098_GAMES/
├── public/
│   ├── app.js
│   ├── games.json
│   ├── index.html
│   └── styles.css
├── data/                 # created automatically; do not commit
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/games` | Game catalog |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current session |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/progress` | Load saved progress |
| PUT | `/api/progress/:gameId` | Save game progress |

## Testing checklist

1. Run `npm install`, then `npm start`.
2. Visit `/api/health`; confirm it returns `{"status":"ok",...}`.
3. Open the home page; confirm the game catalog loads.
4. Search for "cookie"; confirm the clicker games are filtered.
5. Select the Clicker category; launch a clicker and test tapping and upgrades.
6. Play a reaction, memory, quiz and tic-tac-toe game.
7. Register a test account with a unique username and a strong password.
8. Play a game, close it, refresh and confirm saved progress loads after signing in again.
9. Sign out and confirm the account button returns to "Sign in".
10. Test the site at mobile width and desktop width.

## Before public deployment

This is a working starter project, not a finished production service. Before making it public:

- Use HTTPS and set `NODE_ENV=production`.
- Use a strong, private `SESSION_SECRET`.
- Set secure cookie options behind your HTTPS deployment.
- Add CSRF protection for state-changing routes.
- Add account deletion and a clear privacy notice.
- Configure backups, monitoring and database migrations.
- Test session handling and all game flows.
- Review hosting provider terms and applicable privacy requirements.

No payment, advertising, public chat, direct messaging or public user-generated content is included in this starter.
