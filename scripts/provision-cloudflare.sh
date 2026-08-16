#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"
[[ "$MODE" == "plan" || "$MODE" == "apply" ]] || {
  echo "Usage: ./scripts/provision-cloudflare.sh [plan|apply]" >&2
  exit 2
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 2
cd "$ROOT"
WRANGLER="$ROOT/node_modules/.bin/wrangler"
[[ -x "$WRANGLER" ]] || { echo "Run npm ci first." >&2; exit 1; }

required=(CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID EXPECTED_CF_ACCOUNT_ID EXPECTED_PRODUCTION_D1_ID INGEST_ALLOWED_HOSTS)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "Missing required environment variable: $name" >&2; exit 1; }
done
[[ "$CLOUDFLARE_ACCOUNT_ID" == "$EXPECTED_CF_ACCOUNT_ID" ]] || {
  echo "CLOUDFLARE_ACCOUNT_ID does not match EXPECTED_CF_ACCOUNT_ID." >&2
  exit 1
}

PREVIEW_D1_NAME="${PREVIEW_D1_NAME:-worker_1_db_preview}"
RATE_LIMIT_KV_TITLE="${RATE_LIMIT_KV_TITLE:-cloudflare-search-portal-rate-limit}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"$WRANGLER" d1 list --json >"$TMP/d1.json"
PRODUCTION_FOUND="$(node -e '
  const rows=require(process.argv[1]);
  process.stdout.write(rows.some(x => (x.uuid||x.id)===process.argv[2]) ? "yes" : "no");
' "$TMP/d1.json" "$EXPECTED_PRODUCTION_D1_ID")"
[[ "$PRODUCTION_FOUND" == yes ]] || {
  echo "Confirmed production D1 ID is not visible to this account. Refusing provisioning." >&2
  exit 1
}

find_d1_id() {
  node -e '
    const rows=require(process.argv[1]);
    const matches=rows.filter(x => x.name===process.argv[2]);
    if (matches.length>1) process.exit(2);
    process.stdout.write(matches[0]?.uuid || matches[0]?.id || "");
  ' "$1" "$2"
}
find_kv_id() {
  node -e '
    const rows=require(process.argv[1]);
    const matches=rows.filter(x => x.title===process.argv[2]);
    if (matches.length>1) process.exit(2);
    process.stdout.write(matches[0]?.id || "");
  ' "$1" "$2"
}

PREVIEW_D1_ID="$(find_d1_id "$TMP/d1.json" "$PREVIEW_D1_NAME")"
"$WRANGLER" kv namespace list --json >"$TMP/kv.json"
RATE_LIMIT_KV_ID="$(find_kv_id "$TMP/kv.json" "$RATE_LIMIT_KV_TITLE")"

cat <<EOF
Cloudflare production provisioning plan
  Account:          $EXPECTED_CF_ACCOUNT_ID
  Production D1:    $EXPECTED_PRODUCTION_D1_ID (existing; never modified here)
  Preview D1 name:  $PREVIEW_D1_NAME (${PREVIEW_D1_ID:-create required})
  Rate KV title:    $RATE_LIMIT_KV_TITLE (${RATE_LIMIT_KV_ID:-create required})
  Allowed hosts:    $INGEST_ALLOWED_HOSTS
EOF

if [[ "$MODE" == plan ]]; then
  echo
  echo "Read-only plan complete. To create only missing resources, set:"
  echo "  export CONFIRM_PROVISION_ACCOUNT_ID=$EXPECTED_CF_ACCOUNT_ID"
  echo "  ./scripts/provision-cloudflare.sh apply"
  exit 0
fi

[[ "${CONFIRM_PROVISION_ACCOUNT_ID:-}" == "$EXPECTED_CF_ACCOUNT_ID" ]] || {
  echo "apply requires CONFIRM_PROVISION_ACCOUNT_ID to exactly match the account ID." >&2
  exit 1
}

if [[ -z "$PREVIEW_D1_ID" ]]; then
  create_args=(d1 create "$PREVIEW_D1_NAME")
  [[ -n "${D1_LOCATION:-}" ]] && create_args+=(--location "$D1_LOCATION")
  "$WRANGLER" "${create_args[@]}"
  "$WRANGLER" d1 list --json >"$TMP/d1.json"
  PREVIEW_D1_ID="$(find_d1_id "$TMP/d1.json" "$PREVIEW_D1_NAME")"
  [[ -n "$PREVIEW_D1_ID" ]] || { echo "Preview D1 creation could not be verified." >&2; exit 1; }
fi

if [[ -z "$RATE_LIMIT_KV_ID" ]]; then
  "$WRANGLER" kv namespace create "$RATE_LIMIT_KV_TITLE"
  "$WRANGLER" kv namespace list --json >"$TMP/kv.json"
  RATE_LIMIT_KV_ID="$(find_kv_id "$TMP/kv.json" "$RATE_LIMIT_KV_TITLE")"
  [[ -n "$RATE_LIMIT_KV_ID" ]] || { echo "RATE_LIMIT KV creation could not be verified." >&2; exit 1; }
fi

[[ "$PREVIEW_D1_ID" != "$EXPECTED_PRODUCTION_D1_ID" ]] || {
  echo "Preview and production D1 IDs unexpectedly match. Refusing configuration." >&2
  exit 1
}

OUTPUT="$ROOT/.production-infrastructure.env"
umask 077
cat >"$OUTPUT" <<EOF
EXPECTED_CF_ACCOUNT_ID=$EXPECTED_CF_ACCOUNT_ID
EXPECTED_PRODUCTION_D1_ID=$EXPECTED_PRODUCTION_D1_ID
EXPECTED_PREVIEW_D1_ID=$PREVIEW_D1_ID
EXPECTED_RATE_LIMIT_KV_ID=$RATE_LIMIT_KV_ID
INGEST_ALLOWED_HOSTS=$INGEST_ALLOWED_HOSTS
EOF

EXPECTED_PREVIEW_D1_ID="$PREVIEW_D1_ID" \
EXPECTED_RATE_LIMIT_KV_ID="$RATE_LIMIT_KV_ID" \
node scripts/configure-cloudflare.mjs --write --verify-remote

cat <<EOF

Provisioning verified. Confirmed values were written to:
  $OUTPUT

Secrets were not read or created. Configure them interactively:
  $WRANGLER secret put INGEST_TOKEN
  $WRANGLER secret put CHAT_TOKEN

Then source $OUTPUT and run:
  ./scripts/verify-production.sh --production
EOF
