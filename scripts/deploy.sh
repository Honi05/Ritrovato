#!/usr/bin/env bash
# Деплой main на сервер: rsync → docker compose up → проверка /api/health.
# Значения берутся из .env.deploy (не в Git): DEPLOY_HOST, DEPLOY_DIR, PUBLIC_URL.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source .env.deploy

[ "$(git branch --show-current)" = main ] || { echo "deploy only from main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean"; exit 1; }

rsync -az --delete \
  --exclude .git --exclude '.env*' --exclude node_modules --exclude .venv \
  --exclude data --exclude docs --exclude .claude \
  ./ "$DEPLOY_HOST:$DEPLOY_DIR/app/"
ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR/app && cp -n ../.env .env 2>/dev/null; docker compose up -d --build"

for _ in $(seq 1 30); do
  curl -fsS "$PUBLIC_URL/api/health" && { echo; echo "DEPLOYED $(git rev-parse --short HEAD)"; exit 0; }
  sleep 2
done
echo "DEPLOY FAILED"; ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR/app && docker compose logs --tail 50"; exit 1
