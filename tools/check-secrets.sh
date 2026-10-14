#!/bin/sh
# Fail if any git-tracked file looks like it holds a credential or a personal path.
# Run before every push: make check-secrets
set -eu
cd "$(dirname "$0")/.."
pattern='sk-or-v[0-9]+-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{30,}|\b[0-9a-f]{40,}\b|/home/[a-z_][a-z0-9_-]*/|/Users/[A-Za-z]'
if git ls-files -z | xargs -0 grep -nIE "$pattern" --; then
  echo "check-secrets: possible credential or personal path above; remove it before pushing." >&2
  exit 1
fi
echo "check-secrets: clean"
