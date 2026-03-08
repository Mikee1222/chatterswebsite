# Cloudflare deployment setup

This app is built to run on Cloudflare (Pages + optional D1 for auth). Follow these steps to deploy.

## 1. Build for Cloudflare Pages

Next.js on Cloudflare typically uses `@cloudflare/next-on-pages` or the built-in Next.js support (when available).

- **Option A — @cloudflare/next-on-pages**  
  - Install: `npm i -D @cloudflare/next-on-pages`  
  - Build: `npx @cloudflare/next-on-pages`  
  - Use the generated `worker.js` / output as the Pages project.

- **Option B — Next.js static/standalone**  
  - If you use `output: 'standalone'` or static export, configure your Pages project to run the Node/static build per [Cloudflare Next.js docs](https://developers.cloudflare.com/pages/framework-guides/nextjs/).

Set the **build command** and **output directory** in the Cloudflare Pages project to match the tool you use.

## 2. Environment variables (Cloudflare dashboard)

In **Pages → your project → Settings → Environment variables**, set for **Production** (and Preview if desired):

**Required:**

- `AIRTABLE_TOKEN` — Airtable personal access token  
- `AIRTABLE_BASE_ID` — Your Airtable base ID (starts with `app...`)  
- `SESSION_JWT_SECRET` — Min 32 characters; used to sign session cookies. Generate: `openssl rand -base64 32`  

**Recommended:**

- `NEXT_PUBLIC_APP_URL` — Full app URL (e.g. `https://your-app.pages.dev`) for PWA manifest, push, and links  

**Optional:**

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — For web push (generate: `npx web-push generate-vapid-keys`)  
- `DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_PASSWORD` / `DEMO_LOGIN_ROLE` — Only for local/dev; do **not** rely on these in production  
- `ADMIN_AIRTABLE_USER_IDS` — Comma-separated Airtable user record IDs for admin notifications  
- Realtime: `NEXT_PUBLIC_REALTIME_WS_URL`, `REALTIME_BROADCAST_URL`, `REALTIME_BROADCAST_SECRET`, `REALTIME_JWT_SECRET` (see `realtime/README.md`)  

For production auth (optional): use a **D1 database** for user/password storage and bind it (see below). Session tokens remain JWT in cookies; `SESSION_JWT_SECRET` is always required in production.

## 3. D1 database (auth)

1. **Create a D1 database**  
   - Dashboard: **Workers & Pages → D1 → Create database**  
   - Note the **Database ID** and **name**.

2. **Bind D1 to your Pages project**  
   - In **Pages → your project → Settings → Functions**, set **D1 database bindings**:  
     - Variable name: e.g. `DB` (or whatever your code expects)  
     - D1 database: select the database you created  

   If you use **Wrangler** for deployment, add to `wrangler.toml`:

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "chatter-auth"
   database_id = "<your-d1-database-id>"
   ```

3. **Schema (run once)**  
   Create tables for auth, for example:

   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL,
     airtable_user_id TEXT,
     full_name TEXT,
     created_at TEXT,
     updated_at TEXT
   );

   CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     expires_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

   Run this via **D1 → Console** or `wrangler d1 execute <DB_NAME> --file=./schema.sql`.

4. **Use D1 in auth code**  
   In `lib/auth.ts` (and any auth helpers), replace the in-memory session store with:
   - **Sessions**: read/write the `sessions` table (and optionally clean expired rows).
   - **Users / passwords**: on login, look up user by email from `users`, verify with `verifyPassword`, then create a session row and set the session cookie.

   In `app/actions/auth.ts`, the production path should:
   - Look up the user in D1 by email.
   - Verify password with `verifyPassword`.
   - Create a session in D1 and set the HTTP-only cookie with the session id.

   Never expose `AIRTABLE_TOKEN` or D1 to the client; keep all auth and Airtable logic in server code.

## 4. Custom domain and HTTPS

- In **Pages → your project → Custom domains**, add your domain.
- Cloudflare provides HTTPS; ensure **Always Use HTTPS** is on in **SSL/TLS** if desired.

## 5. Airtable and rate limits

- The app uses a single Airtable base; all requests are server-side.
- Stay within [Airtable rate limits](https://airtable.com/developers/web/api/rate-limits); use pagination and caching where appropriate (e.g. dashboard stats, activity logs).

## 6. Summary checklist

- [ ] Build command: `npx @cloudflare/next-on-pages` (or `npm run pages:build`); output per next-on-pages docs  
- [ ] **Required** env: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `SESSION_JWT_SECRET` (min 32 chars)  
- [ ] **Recommended** env: `NEXT_PUBLIC_APP_URL` (your production URL)  
- [ ] (Optional) D1 created and bound; D1 schema applied; auth code uses D1 for users/sessions  
- [ ] Do **not** rely on `DEMO_LOGIN_*` in production  
- [ ] Custom domain and HTTPS configured  

After deployment, create the first admin user (e.g. via a one-off script or a signup route that writes to D1 and optionally syncs to Airtable `users`).
