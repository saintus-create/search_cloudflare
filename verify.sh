#!/bin/bash
set -u

BASE="https://6f5cf266.cloudflare-search-portal.pages.dev"
ATTEMPT=1
MAX=60

while [ $ATTEMPT -le $MAX ]; do
  echo "=== Self-healing verification $ATTEMPT/$MAX ==="
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

  check_json() {
    local name="$1"
    local url="$2"
    local out
    out=$(curl -s "$url" 2>/dev/null || echo "")
    if echo "$out" | grep -q '"results"'; then
      PASS=$((PASS+1))
      echo "[PASS] $name -> results present"
    else
      FAIL=$((FAIL+1))
      echo "[FAIL] $name -> body: ${out:0:120}"
    fi
  }

  check "homepage" "$BASE/" "200"
  check "search api" "$BASE/api/search?q=test" "200"
  check "documents api" "$BASE/api/documents?q=test" "200"
  check "health api" "$BASE/api/health" "200"
  check "crawl api (GET)" "$BASE/api/crawl" "404"
  check "chat api (GET)" "$BASE/api/chat" "404"
  check_json "search json" "$BASE/api/search?q=test"
  check_json "documents json" "$BASE/api/documents?q=test"
  check_json "health json" "$BASE/api/health"

  CRAWLS=0
  if [ -f /Users/2024-jan/Downloads/cloudflare-search-portal/src/pages/api/crawl.ts ]; then
    CRAWLS=1
    TOTAL=$((TOTAL+1))
    local out
    out=$(curl -s -X POST -H "Content-Type: application/json" -d '{"url":"https://example.com"}' "$BASE/api/crawl" 2>/dev/null || echo "")
    if echo "$out" | grep -q '"success"\|"error"'; then
      PASS=$((PASS+1))
      echo "[PASS] crawl -> response received"
    else
      FAIL=$((FAIL+1))
      echo "[FAIL] crawl -> body: ${out:0:120}"
    fi
  fi

  CHATS=0
  if [ -f /Users/2024-jan/Downloads/cloudflare-search-portal/src/pages/api/chat.ts ]; then
    CHATS=1
    TOTAL=$((TOTAL+1))
    local out
    out=$(curl -s -X POST -H "Content-Type: application/json" -d '{"message":"hello"}' "$BASE/api/chat" 2>/dev/null || echo "")
    if echo "$out" | grep -q '"answer"\|"error"'; then
      PASS=$((PASS+1))
      echo "[PASS] chat -> response received"
    else
      FAIL=$((FAIL+1))
      echo "[FAIL] chat -> body: ${out:0:120}"
    fi
  fi

  echo "PASS=$PASS FAIL=$FAIL"
  
  if [ "$FAIL" -eq 0 ]; then
    echo "ALL CHECKS PASSED"
    exit 0
  fi

  ATTEMPT=$((ATTEMPT+1))
  
  if [ $((ATTEMPT % 5)) -eq 0 ]; then
    echo "[*] Checking if autoloop deployed new version..."
    LATEST=$(curl -sI "$BASE/" 2>/dev/null | grep -i "cf-cache-status\|age:" | head -1)
    echo "[*] Latest deploy indicator: $LATEST"
  fi

  sleep 10
done

echo "VERIFICATION FAILED AFTER $MAX ATTEMPTS"
exit 1
