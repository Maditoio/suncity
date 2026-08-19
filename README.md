# Inclusive Lock Monitor

Admin app for a Sera4 lock: pull access history, listen for open/close webhooks, and alert when one person opens the door more times than allowed in a short window.

Default first admin is created in PostgreSQL from `ADMIN_USERNAME` / `ADMIN_PASSWORD` (defaults: `admin` / `lockwatch`) only when the `admins` table is empty. Sign-in always checks the database. Change the password in Settings after the first login.

## Run locally

1. Create a PostgreSQL database (local Postgres, [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)).
2. Copy `.env.example` to `.env.local` and set:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
ADMIN_USERNAME=admin
ADMIN_PASSWORD=lockwatch
APP_PUBLIC_URL=http://localhost:3000
```

For a local database without TLS, use `sslmode=disable` in `DATABASE_URL`.

3. Install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Tables are created automatically on first request.

## Deploy on Vercel

1. Import this GitHub repo in Vercel.
2. Add the same environment variables. Set `APP_PUBLIC_URL` to your Vercel URL, for example `https://your-app.vercel.app`. `ADMIN_USERNAME` and `ADMIN_PASSWORD` are used only to create the first admin row; later logins use the `admins` and `sessions` tables.
3. Use a hosted Postgres provider and paste its connection string into `DATABASE_URL`. Prefer the pooled URL if the provider offers one (Neon pooler, Supabase transaction pooler, or Vercel Postgres).
4. Deploy. After the first successful request, sign in and open **Settings**.
5. Optional: set `CRON_SECRET` in Vercel. Vercel will send it on the one daily restore job (07:00 UTC / 09:00 GMT+2).

## Sera4 setup

1. Paste Sera4 values from Postman: `TwsHost`, `TwsUser`, `TwsPass`, `TwsOrgToken`, `TwsUserToken`, `TwsMembershipId`, and lock ID.
2. If Postman uses extra headers, add them as JSON in **Extra headers**.
3. Set **Public app URL** to the Vercel URL (or ngrok when developing locally). Sera4 cannot reach `localhost`.
4. Copy the webhook URL and register it in Sera4 for lock open/close status updates.
5. Use **Test lock + history** or **Pull access history** on the overview. Choose a from/to date first so history is not fetched unbounded.

## Alerts

If the same user opens the lock more than **4** times in **10** minutes (both configurable), Inclusive Lock Monitor raises a burst alert. Daily totals are also tracked and can alert on the same limit. When auto-revoke is on, the Sera4 key is deleted and a new key is issued at **09:00 GMT+2 the following day** (one Vercel cron run per day).

Admins can add **operator** users in Settings. Operators can view occupancy, history, and alerts, but cannot open Settings or the webhook log. Sign-in and other actions for every user, including admins, are written to the **Activity log**.
