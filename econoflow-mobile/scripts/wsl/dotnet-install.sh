#!/usr/bin/env bash
# Installs the .NET SDK the API targets (net10.0) into $HOME, without root.
# Used to run the API natively in WSL when the container image cannot be built (it needs the
# private Gitea NuGet feed, which takes credentials a WSL run may not have).
set -euo pipefail
PREFIX="${PREFIX:-$HOME/.local}"
CHANNEL="${CHANNEL:-10.0}"

if [ -x "$PREFIX/dotnet/dotnet" ]; then
  echo "dotnet already installed: $($PREFIX/dotnet/dotnet --version)"
  exit 0
fi

# The installer script itself is a download; fetch it with the same no-root helper.
mkdir -p /tmp/dotnet-tools
python3 - <<'PY'
import urllib.request
dest = "/tmp/dotnet-tools/dotnet-install.sh"
urllib.request.urlretrieve("https://dot.net/v1/dotnet-install.sh", dest)
import os; os.chmod(dest, 0o755)
PY
/tmp/dotnet-tools/dotnet-install.sh --channel "$CHANNEL" --install-dir "$PREFIX/dotnet" --no-path
"$PREFIX/dotnet/dotnet" --version

# A line for the environment the runner sources.
grep -q 'PREFIX/dotnet' "$HOME/.android-hosts.env" 2>/dev/null || \
  echo "export PATH=\"$PREFIX/dotnet:\$PATH\"" >> "$HOME/.android-hosts.env"
echo "export DOTNET_CLI_TELEMETRY_OPTOUT=1" >> "$HOME/.android-hosts.env"
