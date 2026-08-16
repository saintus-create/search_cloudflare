#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this command inside the repository." >&2
  exit 2
}
cd "$ROOT"

MODE="${1:-audit}"
case "$MODE" in
  audit)
    exec ./scripts/reconcile.sh
    ;;
  apply)
    exec ./scripts/reconcile.sh --apply
    ;;
  configure)
    exec node scripts/configure-cloudflare.mjs --write "${@:2}"
    ;;
  test)
    exec ./scripts/verify-production.sh "${@:2}"
    ;;
  production-check)
    exec ./scripts/verify-production.sh --production "${@:2}"
    ;;
  deploy)
    HEAD_COMMIT="$(git rev-parse HEAD)"
    if [[ "${CONFIRM_DEPLOY_COMMIT:-}" != "$HEAD_COMMIT" ]]; then
      echo "Deployment requires explicit commit confirmation:" >&2
      echo "  export CONFIRM_DEPLOY_COMMIT=$HEAD_COMMIT" >&2
      exit 1
    fi
    [[ -z "$(git status --porcelain)" ]] || {
      echo "Deployment requires a clean working tree." >&2
      exit 1
    }
    ./scripts/verify-production.sh --production --skip-install
    exec "$ROOT/node_modules/.bin/wrangler" deploy
    ;;
  *)
    cat >&2 <<'EOF'
Usage: ./scripts/production-ready.sh MODE

Modes:
  audit              Read-only contract and drift report
  apply              Apply only deterministic, guarded reconciliation
  configure          Generate wrangler.jsonc from confirmed environment IDs
  test               Run the complete local production gate
  production-check   Add read-only Cloudflare account/resource verification
  deploy              Verify and deploy an explicitly confirmed clean commit
EOF
    exit 2
    ;;
esac
