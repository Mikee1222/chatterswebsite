# Hermes agent token — smoke checklist

Prerequisites: migration `supabase/migrations/20261119073717_agent_tokens.sql` applied in the target env; Hermes VA user with `is_agent=true`, Marketing Executive `va_type`, assigned only to the pilot creator; token created via admin UI or CLI.

```bash
npx tsx scripts/test-agent-allowlist.ts
export TOKEN='gz_agent_…'   # from create (shown once)
export BASE='https://your-host'  # or http://localhost:3000
export PILOT_MODEL_ID='…'
export OTHER_MODEL_BRIEF_ID='…'  # brief for a non-assigned creator
```

## 1) GET posting-briefs for pilot → 200 (pilot only)

```bash
curl -sS -o /tmp/pb.json -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/posting-briefs?model_id=$PILOT_MODEL_ID"
# expect 200; body briefs only for pilot model
```

## 2) No header / revoked / expired / wrong prefix → 401

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/api/posting-briefs"
# 401

curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer gz_agent_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
  "$BASE/api/posting-briefs"
# 401 (unknown / wrong hash)

curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer gz_other_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
  "$BASE/api/posting-briefs"
# 401 (wrong prefix — format check before hash)
```

Revoke a token in admin UI or `npx tsx scripts/agent-token.ts revoke --id …`, then retry with that plaintext → 401.

## 3) Other creator brief → 403

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/posting-briefs/$OTHER_MODEL_BRIEF_ID"
# 403
```

## 4) Allowed POST → `agent_action_log` row

```bash
# Example: start task shift (self-scoped)
curl -sS -w "\n%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/va/task-shift/start"
```

In Supabase, confirm a new `agent_action_log` row with:

- `action_type` = `action`
- `tool_name` = `POST /api/va/task-shift/start`
- `parameters.kind` = `agent_http`
- `parameters.http_status` = response status string
- `parameters.agent_token_id` set
- **no** request body, Authorization header, or token/hash

## 5) Denied methods/routes → 401 (no agent session)

```bash
# DELETE posted — not allowlisted
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/posting-briefs/SOME_BRIEF/posts/SOME_POST/posted"
# 401

# POST winner-videos — not allowlisted
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/winner-videos"
# 401

# Admin API
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/admin/agent-tokens"
# 401
```

## 6) Cookie login unaffected

- Normal human user still logs in via `/login` with password + cookie.
- Agent user (`is_agent=true`) password login shows generic "Invalid email or password".
- Human cookie sessions still work for allowlisted and non-allowlisted APIs as before.

## 7) Header spoofing → 401

Middleware runs for **every** `/api/*` path (matcher: `/api` + `/api/:path*`, including `/api/l/*`, `/api/cron/*`, `/api/apply/*`). It **deletes then overwrites** `x-pathname` and `x-method` from the real request URL/method — client-forged values cannot stick.

With a valid token, call a **non-allowlisted** route while forging allowlisted headers. Auth must still see the real path/method → **401**:

```bash
# Real request is POST /api/admin/agent-tokens (denied); forged headers claim GET /api/posting-briefs
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-pathname: /api/posting-briefs" \
  -H "x-method: GET" \
  "$BASE/api/admin/agent-tokens"
# expect 401

# Real request is DELETE …/posted (denied); forged headers claim POST …/posted
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-pathname: /api/posting-briefs/$OTHER_MODEL_BRIEF_ID/posts/SOME_POST/posted" \
  -H "x-method: POST" \
  "$BASE/api/posting-briefs/$OTHER_MODEL_BRIEF_ID/posts/SOME_POST/posted"
# expect 401
```

## Typecheck

```bash
npx tsc --noEmit
npx tsx scripts/test-agent-allowlist.ts
```

