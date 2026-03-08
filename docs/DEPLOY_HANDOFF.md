# Chatter Dashboard – Deployment Handoff

Use this checklist to push to GitHub and deploy to Cloudflare Pages. The project is already production-hardened.

---

## 1. Final pre-deploy verification (done)

| Check | Status |
|-------|--------|
| `npm run build` succeeds | ✓ |
| `npm run typecheck` succeeds | ✓ |
| Cloudflare build: `npx @cloudflare/next-on-pages` (or `npm run pages:build`) | ✓ |
| No real secrets in source (only env refs and dev fallback) | ✓ |
| `.env` and `.env.*` in `.gitignore` | ✓ |
| Public assets: `/icon.svg`, `/icons/icon.svg`, `/manifest.webmanifest`, `/sw.js`, `/favicon.ico`, `/apple-touch-icon.png` | ✓ (redirects where needed) |
| Middleware does not block manifest/icons/sw/public assets | ✓ |
| Auth protects non-public routes; login and public paths work | ✓ |
| PWA/public paths work without login | ✓ |

---

## 2. GitHub push commands

Run these in order from the project root. If the repo already exists and has a remote, skip `git init` and `git remote add`.

```bash
git init
git add .
git commit -m "initial production deploy"
git branch -M main
git remote add origin https://github.com/USERNAME/chatter-dashboard.git
git push -u origin main
```

Replace `Mikee1222` with your GitHub username or org. Before pushing, ensure `.env` and `.next` do not appear in `git status` (they are in `.gitignore`). If the folder is already a git repo, skip `git init`. If the remote already exists, use `git remote set-url origin https://github.com/USERNAME/chatter-dashboard.git` instead of `git remote add`.

---

## 3. Cloudflare Pages setup

### Create project

1. **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select your GitHub account and the **chatter-dashboard** repo (after you’ve pushed).
3. **Framework preset:** **Next.js** (or **None** if you prefer to set everything manually).

### Build configuration

