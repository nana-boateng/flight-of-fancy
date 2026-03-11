# HiBid Bargain Radar

Ground-up rewrite focused on useful product tracking:

- Frontend lets you add Amazon product links and watch keywords.
- Watches are stored in SQLite.
- Hourly job crawls `ontario.hibid.com` for keyword matches.
- Matches qualify when:
  - lot ends within 60 minutes,
  - current bid is below 70% of watch reference price,
  - watch reference price is a big-ticket value (default >= $100).
- Notifications are sent to your ntfy instance with escalation logic.

## Run

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

By default the server binds to `127.0.0.1` for local-only access.

## Environment

Copy `.env.example` to `.env` and adjust as needed.

## API (high-level)

- `GET /api/dashboard` - watches, recent matches, last run, ntfy settings
- `POST /api/watches` - add watch using Amazon URL + keywords
- `PATCH /api/watches/:id` - update title, active, keywords, or reference price
- `DELETE /api/watches/:id` - remove watch
- `GET /api/settings/ntfy` / `PUT /api/settings/ntfy` - ntfy config
- `POST /api/run-now` - trigger scan immediately
