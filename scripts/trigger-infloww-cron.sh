#!/usr/bin/env bash
# External hourly Infloww sync (Hobby cannot use vercel.json hourly crons).
# Usage:
#   CRON_SECRET=... ./scripts/trigger-infloww-cron.sh
#   APP_URL=https://www.gunzoteam.com CRON_SECRET=... ./scripts/trigger-infloww-cron.sh
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
  "${BASE_URL%/}/api/cron/sync-infloww-stats"
echo
