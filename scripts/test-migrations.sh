#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
STATE="${RECONCILE_D1_STATE:-$(mktemp -d)}"
CREATED_STATE=false
if [[ -z "${RECONCILE_D1_STATE:-}" ]]; then CREATED_STATE=true; fi
cleanup() {
  if [[ "$CREATED_STATE" == true ]]; then rm -rf "$STATE"; fi
  return 0
}
trap cleanup EXIT

[[ -f wrangler.jsonc ]] || {
  echo "wrangler.jsonc is required. Generate it with scripts/configure-cloudflare.mjs --write." >&2
  exit 1
}

mapfile -t migrations < <(find migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9][0-9]_*.sql' -printf '%f\n' | sort)
expected=0
for migration in "${migrations[@]}"; do
  number="${migration%%_*}"
  ((10#$number == expected)) || {
    echo "Migration sequence is not contiguous at $migration (expected $(printf '%04d' "$expected"))." >&2
    exit 1
  }
  expected=$((expected + 1))
done
((${#migrations[@]} > 0)) || { echo "No migrations found." >&2; exit 1; }

WRANGLER="$ROOT/node_modules/.bin/wrangler"
[[ -x "$WRANGLER" ]] || { echo "Wrangler is not installed. Run npm ci first." >&2; exit 1; }

mkdir -p "$STATE"
"$WRANGLER" d1 migrations apply DB --local --persist-to "$STATE" >/dev/null

SQL=$(cat <<'SQL'
INSERT INTO documents (url, title, content, metadata)
VALUES ('local://reconcile-migration-test', 'Migration Test', 'reconcile_before_token', '{}');
SELECT 'insert_visible' AS check_name,
  (SELECT COUNT(*) FROM documents_fts WHERE documents_fts MATCH 'reconcile_before_token') = 1 AS value;
UPDATE documents SET content = 'reconcile_after_token' WHERE url = 'local://reconcile-migration-test';
SELECT 'old_term_removed' AS check_name,
  (SELECT COUNT(*) FROM documents_fts WHERE documents_fts MATCH 'reconcile_before_token') = 0 AS value;
SELECT 'updated_term_visible' AS check_name,
  (SELECT COUNT(*) FROM documents_fts WHERE documents_fts MATCH 'reconcile_after_token') = 1 AS value;
DELETE FROM documents WHERE url = 'local://reconcile-migration-test';
SELECT 'delete_removed' AS check_name,
  (SELECT COUNT(*) FROM documents_fts WHERE documents_fts MATCH 'reconcile_after_token') = 0 AS value;
SELECT 'index_count_consistent' AS check_name,
  (SELECT COUNT(*) FROM documents) = (SELECT COUNT(*) FROM documents_fts) AS value;
SELECT 'required_schema_present' AS check_name,
  (SELECT COUNT(*) FROM sqlite_master WHERE name IN (
    'documents', 'documents_fts', 'documents_ai', 'documents_ad', 'documents_au',
    'sections', 'sections_fts'
  )) = 7 AS value;
SQL
)

"$WRANGLER" d1 execute DB --local --persist-to "$STATE" --command "$SQL" --json >"$STATE/results.json"
node - "$STATE/results.json" <<'NODE'
const fs=require('fs');
const payload=JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const checks=[];
const visit=(value)=>{
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== 'object') return;
  if (typeof value.check_name === 'string') checks.push(value);
  Object.values(value).forEach(visit);
};
visit(payload);
const required=['insert_visible','old_term_removed','updated_term_visible','delete_removed','index_count_consistent','required_schema_present'];
const failures=required.filter(name => !checks.some(row => row.check_name===name && Number(row.value)===1));
if (failures.length) {
  console.error(`Migration checks failed: ${failures.join(', ')}`);
  console.error(JSON.stringify(checks, null, 2));
  process.exit(1);
}
console.log(`Migration checks passed: ${required.join(', ')}`);
NODE
