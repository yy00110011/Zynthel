#!/bin/bash
# 构建 Zynthel Android APK（16:9 平板，横屏）
# 依赖环境变量：JAVA_HOME / ANDROID_HOME / ANDROID_SDK_ROOT / NDK_HOME / NODE_BIN
# 未设置时可在下方 BASE 处指定你的本地工具链根目录。
set -euo pipefail

# 项目根目录（脚本位于 scripts/，上一级即项目根）
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

# 本地工具链根目录：指向包含 jdk17/、android-sdk/、node/versions/ 的目录。
# 请按你的本机安装位置修改，或通过环境变量传入。
BASE="${ZYNTHEL_TOOLCHAIN:-}"
NODE_BIN="$(command -v node >/dev/null 2>&1 && dirname "$(command -v node)" || echo "/usr/local/bin")"

if [ -z "$BASE" ]; then
  echo "提示：未设置 ZYNTHEL_TOOLCHAIN 或 BASE，将使用环境变量中的 JAVA_HOME/ANDROID_HOME。"
fi

NDK_VERSION="${NDK_VERSION:-27.0.12077973}"
: "${JAVA_HOME:?请设置 JAVA_HOME}"
: "${ANDROID_HOME:?请设置 ANDROID_HOME}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export NDK_HOME="${NDK_HOME:-$ANDROID_HOME/ndk/$NDK_VERSION}"
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
