#!/usr/bin/env bash
# Registered Open Icecat run: access check -> index discovery -> gated lookups
# -> backup -> draft import -> coverage. Each step is checkpointed (cached
# responses, incremental verified files), so a rerun resumes. Credentials are
# read from icecat/icecat.env and never printed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$HERE"

python3 -I - <<'PY'
import json, os, sys, urllib.parse, urllib.request
sys.path.insert(0, ".")
import icecat_adapter as a, validate_records as v
if not a.load_config() and not os.environ.get("ICECAT_USERNAME"):
    sys.exit("Missing sgnova/catalog/real/icecat/icecat.env (copy icecat.env.example).")
if os.environ.get("ICECAT_OCL_ACCEPTED") != "1":
    sys.exit("ICECAT_OCL_ACCEPTED=1 is required (Open Content License accepted).")
auth, headers, mode = a.credentials(False)
url = a.API + "?" + urllib.parse.urlencode({"lang": "EN", **auth, "Brand": "Kingston", "ProductCode": "KF432C16BB/16"})
req = urllib.request.Request(url, headers={"User-Agent": v.UA, **headers})
try:
    body = urllib.request.urlopen(req, timeout=40, context=v.SSL_CTX).read().decode("utf-8", "replace")
except Exception as e:
    body = getattr(e, "read", lambda: b"")().decode("utf-8", "replace") or str(e)
data = json.loads(body, strict=False) if body.startswith("{") else {}
demo = (data.get("data") or {}).get("DemoAccount")
print("access check:", data.get("msg") or data.get("Message"), "| demo account:", bool(demo))
if data.get("msg") != "OK" or demo:
    sys.exit("Registered Open Icecat access not confirmed.")
PY

python3 -I icecat_index.py "$@"
python3 -I icecat_adapter.py --expand --max-requests "${ICECAT_MAX_REQUESTS:-700}"

TS=$(date +%Y%m%d-%H%M%S)
docker exec lab-medusa-db-1 pg_dump -U postgres -Fc medusa_dtc > "$ROOT/sgnova/backups/database/medusa-$TS-pre-icecat-import.dump"
docker exec -i lab-medusa-db-1 pg_restore --list < "$ROOT/sgnova/backups/database/medusa-$TS-pre-icecat-import.dump" > /dev/null
echo "backup ok: medusa-$TS-pre-icecat-import.dump"

(cd "$ROOT/apps/backend" && SGNOVA_IMAGE_BASE_URL="${SGNOVA_IMAGE_BASE_URL:-http://localhost:4111}" \
  pnpm exec medusa exec ./src/scripts/import-verified-catalog.ts 2>&1 | grep -E "VERIFIED|rror")
python3 -I coverage.py --db | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['totals'],'categories',d['categories_with_verified'])"
