#!/usr/bin/env bash
# Checks whether the Gitea credentials in ~/econoflow-repo/.env still authenticate against the
# private NuGet feed. The Docker image build needs them; an expired token fails the restore
# with NU1301 / 401 and looks like a Dockerfile problem.
#
#   scripts/wsl/gitea-check.sh
set -u
cd "$HOME/econoflow-repo" || exit 1

read_pair() { awk -F= -v k="$1" '$1 == k { sub(/^[^=]*=/, ""); gsub(/\r/, ""); print; exit }' .env; }
token=$(read_pair GITEA_NUGET_TOKEN)
user=$(read_pair GITEA_NUGET_USERNAME)

echo "user:  ${user:-<missing>}"
echo "token: ${#token} chars"
[ -n "$token" ] || { echo "no token in .env" >&2; exit 1; }

code=$(curl -s -o /dev/null -w '%{http_code}' -u "$user:$token" \
  https://gitea.fpssoftware.uk/api/packages/fps-software/nuget/index.json)
echo "feed:  HTTP $code"
case "$code" in
  200) echo "OK — the credentials still work" ;;
  401|403) echo "EXPIRED/REJECTED — refresh GITEA_NUGET_TOKEN in .env" >&2; exit 2 ;;
  *) echo "unexpected status" >&2; exit 3 ;;
esac
