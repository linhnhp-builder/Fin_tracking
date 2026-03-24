#!/usr/bin/env bash
# Creates a private GitHub repo and pushes branch main. Requires a PAT (never commit it).
# Usage:
#   export GITHUB_TOKEN=ghp_xxxx   # classic: "repo" scope; fine-grained: Contents + Metadata
#   ./scripts/create-github-repo.sh [repo-name]   # default: fintrackingAI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "Set GITHUB_TOKEN (or GH_TOKEN) to a GitHub personal access token." >&2
  exit 1
fi

NAME="${1:-fintrackingAI}"
if git remote get-url origin &>/dev/null; then
  echo "Remote 'origin' already exists:" >&2
  git remote -v >&2
  exit 1
fi

LOGIN="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/user | python3 -c "import sys,json; print(json.load(sys.stdin)['login'])")"

JSON=$(printf '{"name":"%s","private":true,"description":"FinTrack AI — personal finance app"}' "$NAME")
curl -fsS -X POST "https://api.github.com/user/repos" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$JSON" >/dev/null

git remote add origin "https://github.com/${LOGIN}/${NAME}.git"
git -c http.extraHeader="Authorization: Bearer ${TOKEN}" push -u origin main

echo "Done: https://github.com/${LOGIN}/${NAME} (private)"
