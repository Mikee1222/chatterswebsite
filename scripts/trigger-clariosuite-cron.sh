#!/usr/bin/env bash
# External ClarioSuite sync (Hobby cannot use vercel.json sub-daily crons).
# Usage:
#   CRON_SECRET=... ./scripts/trigger-clariosuite-cron.sh
#   APP_URL=https://www.gunzoteam.com CRON_SECRET=... ./scripts/trigger-clariosuite-cron.sh
set -euo pipefail
BASE_URL="${APP_URL:-https://www.gunzoteam.com}"
if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is required" >&2
  exit 1
fi
curl -fsS -X GET \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Accept: application/json" \
  --max-time 290 \
  "${BASE_URL%/}/api/cron/sync-clariosuite"
echo
