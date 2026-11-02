#!/usr/bin/env bash
# One-off, privileged preparation of the WSL Ubuntu for a self-contained Detox run.
#
# The run is meant to live entirely inside Ubuntu — the API stack (Postgres, MinIO, the
# app), the emulator and the suite — so Windows and Docker Desktop play no part. Everything
# that installs into $HOME does so without root (setup.sh); this is the part that needs root:
#
#   * the native libraries the Android **emulator** links against (libpulse, libGL, the X11
#     cursor/glib stack — a server Ubuntu has none, and the emulator refuses to start
#     without them even headless);
#   * read access to KVM: `/dev/kvm` is `root:kvm 0660` and the WSL user is not in `kvm`; a
#     udev rule makes that survive a reboot instead of a one-off `chgrp`;
#   * Docker **inside this distro** — a real `dockerd`, not Docker Desktop's client that
#     lives on /mnt/c and needs Windows running. The whole point of running the stack here is
#     that nothing on the Windows side is required.
#
# Runs as root (`wsl.exe -d Ubuntu -u root -- bash scripts/wsl/bootstrap.sh`): WSL needs no
# password for that, and it leaves the user's own sudo untouched.
set -euo pipefail

TARGET_USER="${TARGET_USER:-felipe}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  libpulse0 libx11-6 libxcb1 libxcomposite1 libxcursor1 libxi6 libxtst6 libnss3 \
  libgl1 libglu1-mesa libxrandr2 libxdamage1 libgbm1 libasound2t64 udev unzip

# ── KVM ───────────────────────────────────────────────────────────────────────
usermod -aG kvm "$TARGET_USER"
cat > /etc/udev/rules.d/99-kvm-wsl.rules <<'RULE'
KERNEL=="kvm", GROUP="kvm", MODE="0660"
RULE
chgrp kvm /dev/kvm && chmod 660 /dev/kvm

# ── Docker engine, inside this distro ─────────────────────────────────────────
# Docker's own repository (not Ubuntu's docker.io, which lags the API the Compose file uses).
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  apt-get install -y -qq --no-install-recommends ca-certificates curl gnupg
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
fi
apt-get install -y -qq --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker "$TARGET_USER"

# WSL runs systemd, so the engine is a normal service — and it starts every boot.
systemctl enable docker >/dev/null 2>&1 || true
systemctl start docker
sleep 2
docker version --format 'docker engine {{.Server.Version}}' || systemctl status docker --no-pager | head -20

echo "bootstrap done — $TARGET_USER groups: $(id -nG "$TARGET_USER")"
echo "note: a new shell (or 'wsl --terminate Ubuntu') is needed for the docker group to apply"
