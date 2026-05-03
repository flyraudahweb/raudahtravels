#!/usr/bin/env bash
set -euo pipefail

echo "=== Installing pnpm ==="
npm install -g pnpm

echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile || pnpm install

echo "=== Building API server ==="
pnpm --filter @workspace/api-server run build

echo "=== Building frontend ==="
pnpm --filter @workspace/raudah-travels run build

echo "=== Build complete ==="
echo "API server:  artifacts/api-server/dist/index.mjs"
echo "Frontend:    artifacts/raudah-travels/dist/public/"
