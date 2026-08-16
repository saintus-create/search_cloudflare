#!/usr/bin/env bash
set -Eeuo pipefail

# This script is a deployment gate, not a deployment command. It performs no
# production writes. A CI deployment job may run `wrangler deploy` only after
# this script exits successfully.

MODE="local"
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/verify-production.sh                  # local candidate verification
  ./scripts/verify-production.sh --production     # include remote CF identity/state
  ./scripts/verify-production.sh --skip-install   # dependencies already installed

Production mode requires:
  EXPECTED_CF_ACCOUNT_ID
  EXPECTED_PRODUCTION_D1_ID
  EXPECTED_PREVIEW_D1_ID
  EXPECTED_RATE_LIMIT_KV_ID
  CLOUDFLARE_ACCOUNT_ID

The script never creates bindings, writes secrets, applies production migrations,
pushes Git, or deploys. It exits at the first failed gate.
EOF
}

while (($#)); do
  case "$1" in
    --production) MODE="production" ;;
    --local) MODE="local" ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

command -v git >/dev/null || { echo "git is required" >&2; exit 2; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 2; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 2; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this script inside the repository." >&2
  exit 2
}
cd "$ROOT"
WRANGLER="$ROOT/node_modules/.bin/wrangler"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit(major>22 || (major===22 && minor>=12) ? 0 : 1)' || {
  echo "Node.js 22.12 or newer is required; found $(node --version)." >&2
  exit 2
}

GATES=(AUDIT SECURITY MIGRATIONS TESTS BUILD CONFIG GIT)
declare -A STATUS
for gate in "${GATES[@]}"; do STATUS[$gate]="·"; done

show_gates() {
  echo
  echo "Deployment gates:"
  for gate in "${GATES[@]}"; do printf '  %-12s %s\n' "$gate" "${STATUS[$gate]}"; done
}

abort_gate() {
  local gate="$1" message="$2"
  STATUS[$gate]="✗"
  echo >&2
  echo "FAILED [$gate]: $message" >&2
  show_gates >&2
  exit 1
}

run_or_abort() {
  local gate="$1" message="$2"
  shift 2
  echo
  echo "[$gate] $message"
  if "$@"; then STATUS[$gate]="✓"; else abort_gate "$gate" "$message"; fi
}

# install
if ((SKIP_INSTALL == 0)); then
  echo "[install] Installing exactly from package-lock.json"
  [[ -f package-lock.json ]] || abort_gate AUDIT "package-lock.json is required before installation."
  npm ci --ignore-scripts --no-audit --no-fund || abort_gate AUDIT "npm ci failed."
else
  echo "[install] Skipped by explicit request."
  [[ -d node_modules ]] || abort_gate AUDIT "--skip-install was used but node_modules is absent."
fi

# audit/config contract
run_or_abort AUDIT "Auditing repository against PROJECT_CONTRACT.md" \
  ./scripts/reconcile.sh --no-fetch --report "$TMP/audit.json"

echo
echo "[dependency audit] Rejecting high-severity production dependency advisories"
npm run audit || abort_gate SECURITY "Production dependency audit failed."

# The type/check stage intentionally precedes tests.
echo
echo "[type/check] Running Astro type and content checks"
npm run check || abort_gate TESTS "Astro/type checks failed."

# unit tests
UNIT_SCRIPT="$(node -p 'require("./package.json").scripts?.test || ""')"
[[ -n "$UNIT_SCRIPT" ]] || abort_gate TESTS "package.json does not define scripts.test."
echo
echo "[unit tests]"
npm test || abort_gate TESTS "Unit tests failed."

# security tests are a separate hard stop
SECURITY_SCRIPT="$(node -p 'require("./package.json").scripts?.["test:security"] || ""')"
[[ -n "$SECURITY_SCRIPT" ]] || abort_gate SECURITY "package.json does not define scripts.test:security."
echo
echo "[security tests]"
npm run test:security || abort_gate SECURITY "Security tests failed."
STATUS[SECURITY]="✓"

# Migration/integration tests must use a fresh local D1 state directory.
MIGRATION_SCRIPT="$(node -p 'require("./package.json").scripts?.["test:migrations"] || ""')"
[[ -n "$MIGRATION_SCRIPT" ]] || abort_gate MIGRATIONS "package.json does not define scripts.test:migrations."
echo
echo "[migration tests] Using isolated local D1 state: $TMP/d1"
mkdir -p "$TMP/d1"
RECONCILE_D1_STATE="$TMP/d1" npm run test:migrations || abort_gate MIGRATIONS "Migration/integration tests failed."
STATUS[MIGRATIONS]="✓"
STATUS[TESTS]="✓"

# production build
echo
echo "[build]"
npm run build || abort_gate BUILD "Production build failed."
STATUS[BUILD]="✓"

# Configuration must be generated from explicit operator-confirmed IDs, then
# Wrangler parses and bundles it without writing to Cloudflare.
echo
echo "[config] Confirmed binding check and Wrangler dry run"
node scripts/configure-cloudflare.mjs --check || abort_gate CONFIG "Generated Wrangler config does not match confirmed infrastructure inputs."
[[ -x "$WRANGLER" ]] || abort_gate CONFIG "Wrangler is not installed."
"$WRANGLER" deploy --dry-run --outdir "$TMP/wrangler-dry-run" || abort_gate CONFIG "Wrangler rejected the Worker configuration."
STATUS[CONFIG]="✓"

