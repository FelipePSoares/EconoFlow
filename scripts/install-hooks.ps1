# Run this once after cloning: .\scripts\install-hooks.ps1
git config core.hooksPath .husky
Write-Host "✅  Git hooks installed. Pre-commit lint is now active."
