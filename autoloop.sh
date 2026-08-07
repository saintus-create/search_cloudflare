#!/bin/bash
set -euo pipefail

PROJECT="/Users/2024-jan/Downloads/cloudflare-search-portal"
cd "$PROJECT"

while true; do
  echo "=== $(date) ==="

  # 1. Ensure deps
  if [ ! -d node_modules ]; then
    echo "[*] Installing dependencies..."
    pnpm install
  fi

  # 2. Fix Tailwind v4 -> v3 if needed
  if [ -f node_modules/.pnpm/tailwindcss@4*/node_modules/tailwindcss/dist/lib.mjs ]; then
    echo "[*] Detected Tailwind v4, switching to v3..."
    pnpm add -D tailwindcss@3 postcss autoprefixer 2>/dev/null || true
    cat > postcss.config.mjs << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF
    cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: { extend: {} },
  plugins: [],
};
EOF
  fi

  # 3. Ensure pnpm-workspace.yaml allows builds
  if [ -f pnpm-workspace.yaml ]; then
    if ! grep -q "esbuild: true" pnpm-workspace.yaml; then
      echo "[*] Updating pnpm-workspace.yaml allowBuilds..."
      cat > pnpm-workspace.yaml << 'EOF'
allowBuilds:
  esbuild: true
  sharp: true
  workerd: true
EOF
    fi
  fi

  # 4. Build
  echo "[*] Building..."
  if pnpm run build; then
    echo "[+] Build succeeded"
  else
    echo "[!] Build failed, retrying in 10s..."
    sleep 10
    continue
  fi

  # 5. Deploy
  echo "[*] Deploying to Cloudflare Pages..."
  if npx wrangler pages deploy ./dist; then
    echo "[+] Deploy succeeded"
  else
    echo "[!] Deploy failed, retrying in 10s..."
    sleep 10
    continue
  fi

  # 6. Wait before next iteration
  echo "[*] Sleeping 60s before next loop..."
  sleep 60
done
