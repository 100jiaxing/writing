#!/usr/bin/env bash
set -euo pipefail

npm run build

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This folder is not a git repository yet."
  echo "Run the first-time setup commands in README.md, then run npm run publish again."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Git remote origin is missing."
  echo "Add it with: git remote add origin git@github.com:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
  exit 1
fi

branch=$(git branch --show-current)
if [[ -z "$branch" ]]; then
  echo "Cannot publish while Git is in detached HEAD state."
  exit 1
fi

git add posts public site.config.json scripts package.json README.md .github .gitignore

if ! git diff --cached --quiet; then
  message=${1:-"Publish writing $(date +%Y-%m-%d)"}
  git commit -m "$message"
else
  echo "No new local changes to commit."
fi

echo "Syncing with origin/$branch before pushing..."
git pull --rebase --autostash origin "$branch"
git push origin "$branch"
