#!/bin/bash
# 构建 SOLARIS Android APK（16:9 平板，横屏）
set -euo pipefail

BASE=/Users/yanzhi/.workbuddy/binaries
PROJECT="/Users/yanzhi/Documents/Codex/2026-09-18/superpowers-plugin-superpowers-openai-curated-remote"
NODE_BIN=/Users/yanzhi/.workbuddy/binaries/node/versions/22.22.2-3/bin

NDK_VERSION="$(cat "$BASE/ndk-version.txt" 2>/dev/null || echo 27.0.12077973)"
export JAVA_HOME="$BASE/jdk17"
export ANDROID_HOME="$BASE/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
export PATH="$JAVA_HOME/bin:$NODE_BIN:$PATH"
export NEXT_PUBLIC_TARGET_PLATFORM=android

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
echo "NDK_HOME=$NDK_HOME"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1

cd "$PROJECT"

TARGETS="${1:-aarch64}"

if [ ! -d src-tauri/gen/android ]; then
  echo "== tauri android init =="
  pnpm tauri android init
fi

echo "== tauri android build (target: $TARGETS) =="
pnpm tauri android build --apk --target "$TARGETS"

echo "== 产物 =="
find src-tauri/gen/android/app/build/outputs/apk -name "*.apk" -exec ls -lh {} \;
