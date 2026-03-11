# HiBid Bargain Radar Spec

## Product Goal

Single-user auction radar for Ontario HiBid that tracks Amazon-derived product targets.

## Core Flow

1. User adds an Amazon product URL and keywords in the frontend.
2. App resolves product reference price from Amazon automatically.
3. If auto price parsing fails, user can provide manual reference price.
4. Watch and keywords are stored in SQLite.
5. Every hour, the scanner crawls `ontario.hibid.com` for watch keywords.
6. Matching lot is a candidate when:
   - lot ends in <= 60 minutes,
   - lot bid is < 70% of watch reference price,
   - watch reference price is >= configured big-ticket threshold.
7. App sends notification to user ntfy instance using escalation mode.

## Escalation Mode

- Notify on first qualification (`initial`).
- Notify again on significant improvement (`price_drop`, default 10% lower than last notified bid).
- Notify again at urgency threshold (`time_critical`, <= 15 minutes remaining).
- Max 3 notifications for the same watch/lot pair.

## Runtime Shape

- One Bun process:
  - `Bun.serve` web server for frontend and API,
  - in-process hourly scheduler,
  - SQLite persistence (`bun:sqlite`).
