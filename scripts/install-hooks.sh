#!/usr/bin/env sh
# Run this once after cloning: sh scripts/install-hooks.sh
set -e

git config core.hooksPath .husky
chmod +x .husky/pre-commit
echo "✅  Git hooks installed. Pre-commit lint is now active."
