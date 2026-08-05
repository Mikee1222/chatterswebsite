# Direct Storage Upload Audit

Date: 2026-08-05  
Production Supabase: `wagfkuxkrgsencartqtx` (Gunzo)  
Pattern reference: `4a301bb` (rebills / tips / extra-revenue / VA phase screenshots)

## Flow

1. Client `POST /api/attachments/upload-url` (JSON only — purpose, filename, size, contentType)
2. Service role mints signed upload URL (`createPrivateStorageSignedUpload`)
3. Browser `PUT`s bytes to Supabase Storage (never through Vercel function body)
4. Subsequent API/form POST carries only `sb://…` (or public https for `link-page-assets`)

Airtable dual-backend (`DATA_BACKEND=airtable`) keeps FormData file bytes as before.

## Buckets (Production)

| Bucket | Public | Size limit | Used by |
|--------|--------|------------|---------|
| `attachments` | private | 50MB | chatter screenshots, phones, spot/daily, mistakes, VA content, contracts, shadowban |
| `feedback-screenshots` | private | 20MB | feedback |
| `payment-proofs` | private | 50MB | client payment proofs |
| `link-page-assets` | **public** | 20MB | link page images |
| `sop-files` | private | 100MB | SOP files + PDF Maker output |
| `winner-videos` | private | 500MB | winner screenshots + video transcripts |

RLS: service-role full access; public read only on `link-page-assets`. Clients never get broad INSERT — they use short-lived signed upload URLs.

## Classification table

| Upload location | Was Vercel-proxied? | Fixed? | Bucket / notes |
|-----------------|---------------------|--------|----------------|
| Rebills / Tips / Extra revenue | Yes → fixed in `4a301bb` | Yes (already) | `attachments` / `chatter/*` |
| VA phase checklist screenshots | Yes → fixed in `4a301bb` | Yes (already) | `attachments` / `va_task_phase_items/*` |
| Feedback screenshots | Yes (Blob / base64) | **Yes** | `feedback-screenshots` |
| Shadowban report screenshots (VA + admin marketing) | Yes (Vercel Blob) | **Yes** | `attachments` / `shadowban-reports/*` |
| Marketing phone photos | Yes (server arrayBuffer) | **Yes** | `attachments` / `marketing_phones/*` |
| Winner Videos / Research screenshots | Yes | **Yes** | `winner-videos` |
| Spot Check attachments | Yes (Supabase stub was no-op) | **Yes** | `attachments` / `marketing_spot_checks/*` (+ stub implemented) |
| Daily Review attachments | Yes (Supabase stub was no-op) | **Yes** | `attachments` / `marketing_daily_reviews/*` |
| VA mistake screenshots | Yes | **Yes** | `attachments` / `chatter_mistakes/*` |
| VA content assignment files | Yes | **Yes** | `attachments` / `va_content_assignments/*` |
| Video Transcripts uploads | Yes (large — high risk) | **Yes** | `winner-videos` (500MB) / `video_transcripts/*` |
| Client payment proofs | Yes (Vercel Blob) | **Yes** | `payment-proofs` |
| SOP library file upload | Yes (Vercel Blob) | **Yes** | `sop-files` |
| Link page assets | Yes (Blob + sharp) | **Yes** | `link-page-assets` (public). **Sharp compression skipped on Supabase path** — original uploaded. |
| Account contract attachments | Yes (server action FormData) | **Yes** | `attachments` / `users/*/contract_attachments` via pre-upload + JSON urls |
| PDF Maker | Server-generated PDF → Blob | **Yes** (server→Storage) | `sop-files` / `pdf-maker/*`. Not a client upload; still avoids Blob dependency on Supabase. |
| Blur tool | N/A (client canvas only) | N/A | No server upload |
| Model expense / custom request / social verification photos | No client file upload found | N/A | Links/URLs only |
| Notification settings FormData | No files | N/A | Pref toggles only |

## Deferred / flagged

| Item | Reason |
|------|--------|
| Link-page **sharp** compression (>5MB) | Needs server-side image processing. Supabase path uploads original; Airtable/Blob path still compresses. |
| Video transcription | Still needs a reachable file URL after upload — resolved via signed URL from `sb://`. Upload itself is direct. |
| PDF Maker generation | PDF bytes still built inside the Vercel function (text JSON in, PDF out). Not a client multipart upload; output stored in Storage on Supabase. |
| Server-side File fallbacks | Several APIs still accept File bytes when `screenshot_url`/`attachment_url` absent (Airtable + small supabase fallbacks). Clients on Supabase should not hit these for large files. |

## Shared helpers

- `lib/direct-storage-upload.ts` — purposes, buckets, path prefixes, token validation
- `lib/client-direct-storage-upload.ts` — browser mint + PUT
- `app/api/attachments/upload-url/route.ts` — permissioned signed-upload mint
- `lib/supabase-signed-url.ts` — `createPrivateStorageSignedUpload`, `uploadToPrivateStorage`, resolve

## Test notes

- `npx tsc --noEmit` — pass
- Manual E2E with 5–10MB files recommended for: tips/rebills (already), feedback, video transcript, payment proof, link-page asset