| Setting | Value |
|--------|--------|
| **Build command** | `npx @cloudflare/next-on-pages` |
| **Build output directory** | Leave as suggested by the Next.js preset, or use `.vercel/output/static` if the preset doesn’t set it. If the build fails, check [next-on-pages](https://github.com/cloudflare/next-on-pages) for the current output path. |
| **Root directory** | Leave blank (project root). |
| **Environment variables** | Add all required and recommended vars (see §4). Set them for **Production**; optionally duplicate for **Preview** if you use branch previews. |

### Compatibility

- **Node.js version:** Use the default (e.g. 18 or 20). Set in **Settings → Builds & deployments → Build configuration** if needed.
- No extra compatibility flags required for this setup.

### Custom domain and HTTPS

- **Custom domain:** **Pages** → your project → **Custom domains** → **Set up a custom domain**.
- **HTTPS:** Cloudflare provides HTTPS by default. Ensure **SSL/TLS** is set to **Full** or **Full (strict)** if you use a custom domain.

---

## 4. Environment variables (Cloudflare Pages)

Add these in **Pages** → your project → **Settings** → **Environment variables**. Prefer **Production**; add to **Preview** only if you need the same behavior on preview URLs.

### Required

| Variable | Description |
|----------|-------------|
| `AIRTABLE_TOKEN` | Airtable personal access token (or API key) with access to your base. |
| `AIRTABLE_BASE_ID` | Airtable base ID (starts with `app...`). |
| `SESSION_JWT_SECRET` | Secret used to sign session cookies (min 32 characters). Generate: `openssl rand -base64 32`. **Must be set in production** or the app will throw. |

### Recommended

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Full public URL of the app (e.g. `https://chatter-dashboard.pages.dev`). Used for PWA manifest, push, and links. |

### Optional

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (for push notifications). |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key. Generate both: `npx web-push generate-vapid-keys`. |
| `DEMO_LOGIN_EMAIL` | Demo user email (dev/local only; do not rely on in production). |
| `DEMO_LOGIN_PASSWORD` | Demo user password (dev only). |
| `DEMO_LOGIN_ROLE` | Demo user role: `admin`, `manager`, `chatter`, or `virtual_assistant`. |
| `ADMIN_AIRTABLE_USER_IDS` | Comma-separated Airtable user record IDs for admin notifications (whale/custom events). |
| `NEXT_PUBLIC_REALTIME_WS_URL` | WebSocket URL for realtime (e.g. `wss://chatter-realtime.workers.dev/realtime`). |
| `REALTIME_BROADCAST_URL` | URL of realtime Worker broadcast endpoint. |
| `REALTIME_BROADCAST_SECRET` | Secret for broadcast API auth. |
| `REALTIME_JWT_SECRET` | Secret for realtime JWT (min 32 chars). |

---

## 5. Push / PWA deployment notes

- **HTTPS:** Push and PWA require a secure context. Cloudflare Pages gives you HTTPS; do not use push on plain HTTP in production.
- **VAPID keys:** For push, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Cloudflare env. Generate once: `npx web-push generate-vapid-keys`. The public key is exposed via `/api/push/vapid-public`; the private key must stay server-only.
- **Service worker:** Served at `/sw.js` (from `public/sw.js`). Middleware does not block it. No extra path config needed.
- **Manifest:** Served at `/manifest.webmanifest`. Icons reference `/icons/icon.svg`. `NEXT_PUBLIC_APP_URL` should match the live URL so `start_url` and scope are correct.
- **Apple touch icons:** `/apple-touch-icon.png` and `/apple-touch-icon-precomposed.png` redirect to `/icons/icon.svg` so they do not 404 (iOS/PWA polish).

**After deploy, verify:**

1. Open `https://YOUR_APP_URL/manifest.webmanifest` — JSON manifest with correct `start_url` and icons.
2. Open `https://YOUR_APP_URL/icons/icon.svg` — icon loads.
3. Open `https://YOUR_APP_URL/sw.js` — service worker script loads (no auth redirect).
4. Install prompt: In a supported browser (Chrome/Edge), use “Install” or “Add to Home Screen” and confirm the app installs.
5. Push: Log in → Settings or notification prompt → enable notifications; confirm subscription and send a test push if VAPID is set.

---

## 6. First smoke test (after deploy)

Run through this list on the **live** URL (HTTPS).

1. **Login** – Open `/login`, sign in with a real or demo account; expect redirect to dashboard.
2. **Admin page** – As admin, open `/admin`; page loads without redirect.
3. **Protected routes** – While logged in, open `/dashboard`, `/weekly-program`, `/my-whales`; no redirect to login.
4. **Weekly program** – Open `/weekly-program` (or admin weekly program); page and data load.
5. **Start shift** – As chatter, start a shift from the shift page; shift starts and UI updates.
6. **Notifications unread count** – Topbar bell shows unread count (or zero); no console errors.
7. **Manifest** – Open `https://YOUR_APP_URL/manifest.webmanifest` in a new tab; valid JSON, correct `start_url` and icons.
8. **Icon** – Open `https://YOUR_APP_URL/icons/icon.svg`; SVG loads. Open `https://YOUR_APP_URL/apple-touch-icon.png`; redirects to icon (no 404).
9. **Install prompt** – In Chrome/Edge, confirm “Install app” or “Add to Home Screen” appears when applicable; install and open; app opens in standalone.
10. **Push enable** – If VAPID is set: enable notifications in settings or via prompt; confirm “Notifications enabled” or success; optionally send test push.
11. **Service worker** – In DevTools → Application → Service Workers; confirm `/sw.js` is registered and active.

---

## 7. Last manual actions before go-live

- [ ] Generate and set `SESSION_JWT_SECRET` (e.g. `openssl rand -base64 32`) in Cloudflare Pages env.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the final production URL (e.g. `https://your-project.pages.dev` or custom domain).
- [ ] If using push: generate VAPID keys and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
- [ ] Confirm no reliance on `DEMO_LOGIN_*` in production (use real users or D1).
- [ ] (Optional) Add custom domain and verify HTTPS.
