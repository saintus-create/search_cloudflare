#!/bin/bash
set -u

PROJECT="/Users/2024-jan/Downloads/cloudflare-search-portal"
MAX=30
ATTEMPT=1

get_latest_url() {
  # Try to get the latest deployment URL from wrangler pages deployment list
  local url
  url=$(cd "$PROJECT" && npx wrangler pages deployment list 2>/dev/null | grep -o 'https://[a-z0-9]*\.cloudflare-search-portal\.pages\.dev' | head -1)
  if [ -n "$url" ]; then
    echo "$url"
    return 0
  fi
  # Fallback: check known recent URLs
  for candidate in \
    "https://812fa4a5.cloudflare-search-portal.pages.dev" \
    "https://adfae12b.cloudflare-search-portal.pages.dev" \
    "https://6b25b980.cloudflare-search-portal.pages.dev" \
    "https://6f5cf266.cloudflare-search-portal.pages.dev"; do
    if curl -s -o /dev/null -w "%{http_code}" "$candidate/" 2>/dev/null | grep -q "200"; then
      echo "$candidate"
      return 0
    fi
  done
  echo "https://cloudflare-search-portal.pages.dev"
}

wait_for_deploy() {
  echo "[*] Waiting for autoloop to deploy new version..."
  local waited=0
  local old_url="$1"
  while [ $waited -lt 120 ]; do
    sleep 5
    waited=$((waited+5))
    local new_url
    new_url=$(get_latest_url)
    if [ "$new_url" != "$old_url" ]; then
      echo "[+] New deployment detected: $new_url"
      echo "$new_url"
      return 0
    fi
  done
  echo "[!] Timeout waiting for new deploy, using current URL"
  echo "$old_url"
  return 0
}

while [ $ATTEMPT -le $MAX ]; do
  echo "=== Self-healing verification $ATTEMPT/$MAX ==="
  BASE=$(get_latest_url)
  echo "[*] Testing: $BASE"
  PASS=0
  FAIL=0

  check() {
    local name="$1"
    local url="$2"
    local expected="$3"
    local out
    out=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$out" = "$expected" ]; then
      PASS=$((PASS+1))
      echo "[PASS] $name -> $out"
    else
      FAIL=$((FAIL+1))
      echo "[FAIL] $name -> expected $expected got $out"
    fi
  }

  check "homepage" "$BASE/" "200"
  check "search api" "$BASE/api/search?q=test" "200"
  check "documents api" "$BASE/api/documents?q=test" "200"
  check "health api" "$BASE/api/health" "200"
  check "crawl api (GET)" "$BASE/api/crawl" "404"
  check "chat api (GET)" "$BASE/api/chat" "404"

  echo "PASS=$PASS FAIL=$FAIL"
  
  if [ "$FAIL" -eq 0 ]; then
    echo "ALL CHECKS PASSED at $BASE"
    exit 0
  fi

  echo "[*] Waiting for autoloop to fix and deploy..."
  BASE=$(wait_for_deploy "$BASE")
  ATTEMPT=$((ATTEMPT+1))
done

echo "VERIFICATION FAILED AFTER $MAX ATTEMPTS"
exit 1
