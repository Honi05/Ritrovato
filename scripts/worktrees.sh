#!/usr/bin/env bash
# Создаёт worktree для двух билдеров рядом с репозиторием: ../Hackaton-wt/{back,front}.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
wt="../$(basename "$PWD")-wt"
for side in back front; do
  if [ -d "$wt/$side" ]; then echo "exists: $wt/$side"; continue; fi
  git worktree add "$wt/$side" -b "feat/$side" main 2>/dev/null \
    || git worktree add "$wt/$side" "feat/$side"
done
git worktree list