# Git checks. A local candidate may be dirty because the documented workflow asks
# the human to inspect the diff after verification. Production/CI must be clean.
echo
echo "[git]"
git diff --check || abort_gate GIT "Git diff contains whitespace errors."
if git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- ':!package-lock.json' >/dev/null 2>&1; then
  abort_gate GIT "Merge conflict markers are present."
fi
BRANCH="$(git branch --show-current || true)"
if [[ "$MODE" == "production" ]]; then
  [[ -z "$(git status --porcelain)" ]] || abort_gate GIT "Production verification requires a clean checkout."
  if [[ "$BRANCH" != "main" && "${GITHUB_REF_NAME:-}" != "main" ]]; then
    abort_gate GIT "Production verification is allowed only for main."
  fi
  git fetch origin main --quiet || abort_gate GIT "Could not fetch origin/main."
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || abort_gate GIT "HEAD does not equal pushed origin/main."
else
  if [[ "$BRANCH" != "main" ]]; then
    if [[ "${GITHUB_ACTIONS:-}" != "true" || "${GITHUB_EVENT_NAME:-}" != "pull_request" ]]; then
      abort_gate GIT "Local verification must run on main (detached pull-request CI is the only exception)."
    fi
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "  Candidate tree is dirty as expected before human diff/commit review."
  fi
fi
STATUS[GIT]="✓"

verify_remote_identity() {
  local required=(EXPECTED_CF_ACCOUNT_ID EXPECTED_PRODUCTION_D1_ID EXPECTED_PREVIEW_D1_ID EXPECTED_RATE_LIMIT_KV_ID CLOUDFLARE_ACCOUNT_ID)
  local name
  for name in "${required[@]}"; do
    [[ -n "${!name:-}" ]] || abort_gate CONFIG "$name must be explicitly set in production mode."
  done
  [[ "$CLOUDFLARE_ACCOUNT_ID" == "$EXPECTED_CF_ACCOUNT_ID" ]] || abort_gate CONFIG "CLOUDFLARE_ACCOUNT_ID disagrees with EXPECTED_CF_ACCOUNT_ID."
  [[ "$EXPECTED_PRODUCTION_D1_ID" != "$EXPECTED_PREVIEW_D1_ID" ]] || abort_gate CONFIG "Production and preview D1 IDs are identical."

  echo
  echo "[production infrastructure] Verifying authenticated Cloudflare resources (read-only)"
  "$WRANGLER" whoami >"$TMP/whoami.txt" || abort_gate CONFIG "Wrangler authentication failed."
  "$WRANGLER" d1 list --json >"$TMP/d1.json" || abort_gate CONFIG "Could not list D1 databases."
  if ! node - "$TMP/d1.json" "$EXPECTED_PRODUCTION_D1_ID" "$EXPECTED_PREVIEW_D1_ID" <<'NODE'
const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for (const id of process.argv.slice(3)) {
  if (!rows.some(row => row.uuid===id || row.id===id)) {
    console.error(`Confirmed D1 ID is not visible to the authenticated account: ${id}`);
    process.exit(1);
  }
}
NODE
  then
    abort_gate CONFIG "Confirmed D1 resources were not found in the authenticated account."
  fi

  "$WRANGLER" kv namespace list --json >"$TMP/kv.json" || abort_gate CONFIG "Could not list KV namespaces."
  if ! node - "$TMP/kv.json" "$EXPECTED_RATE_LIMIT_KV_ID" <<'NODE'
const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const id=process.argv[3];
if (!rows.some(row => row.id===id)) {
  console.error(`Confirmed RATE_LIMIT KV ID is not visible to the authenticated account: ${id}`);
  process.exit(1);
}
NODE
  then
    abort_gate CONFIG "Confirmed RATE_LIMIT KV namespace was not found."
  fi

  "$WRANGLER" secret list --json >"$TMP/secrets.json" || abort_gate CONFIG "Could not list Worker secrets."
  if ! node - "$TMP/secrets.json" INGEST_TOKEN CHAT_TOKEN <<'NODE'
const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const names=new Set(rows.map(row=>row.name));
const missing=process.argv.slice(3).filter(name=>!names.has(name));
if (missing.length) { console.error(`Missing Worker secrets: ${missing.join(', ')}`); process.exit(1); }
NODE
  then
    abort_gate CONFIG "Required authentication secrets are not configured."
  fi

  # `d1 migrations list` is read-only. Any listed SQL file is pending; this gate
  # does not apply it. The operator must independently verify the target and use
  # Wrangler with APPLY_PRODUCTION_MIGRATIONS=yes outside this script.
  "$WRANGLER" d1 migrations list DB --remote >"$TMP/remote-migrations.txt" || abort_gate MIGRATIONS "Could not inspect remote migration state."
  if grep -Eq '[0-9]{4}_[^[:space:]]+\.sql' "$TMP/remote-migrations.txt"; then
    cat "$TMP/remote-migrations.txt" >&2
    abort_gate MIGRATIONS "Production has pending migrations. Verify the D1 ID, then apply them explicitly; this script will not write production."
  fi
  echo "  Cloudflare account, D1, KV, secrets, and migration state verified."
}

if [[ "$MODE" == "production" ]]; then
  verify_remote_identity
fi

show_gates
cat <<'EOF'

VERIFIED. This checkout passed the contract gates.
This script did not deploy or mutate production. CI may now perform its protected
`wrangler deploy` step; local users should inspect `git diff` before committing.
EOF
