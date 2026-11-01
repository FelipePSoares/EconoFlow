#!/usr/bin/env bash
#
# Prepares a WSL2 Ubuntu distro to build the Android debug + androidTest APKs of this app,
# and to run the Detox suite against an emulator.
#
# Why this exists: the Windows build of this checkout fails in CMake's ninja step with
# "Filename longer than 260 characters" (see ../setup.md — moving the checkout closer to
# the drive root does not help, the fixed part of the path is already ~310 characters).
# WSL2 is a real Linux, so the limit does not apply there — this script sets that distro up
# from nothing.
#
# It needs **no sudo**: Node, the JDK and the Android SDK all install into $HOME. That keeps
# it runnable unattended (`wsl.exe -d Ubuntu -- bash scripts/wsl/setup.sh`) and cannot
# disturb anything else on the machine. It uses only what a fresh Ubuntu ships (python3,
# tar) — see boxdl.py for why.
#
# What it does:
#   1. Node 20 into ~/.local/node (the version the lockfile expects)
#   2. JDK 17 (Temurin) into ~/.local/jdk-17 — the Android Gradle plugin's floor
#   3. Android SDK into ~/android-sdk: platform-tools, platforms;android-35,
#      build-tools;35.0.0, cmake;3.22.1, ndk;27.1.12297006
#   4. ~/.android-hosts.env, sourced by run-in-wsl.sh, with PATH and ANDROID_HOME
#
# The SDK licences are accepted by the script, which is right for a developer machine.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${PREFIX:-$HOME/.local}"
NODE_VERSION="${NODE_VERSION:-20.19.5}"
JDK_DIR="$PREFIX/jdk-17"
SDK_DIR="${ANDROID_HOME:-$HOME/android-sdk}"
ENV_FILE="$HOME/.android-hosts.env"

BOXDL="python3 $HERE/boxdl.py"

say() { printf '\n==> %s\n' "$*"; }

# ── 1. Node ────────────────────────────────────────────────────────────────────
say "Node $NODE_VERSION"
if [ ! -x "$PREFIX/node/bin/node" ]; then
  mkdir -p "$PREFIX/node"
  $BOXDL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    "$PREFIX/node" --strip 1
fi
export PATH="$PREFIX/node/bin:$PATH"
node -v

# ── 2. JDK ─────────────────────────────────────────────────────────────────────
say "JDK 17"
if [ ! -x "$JDK_DIR/bin/java" ]; then
  mkdir -p "$JDK_DIR"
  $BOXDL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    "$JDK_DIR" --strip 1
fi
export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"
java -version 2>&1 | head -1

# ── 3. Android SDK ─────────────────────────────────────────────────────────────
say "Android SDK in $SDK_DIR"
mkdir -p "$SDK_DIR/cmdline-tools"
if [ ! -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  $BOXDL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" \
    "$SDK_DIR/cmdline-tools/latest" --strip 1
fi
export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

yes | sdkmanager --licenses >/dev/null 2>&1 || true
# The versions the project pins (android/build.gradle): compileSdk 35, the AGP's
# build-tools, and the NDK/CMake React Native 0.88 compiles with.
sdkmanager --install \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "cmake;3.22.1" \
  "ndk;27.1.12297006" >/dev/null

# ── 4. Environment for the runner ──────────────────────────────────────────────
say "Writing $ENV_FILE"
{
  echo "# Written by econoflow-mobile/scripts/wsl/setup.sh — sourced by run-in-wsl.sh."
  echo "export PATH=\"$PREFIX/node/bin:$JDK_DIR/bin:$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:\$PATH\""
  echo "export JAVA_HOME=\"$JDK_DIR\""
  echo "export ANDROID_HOME=\"$SDK_DIR\""
  echo "export ANDROID_SDK_ROOT=\"$SDK_DIR\""
} > "$ENV_FILE"

say "Done"
echo "node:  $(node -v)"
echo "java:  $(java -version 2>&1 | head -1)"
echo "sdk:   $SDK_DIR"
echo "next:  scripts/wsl/run-in-wsl.sh sync && scripts/wsl/run-in-wsl.sh build"
