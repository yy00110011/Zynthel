# Zynthel 后端源码审查包

> 生成时间：2026-09-19（品牌已从 SOLARIS 更名 Zynthel，含主题删除/背景图首页化/专注可点击后的最新代码）

> 用途：交给第三方 AI 做后端代码安全/稳定性审查。

> 技术栈：Next.js + Tauri 2（Rust 原生层 + Kotlin Android 插件）+ Web Crypto。

> 平台定位：Android 平板（本地优先工作台）。


## 目录

1. `src-tauri/src/launch.rs` — Rust 原生层：启动资源、URL 校验、应用枚举、IPC 命令

2. `src-tauri/src/lib.rs` — Rust 插件注册（register_android_plugin）

3. `src-tauri/src/main.rs` — Rust 入口

4. `src-tauri/Cargo.toml` — Rust 依赖清单

5. `src-tauri/tauri.conf.json` — Tauri 配置（productName/identifier/CSP）

6. `src-tauri/capabilities/default.json` — Tauri 权限能力

7. `src-tauri/gen/android/app/src/main/java/com/zynthel/workspace/LaunchPlugin.kt` — Kotlin Android 插件：启动应用/打开网址/枚举应用

8. `src-tauri/gen/android/app/src/main/java/com/zynthel/workspace/MainActivity.kt` — Kotlin 主 Activity

9. `src-tauri/gen/android/app/src/main/AndroidManifest.xml` — Android 权限与组件清单

10. `src/features/data/schema.ts` — 数据契约（workspace/settings/theme/工具/启动方式）

11. `src/features/data/repository.ts` — 数据仓库（localStorage + storage key 迁移）

12. `src/features/data/transfer.ts` — 数据导入导出

13. `src/features/data/crypto.ts` — 密码本加密（AES-GCM + PBKDF2 + 密码生成）

14. `src/features/data/ai-schema.ts` — AI 模型配置 schema

15. `src/features/ai/ai-client.ts` — AI 客户端（fetch + 60s 超时）

16. `src/lib/installed-apps.ts` — 应用枚举前端封装（区分空/失败）

17. `src/lib/desktop-launch.ts` — 启动资源前端封装

18. `src/lib/open-launch.ts` — 启动入口

19. `src/lib/runtime.ts` — 运行时检测

20. `src/features/data/life-schema.ts` — 生活工具 schema（含 vault 加密字段）


---


## src-tauri/src/launch.rs

> Rust 原生层：启动资源、URL 校验、应用枚举、IPC 命令

```
rust
use serde::{Deserialize, Serialize};
#[cfg(target_os = "android")]
use tauri::Manager;
#[cfg(not(target_os = "android"))]
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "android"))]
use std::process::Command;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LaunchError {
  InvalidPath,
  MissingApp,
  InvalidArgument,
  CommandNotAllowed,
  InvalidUrl,
  LaunchFailed,
  Unsupported,
}

#[derive(Debug, Deserialize)]
pub struct LaunchEnvelope {
  pub launch: LaunchMethod,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum LaunchMethod {
  Website { url: String },
  MacosApp { app_name: String, path: String },
  AndroidApp { package_name: String, fallback_url: Option<String> },
  LocalPath { path: String },
  CustomCommand { executable: String, args: Vec<String> },
}

#[derive(Debug, Serialize)]
pub struct LaunchResult {
  pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
  pub name: String,
  pub package_name: String,
  pub icon: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppStatus { pub id: String, pub name: String, pub path: String, pub installed: bool }

pub fn validate_url(value: &str) -> Result<(), LaunchError> {
  validate_argument(value)?;
  // 严格 URL 校验：仅允许 http/https，且要求存在合法 host。
  // 拒绝 file:/content:/javascript:/intent:/data:/ftp:/obsidian: 以及空 host 的 malformed URL。
  let parsed = url::Url::parse(value).map_err(|_| LaunchError::InvalidUrl)?;
  match parsed.scheme() {
    "http" | "https" => {
      if parsed.host_str().is_some() { Ok(()) } else { Err(LaunchError::InvalidUrl) }
    }
    _ => Err(LaunchError::InvalidUrl),
  }
}

pub fn validate_argument(value: &str) -> Result<(), LaunchError> {
  if value.contains('\0') || value.contains('\n') || value.contains('\r') {
    Err(LaunchError::InvalidArgument)
  } else {
    Ok(())
  }
}

/* ----------------------------- Android ----------------------------- */

#[cfg(target_os = "android")]
pub mod android {
  use tauri::{plugin::PluginHandle, Runtime};
  use super::{parse_ok_field, InstalledApp, LaunchError, LaunchResult};

  #[derive(Clone)]
  pub struct Launcher<R: Runtime>(pub PluginHandle<R>);

  pub fn call<R: Runtime>(
    handle: &PluginHandle<R>,
    command: &str,
    payload: serde_json::Value,
  ) -> Result<LaunchResult, LaunchError> {
    let response: serde_json::Value = handle
      .run_mobile_plugin(command, payload)
      .map_err(|_| LaunchError::LaunchFailed)?;
    let ok = parse_ok_field(&response)?;
    Ok(LaunchResult { ok })
  }

  pub fn flag<R: Runtime>(
    handle: &PluginHandle<R>,
    command: &str,
    payload: serde_json::Value,
    key: &str,
  ) -> bool {
    handle
      .run_mobile_plugin::<serde_json::Value>(command, payload)
      .ok()
      .and_then(|value| value.get(key).and_then(|entry| entry.as_bool()))
      .unwrap_or(false)
  }

  pub fn apps<R: Runtime>(handle: &PluginHandle<R>) -> Result<Vec<InstalledApp>, LaunchError> {
    let response: serde_json::Value = handle
      .run_mobile_plugin::<serde_json::Value>("listInstalledApps", serde_json::json!({}))
      .map_err(|_| LaunchError::LaunchFailed)?;
    let apps = response
      .get("apps")
      .ok_or(LaunchError::LaunchFailed)?;
    serde_json::from_value::<Vec<InstalledApp>>(apps.clone())
      .map_err(|_| LaunchError::LaunchFailed)
  }
}

/// 严格解析 Kotlin 插件响应里的 `ok` 字段：必须是布尔值，否则视为启动失败。
/// 避免把异常响应（`{}` / `ok` 类型错）误判为成功。
fn parse_ok_field(response: &serde_json::Value) -> Result<bool, LaunchError> {
  match response.get("ok") {
    Some(serde_json::Value::Bool(value)) => Ok(*value),
    _ => Err(LaunchError::LaunchFailed),
  }
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn detect_applications(_app: tauri::AppHandle) -> Vec<AppStatus> {
  // 不预置任何第三方应用检测，应用列表由用户自行添加。
  Vec::new()
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn launch_resource(app: tauri::AppHandle, request: LaunchEnvelope) -> Result<LaunchResult, LaunchError> {
  let state = app.try_state::<android::Launcher<tauri::Wry>>().ok_or(LaunchError::Unsupported)?;
  match request.launch {
    LaunchMethod::Website { url } => {
      validate_url(&url)?;
      android::call(&state.0, "openUrl", serde_json::json!({ "url": url }))
    }
    LaunchMethod::AndroidApp { package_name, fallback_url } => {
      validate_argument(&package_name)?;
      if let Some(url) = fallback_url.as_deref() { validate_url(url)?; }
      android::call(
        &state.0,
        "launchPackage",
        serde_json::json!({ "packageName": package_name, "fallbackUrl": fallback_url }),
      )
    }
    LaunchMethod::MacosApp { .. } | LaunchMethod::LocalPath { .. } | LaunchMethod::CustomCommand { .. } => {
      Err(LaunchError::Unsupported)
    }
  }
}

#[cfg(target_os = "android")]
#[tauri::command]
pub fn list_android_apps(app: tauri::AppHandle) -> Result<Vec<InstalledApp>, LaunchError> {
  let state = app.try_state::<android::Launcher<tauri::Wry>>().ok_or(LaunchError::Unsupported)?;
  android::apps(&state.0)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn list_android_apps() -> Result<Vec<InstalledApp>, LaunchError> {
  Ok(Vec::new())
}

/* ------------------------------ Desktop ---------------------------- */

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn detect_applications() -> Vec<AppStatus> {
  [
    ("krita", "Krita", "/Applications/Krita.app"),
    ("terminal", "Terminal", "/System/Applications/Utilities/Terminal.app"),
    ("finder", "Finder", "/System/Library/CoreServices/Finder.app"),
    ("vscode", "Visual Studio Code", "/Applications/Visual Studio Code.app"),
    ("github-desktop", "GitHub Desktop", "/Applications/GitHub Desktop.app"),
  ].into_iter().map(|(id,name,path)|AppStatus{id:id.into(),name:name.into(),path:path.into(),installed:Path::new(path).exists()}).collect()
}

#[cfg(not(target_os = "android"))]
pub fn validate_path(value: &str) -> Result<PathBuf, LaunchError> {
  validate_argument(value)?;
  let path = PathBuf::from(value);
  if !path.is_absolute() { return Err(LaunchError::InvalidPath); }
  Ok(path)
}

#[cfg(not(target_os = "android"))]
pub fn validate_executable(value: &str) -> Result<(), LaunchError> {
  if matches!(value, "open" | "/usr/bin/open" | "codex") { Ok(()) }
  else { Err(LaunchError::CommandNotAllowed) }
}

#[cfg(not(target_os = "android"))]
fn resolve_executable(value: &str) -> Result<PathBuf, LaunchError> {
  validate_executable(value)?;
  if value == "open" || value == "/usr/bin/open" { return Ok(PathBuf::from("/usr/bin/open")); }
  let mut candidates = vec![PathBuf::from("/opt/homebrew/bin/codex"), PathBuf::from("/usr/local/bin/codex")];
  if let Some(home) = std::env::var_os("HOME") {
    candidates.push(Path::new(&home).join(".local/bin/codex"));
  }
  candidates.into_iter().find(|path| path.exists()).ok_or(LaunchError::CommandNotAllowed)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn launch_resource(request: LaunchEnvelope) -> Result<LaunchResult, LaunchError> {
  let (executable, args) = match request.launch {
    LaunchMethod::Website { url } => {
      validate_url(&url)?;
      (PathBuf::from("/usr/bin/open"), vec![url])
    }
    LaunchMethod::MacosApp { app_name, path } => {
      let app_path = validate_path(&path)?;
      if !app_path.exists() { return Err(LaunchError::MissingApp); }
      validate_argument(&app_name)?;
      (PathBuf::from("/usr/bin/open"), vec!["-a".into(), app_name])
    }
    LaunchMethod::AndroidApp { fallback_url, .. } => {
      let url = fallback_url.ok_or(LaunchError::Unsupported)?;
      validate_url(&url)?;
      (PathBuf::from("/usr/bin/open"), vec![url])
    }
    LaunchMethod::LocalPath { path } => {
      let local_path = validate_path(&path)?;
      if !local_path.exists() { return Err(LaunchError::InvalidPath); }
      (PathBuf::from("/usr/bin/open"), vec![path])
    }
    LaunchMethod::CustomCommand { executable, args } => {
      for argument in &args { validate_argument(argument)?; }
      (resolve_executable(&executable)?, args)
    }
  };
  Command::new(executable)
    .args(args)
    .spawn()
    .map_err(|_| LaunchError::LaunchFailed)?;
  Ok(LaunchResult { ok: true })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rejects_control_characters_in_arguments() {
    assert_eq!(validate_argument("bad\nargument"), Err(LaunchError::InvalidArgument));
    assert!(validate_argument("/Users/example/My Project").is_ok());
  }

  #[test]
  fn accepts_https_urls() {
    assert!(validate_url("https://example.com").is_ok());
    assert!(validate_url("http://example.com").is_ok());
    assert_eq!(validate_url("file:///etc/passwd"), Err(LaunchError::InvalidUrl));
  }

  #[test]
  fn rejects_dangerous_schemes_and_malformed_urls() {
    for bad in [
      "file:///etc/passwd",
      "content://media/external",
      "javascript:alert(1)",
      "intent://scan/#Intent",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/file",
      "obsidian://open?vault=x",
      "not a url",
      "",
      "https://",
      "http://",
    ] {
      assert_eq!(validate_url(bad), Err(LaunchError::InvalidUrl), "should reject: {bad}");
    }
  }

  #[test]
  fn accepts_frontend_camel_case_app_name() {
    let value = serde_json::json!({"type":"macos-app","appName":"Finder","path":"/System/Library/CoreServices/Finder.app"});
    assert!(serde_json::from_value::<LaunchMethod>(value).is_ok());
  }

  #[test]
  fn accepts_android_app_envelope() {
    let value = serde_json::json!({"type":"android-app","packageName":"com.example.app","fallbackUrl":"https://example.com"});
    assert!(serde_json::from_value::<LaunchMethod>(value).is_ok());
  }

  #[cfg(not(target_os = "android"))]
  #[test]
  fn rejects_relative_paths_and_unknown_commands() {
    assert_eq!(validate_path("../secret"), Err(LaunchError::InvalidPath));
    assert_eq!(validate_executable("sh"), Err(LaunchError::CommandNotAllowed));
  }

  #[cfg(not(target_os = "android"))]
  #[test]
  fn accepts_explicit_open_and_codex_commands() {
    assert!(validate_executable("/usr/bin/open").is_ok());
    assert!(validate_executable("open").is_ok());
    assert!(validate_executable("codex").is_ok());
  }
}
```


## src-tauri/src/lib.rs

> Rust 插件注册（register_android_plugin）

```
rust
mod launch;
use tauri::Manager;

#[cfg(target_os = "android")]
fn launcher_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
  tauri::plugin::Builder::new("launcher")
    .setup(|app, api| {
      let handle = api
        .register_android_plugin("com.zynthel.workspace", "LaunchPlugin")
        .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
      app.manage(launch::android::Launcher(handle));
      Ok(())
    })
    .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  #[cfg(target_os = "android")]
  {
    builder = builder.plugin(launcher_plugin());
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![launch::launch_resource, launch::detect_applications, launch::list_android_apps])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```


## src-tauri/src/main.rs

> Rust 入口

```
rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  zynthel_lib::run();
}
```


## src-tauri/Cargo.toml

> Rust 依赖清单

```
toml
[package]
name = "zynthel"
version = "0.1.0"
description = "Zynthel — personal workspace terminal"
authors = ["Zynthel Contributors"]
license = "MIT"
repository = "https://github.com/zynthel/zynthel"
edition = "2021"
rust-version = "1.77.2"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
name = "zynthel_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.6.3", features = [] }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
url = "2"
tauri = { version = "2.11.3", features = [] }
tauri-plugin-log = "2"
```


## src-tauri/tauri.conf.json

> Tauri 配置（productName/identifier/CSP）

```
json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "Zynthel",
  "version": "0.1.0",
  "identifier": "com.zynthel.workspace",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://127.0.0.1:3000",
    "beforeDevCommand": "pnpm dev:web",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "Zynthel",
        "width": 1440,
        "height": 900,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "titleBarStyle": "Overlay"
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: http://127.0.0.1:47135 ipc: http://ipc.localhost",
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["app"],
    "macOS": {
      "minimumSystemVersion": "12.0"
    },
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "android": {
      "debugApplicationIdSuffix": ".debug"
    }
  }
}
```


## src-tauri/capabilities/default.json

> Tauri 权限能力

```
json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Zynthel 主窗口的最小权限",
  "windows": [
    "main"
  ],
  "permissions": [
    "core:default"
  ]
}
```


## src-tauri/gen/android/app/src/main/java/com/zynthel/workspace/LaunchPlugin.kt

> Kotlin Android 插件：启动应用/打开网址/枚举应用

```
kotlin
package com.zynthel.workspace

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Locale

@InvokeArg
class LaunchPackageArgs {
    lateinit var packageName: String
    var fallbackUrl: String? = null
}

@InvokeArg
class OpenUrlArgs {
    lateinit var url: String
}

@TauriPlugin
class LaunchPlugin(private val activity: Activity) : Plugin(activity) {
    // 开源版仅允许 http/https scheme，纵深防御（Rust 已做第一层校验）。
    private val allowedSchemes = setOf("https", "http")

    // IO 协程作用域：主线程外的重任务（应用枚举、图标 Bitmap、Base64）都跑在这里。
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun isAllowedScheme(url: String): Boolean {
        return runCatching {
            Uri.parse(url).scheme?.lowercase(Locale.ROOT)
        }.getOrNull() in allowedSchemes
    }

    private fun start(intent: Intent?) {
        if (intent == null) return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    /** 在 Activity 仍存活时 resolve，避免协程完成后 Activity 已销毁的竞态。 */
    private fun resolveSafely(invoke: Invoke, result: JSObject) {
        activity.runOnUiThread {
            if (!activity.isFinishing && !activity.isDestroyed) invoke.resolve(result)
        }
    }

    private fun rejectSafely(invoke: Invoke, message: String) {
        activity.runOnUiThread {
            if (!activity.isFinishing && !activity.isDestroyed) invoke.reject(message)
        }
    }

    @Command
    fun launchPackage(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val packageManager = activity.packageManager
        var intent = packageManager.getLaunchIntentForPackage(args.packageName)

        if (intent == null && !args.fallbackUrl.isNullOrEmpty()) {
            val fallbackUrl = args.fallbackUrl
            if (!isAllowedScheme(fallbackUrl!!)) {
                rejectSafely(invoke, "unsupported url scheme")
                return
            }
            intent = Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl))
        }

        val result = JSObject()
        if (intent == null) {
            result.put("ok", false)
            resolveSafely(invoke, result)
            return
        }

        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            rejectSafely(invoke, error.message ?: "launch failed")
            return
        }
        resolveSafely(invoke, result)
    }

    @Command
    fun openUrl(invoke: Invoke) {
        val args = invoke.parseArgs(OpenUrlArgs::class.java)
        if (!isAllowedScheme(args.url)) {
            rejectSafely(invoke, "unsupported url scheme")
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.url))
        val result = JSObject()
        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            rejectSafely(invoke, error.message ?: "open url failed")
            return
        }
        resolveSafely(invoke, result)
    }

    private fun iconToBase64(packageName: String, packageManager: PackageManager): String? {
        val bitmap = try {
            val drawable = packageManager.getApplicationIcon(packageName)
            val size = 48
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            bmp
        } catch (error: Exception) {
            return null
        }
        return try {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (error: Exception) {
            null
        } finally {
            bitmap.recycle()
        }
    }

    @Command
    fun listInstalledApps(invoke: Invoke) {
        scope.launch {
            try {
                val packageManager = activity.packageManager
                val launcherIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
                val resolved = packageManager.queryIntentActivities(launcherIntent, 0)
                val seen = HashSet<String>()
                val items = mutableListOf<Pair<String, JSONObject>>()

                for (info in resolved) {
                    val packageName = info.activityInfo?.packageName ?: continue
                    if (packageName == activity.packageName || !seen.add(packageName)) continue
                    val item = JSONObject()
                    item.put("name", info.loadLabel(packageManager).toString())
                    item.put("packageName", packageName)
                    val icon = iconToBase64(packageName, packageManager)
                    if (icon != null) item.put("icon", icon)
                    items.add(Pair(info.loadLabel(packageManager).toString(), item))
                }

                items.sortBy { it.first.lowercase(Locale.getDefault()) }
                val array = JSONArray()
                for (entry in items) array.put(entry.second)

                val result = JSObject()
                result.put("apps", array)
                resolveSafely(invoke, result)
            } catch (error: Exception) {
                rejectSafely(invoke, error.message ?: "list apps failed")
            }
        }
    }

    @Command
    fun isInstalled(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val intent = activity.packageManager.getLaunchIntentForPackage(args.packageName)
        val result = JSObject()
        result.put("installed", intent != null)
        invoke.resolve(result)
    }

    override fun onDestroy(activity: AppCompatActivity) {
        scope.cancel()
        super.onDestroy(activity)
    }
}
```


## src-tauri/gen/android/app/src/main/java/com/zynthel/workspace/MainActivity.kt

> Kotlin 主 Activity

```
kotlin
package com.zynthel.workspace

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
```


## src-tauri/gen/android/app/src/main/AndroidManifest.xml

> Android 权限与组件清单

```
xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- 枚举已安装应用（App Picker）：Android 11+ 需要此权限才能列出完整应用列表。 -->
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />

    <!-- AndroidTV support -->
    <uses-feature android:name="android.software.leanback" android:required="false" />

    <!-- Android 11+ 包可见性：不声明则 ACTION_VIEW https 找不到浏览器应用 -->
    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
    </queries>

    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.zynthel"
        android:usesCleartextTraffic="${usesCleartextTraffic}">
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:launchMode="singleTask"
            android:label="@string/main_activity_title"
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <!-- AndroidTV support -->
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
          android:name="androidx.core.content.FileProvider"
          android:authorities="${applicationId}.fileprovider"
          android:exported="false"
          android:grantUriPermissions="true">
          <meta-data
            android:name="android.support.FILE_PROVIDER_PATHS"
            android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
```


## src/features/data/schema.ts

> 数据契约（workspace/settings/theme/工具/启动方式）

```
typescript
import { z } from "zod";
import {
  ledgerAccountSchema,
  ledgerTransactionSchema,
  workoutSchema,
  fitnessGoalSchema,
  diaryEntrySchema,
  courseSchema,
  termSchema,
  habitSchema,
  habitCheckSchema,
  countdownEventSchema,
  countdownCategorySchema,
  bookSchema,
  vaultMetaSchema,
  vaultEntrySchema,
} from "./life-schema";
import {
  aiModelConfigSchema,
  aiConversationSchema,
} from "./ai-schema";

// 单一默认主题：不再提供多主题切换，theme 固定为 "default"。
export const themeIdSchema = z.enum(["default"]);
export type ThemeId = z.infer<typeof themeIdSchema>;

const timestamp = z.string();

export const todoSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  completed: z.boolean(),
  description: z.string().default(""),
  status: z.enum(["inbox", "todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  tags: z.array(z.string()).default([]),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  dueDate: z.string().nullable(),
  projectId: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  rootPath: z.string(),
  tags: z.array(z.string().trim().min(1)).max(12),
  status: z.enum(["active", "paused", "archived"]),
  progress: z.number().int().min(0).max(100).nullable(),
  githubUrl: z.string(),
  lastOpenedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const websiteLaunchSchema = z.object({ type: z.literal("website"), url: z.string().url() });
const appLaunchSchema = z.object({ type: z.literal("macos-app"), appName: z.string().min(1), path: z.string() });
const androidAppLaunchSchema = z.object({
  type: z.literal("android-app"),
  packageName: z.string().min(1).max(200),
  fallbackUrl: z.string().url().optional(),
});
const pathLaunchSchema = z.object({ type: z.literal("local-path"), path: z.string() });
const commandLaunchSchema = z.object({
  type: z.literal("custom-command"),
  executable: z.string().min(1),
  args: z.array(z.string()).max(30),
});

export const launchMethodSchema = z.discriminatedUnion("type", [
  websiteLaunchSchema,
  appLaunchSchema,
  androidAppLaunchSchema,
  pathLaunchSchema,
  commandLaunchSchema,
]);

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  icon: z.string(),
  launch: launchMethodSchema,
  order: z.number().int().min(0),
  lastOpenedAt: timestamp.nullable(),
});

export const settingsSchema = z.object({
  theme: themeIdSchema,
  reducedMotion: z.boolean(),
  projectRoot: z.string(),
  preferredTerminal: z.string(),
  preferredEditor: z.string(),
  focusDuration: z.number().int().min(1).max(180).default(25),
  sidebarOrder: z.array(z.string()).default([]),
  // 自定义背景图：用户上传的图片以 dataURL/base64 存本地，不打包进 APK。
  // 为空时使用默认几何渐变背景。
  backgroundImage: z.string().default(""),
});

export const calendarEventSchema = z.object({
  id: z.string(), title: z.string().min(1), date: z.string(), time: z.string().default(""),
  description: z.string().default(""), createdAt: timestamp, updatedAt: timestamp,
});

export const noteSchema = z.object({
  id: z.string(), title: z.string().min(1), content: z.string().default(""),
  projectId: z.string().nullable().default(null), tags: z.array(z.string()).default([]),
  createdAt: timestamp, updatedAt: timestamp,
});

export const focusSessionSchema = z.object({
  id: z.string(), taskId: z.string().nullable(), durationMinutes: z.number().int().positive(),
  completedAt: timestamp,
});

export const workspaceSchema = z.object({
  version: z.literal(2),
  projects: z.array(projectSchema),
  todos: z.array(todoSchema),
  tools: z.array(toolSchema).default([]),
  events: z.array(calendarEventSchema).default([]),
  notes: z.array(noteSchema).default([]),
  focusSessions: z.array(focusSessionSchema).default([]),
  settings: settingsSchema,
  recentItems: z.array(z.object({ id: z.string(), type: z.enum(["project", "tool", "ai"]), openedAt: timestamp })),
  // AI 纯配置 + 对话
  aiModels: z.array(aiModelConfigSchema).default([]),
  aiConversations: z.array(aiConversationSchema).default([]),
  // 8 个生活工具
  ledgerAccounts: z.array(ledgerAccountSchema).default([]),
  ledgerTransactions: z.array(ledgerTransactionSchema).default([]),
  workouts: z.array(workoutSchema).default([]),
  fitnessGoals: z.array(fitnessGoalSchema).default([]),
  diaryEntries: z.array(diaryEntrySchema).default([]),
  courses: z.array(courseSchema).default([]),
  terms: z.array(termSchema).default([]),
  habits: z.array(habitSchema).default([]),
  habitChecks: z.array(habitCheckSchema).default([]),
  countdownEvents: z.array(countdownEventSchema).default([]),
  countdownCategories: z.array(countdownCategorySchema).default([]),
  books: z.array(bookSchema).default([]),
  vaultMeta: vaultMetaSchema.nullable().default(null),
  vaultEntries: z.array(vaultEntrySchema).default([]),
  updatedAt: timestamp,
});

export type WorkspaceData = z.infer<typeof workspaceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type TodoItem = z.infer<typeof todoSchema>;
export type ToolItem = z.infer<typeof toolSchema>;
export type LaunchMethod = z.infer<typeof launchMethodSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type NoteItem = z.infer<typeof noteSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type PlatformKind = "android" | "desktop";

export function detectPlatform(): PlatformKind {
  const pinned = process.env.NEXT_PUBLIC_TARGET_PLATFORM;
  if (pinned === "android" || pinned === "desktop") return pinned;
  if (typeof navigator === "undefined") return "desktop";
  return /android/i.test(navigator.userAgent) ? "android" : "desktop";
}

// 默认工具列表为空，不预置任何境内外应用与网站
const DEFAULT_TOOLS: ToolItem[] = [];

export function launchDetail(launch: LaunchMethod): string {
  switch (launch.type) {
    case "website":
      return launch.url;
    case "macos-app":
      return launch.path;
    case "android-app":
      return launch.packageName;
    case "local-path":
      return launch.path;
    case "custom-command":
      return [launch.executable, ...launch.args].join(" ");
  }
}

export function createDefaultWorkspace(
  now = new Date().toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _platform: PlatformKind = detectPlatform(),
): WorkspaceData {
  return {
    version: 2,
    projects: [],
    todos: [],
    events: [],
    notes: [],
    focusSessions: [],
    tools: DEFAULT_TOOLS,
    settings: {
      theme: "default",
      reducedMotion: false,
      projectRoot: "",
      preferredTerminal: "Terminal",
      preferredEditor: "",
      focusDuration: 25,
      sidebarOrder: [],
      backgroundImage: "",
    },
    recentItems: [],
    aiModels: [],
    aiConversations: [],
    ledgerAccounts: [],
    ledgerTransactions: [],
    workouts: [],
    fitnessGoals: [],
    diaryEntries: [],
    courses: [],
    terms: [],
    habits: [],
    habitChecks: [],
    countdownEvents: [],
    countdownCategories: [],
    books: [],
    vaultMeta: null,
    vaultEntries: [],
    updatedAt: now,
  };
}
```


## src/features/data/repository.ts

> 数据仓库（localStorage + storage key 迁移）

```
typescript
import { createDefaultWorkspace, type WorkspaceData, workspaceSchema } from "./schema";

export const STORAGE_KEY = "zynthel.workspace.open";
// Legacy storage key retained solely for local data migration.
// 旧品牌名（SOLARIS）更名后，首次启动时把旧 key 下的数据迁移到新 key，避免用户数据丢失。
export const LEGACY_STORAGE_KEY = "solaris.workspace.open";

export interface WorkspaceRepository {
  get(): WorkspaceData;
  set(next: WorkspaceData): void;
  update(recipe: (current: WorkspaceData) => WorkspaceData): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createWorkspaceRepository(storage?: Storage): WorkspaceRepository {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  const listeners = new Set<() => void>();
  let cache: WorkspaceData | null = null;

  const read = (): WorkspaceData => {
    if (cache) return cache;
    // 数据迁移：新 key 不存在但旧 key 存在时，读取旧数据 → 校验 → 写入新 key。
    if (target && !target.getItem(STORAGE_KEY)) {
      const legacy = target.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          const parsed = workspaceSchema.safeParse(JSON.parse(legacy));
          if (parsed.success) {
            target.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
          }
        } catch {
          // 旧数据非法则忽略，走默认工作区。
        }
      }
    }
    const raw = target?.getItem(STORAGE_KEY);
    if (!raw) return (cache = createDefaultWorkspace());
    try {
      const result = workspaceSchema.safeParse(JSON.parse(raw));
      return (cache = result.success ? result.data : createDefaultWorkspace());
    } catch {
      return (cache = createDefaultWorkspace());
    }
  };

  const set = (next: WorkspaceData) => {
    const validated = workspaceSchema.parse(next);
    const snapshot = structuredClone(validated);
    // 先写盘，成功后再更新内存 cache 并通知监听器。
    // 若 setItem 抛错，则 cache 与 listeners 都不更新，错误向上传播，避免「假保存」。
    target?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    cache = snapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set,
    update: (recipe) => set(recipe(structuredClone(read()))),
    reset: () => set(createDefaultWorkspace()),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const workspaceRepository = createWorkspaceRepository();
```


## src/features/data/transfer.ts

> 数据导入导出

```
typescript
import { type WorkspaceData, workspaceSchema } from "./schema";

export type ImportResult =
  | { ok: true; data: WorkspaceData }
  | { ok: false; error: "invalid-json" | "unsupported-data" };

export function exportWorkspace(data: WorkspaceData): string {
  return JSON.stringify(workspaceSchema.parse(data), null, 2);
}

export function importWorkspace(value: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  const result = workspaceSchema.safeParse(parsed);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: "unsupported-data" };
}
```


## src/features/data/crypto.ts

> 密码本加密（AES-GCM + PBKDF2 + 密码生成）

```
typescript
// 密码本加密工具：使用原生 Web Crypto（AES-GCM 256 + PBKDF2-SHA256）。
// 不引入 crypto-js 等额外依赖，密钥仅存内存，不落盘。

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 派生主密钥：PBKDF2-SHA256，返回 CryptoKey（仅内存）。 */
export async function deriveKey(
  masterPassword: string,
  saltBase64: string,
  iterations: number,
): Promise<CryptoKey> {
  const salt = fromBase64(saltBase64);
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 生成随机的 salt 和 IV。 */
export function generateSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))));
}

export function generateIv(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12))));
}

/** 加密一段明文，返回 base64（ciphertext + auth tag 合并）。 */
export async function encryptText(
  key: CryptoKey,
  ivBase64: string,
  plaintext: string,
): Promise<string> {
  const iv = fromBase64(ivBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  return toBase64(new Uint8Array(encrypted));
}

/** 解密一段 base64 密文，返回明文。失败抛错。 */
export async function decryptText(
  key: CryptoKey,
  ivBase64: string,
  cipherBase64: string,
): Promise<string> {
  const iv = fromBase64(ivBase64);
  const data = fromBase64(cipherBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return decoder.decode(decrypted);
}

/** 生成一个用于校验主密码的 verifier：对固定哨兵串加密。 */
export async function makeVerifier(
  key: CryptoKey,
  ivBase64: string,
): Promise<string> {
  return encryptText(key, ivBase64, "zynthel-vault-verifier");
}

/** 校验主密码是否正确：尝试解密 verifier 并与哨兵比对。 */
export async function verifyMasterPassword(
  masterPassword: string,
  saltBase64: string,
  iterations: number,
  ivBase64: string,
  verifier: string,
): Promise<boolean> {
  try {
    const key = await deriveKey(masterPassword, saltBase64, iterations);
    const plain = await decryptText(key, ivBase64, verifier);
    return plain === "zynthel-vault-verifier";
  } catch {
    return false;
  }
}

/** 随机密码生成器（rejection sampling 消除 modulo bias）。 */
export function generatePassword(length = 16, opts?: {
  upper?: boolean;
  lower?: boolean;
  digits?: boolean;
  symbols?: boolean;
}): string {
  const upper = opts?.upper ?? true;
  const lower = opts?.lower ?? true;
  const digits = opts?.digits ?? true;
  const symbols = opts?.symbols ?? true;
  let pool = "";
  if (upper) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lower) pool += "abcdefghijklmnopqrstuvwxyz";
  if (digits) pool += "0123456789";
  if (symbols) pool += "!@#$%^&*()-_=+";
  if (!pool) pool = "abcdefghijklmnopqrstuvwxyz0123456789";

  // 只有能被 pool.length 均匀映射的随机值才使用，超出范围的直接丢弃重取。
  const limit = Math.floor(256 / pool.length) * pool.length;
  let result = "";
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i] >= limit) continue;
      result += pool[bytes[i] % pool.length];
    }
  }
  return result;
}
```


## src/features/data/ai-schema.ts

> AI 模型配置 schema

```
typescript
import { z } from "zod";

const timestamp = z.string();

/* 用户自定义 AI 模型配置（纯配置入口，不内置任何默认端点/密钥） */
export const aiModelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  provider: z.string().trim().max(40).default("openai"),
  baseUrl: z.string().trim().min(1).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "baseUrl 必须是合法的 http/https 地址"),
  apiKey: z.string(), // 明文存本地（用户已确认）
  model: z.string().trim().min(1).max(80),
  createdAt: timestamp,
});

/* 单条对话消息 */
export const aiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: timestamp,
});

/* 一次对话，按 modelId 隔离历史 */
export const aiConversationSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  title: z.string().trim().max(120).default(""),
  messages: z.array(aiMessageSchema).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type AiModelConfig = z.infer<typeof aiModelConfigSchema>;
export type AiMessage = z.infer<typeof aiMessageSchema>;
export type AiConversation = z.infer<typeof aiConversationSchema>;
```


## src/features/ai/ai-client.ts

> AI 客户端（fetch + 60s 超时）

```
typescript
// AI 客户端：前端直连用户填写的接口地址（OpenAI 兼容协议）。
// 不内置任何 API 端点/密钥，全部由用户自行配置。

import type { AiMessage, AiModelConfig } from "../data/ai-schema";

export class AiClientError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiClientError";
    this.status = status;
  }
}

/** 发送对话请求，返回助手回复文本（非流式）。 */
export async function chatCompletion(
  config: AiModelConfig,
  messages: Array<Pick<AiMessage, "role" | "content">>,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiClientError("请求超时，请稍后重试。");
    }
    throw error;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new AiClientError(detail || `请求失败（HTTP ${response.status}）`, response.status);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new AiClientError("响应格式无法解析");
  }
  return content;
}
```


## src/lib/installed-apps.ts

> 应用枚举前端封装（区分空/失败）

```
typescript
import { isTauriRuntime } from "./runtime";

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null;
};

export type InstalledAppsResult =
  | { status: "ok"; apps: InstalledApp[] }
  | { status: "error"; message: string };

export async function listInstalledApps(): Promise<InstalledAppsResult> {
  if (!isTauriRuntime()) return { status: "ok", apps: [] };
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    // list_android_apps 现在返回 Result<Vec<InstalledApp>, LaunchError>：
    // 成功时是裸数组，失败时 invoke 会 reject。
    const apps = await invoke<InstalledApp[]>("list_android_apps");
    return { status: "ok", apps };
  } catch {
    return { status: "error", message: "获取应用列表失败，请重试。" };
  }
}
```


## src/lib/desktop-launch.ts

> 启动资源前端封装

```
typescript
import type { LaunchMethod } from "@/features/data/schema";
import { isTauriRuntime } from "./runtime";

export type LauncherResult = { ok: boolean; error?: string };
type TauriInvoke = (command: string, args: Record<string, unknown>) => Promise<LauncherResult>;

type LaunchDependencies = {
  tauriInvoke: TauriInvoke | null;
  fetchImpl: typeof fetch;
  openWindow: (url?: string | URL, target?: string, features?: string) => Window | null;
};

async function defaultTauriInvoke(command: string, args: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LauncherResult>(command, args);
}

function defaultDependencies(): LaunchDependencies {
  return {
    tauriInvoke: isTauriRuntime() ? defaultTauriInvoke : null,
    fetchImpl: fetch,
    openWindow: window.open.bind(window),
  };
}

export async function launchResource(
  launch: LaunchMethod,
  dependencies?: LaunchDependencies,
): Promise<LauncherResult> {
  const deps = dependencies ?? defaultDependencies();
  if (deps.tauriInvoke) {
    return deps.tauriInvoke("launch_resource", { request: { launch } });
  }
  if (launch.type === "website") {
    deps.openWindow(launch.url, "_blank", "noopener,noreferrer");
    return { ok: true };
  }
  const response = await deps.fetchImpl("http://127.0.0.1:47135/launch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ launch }),
  });
  return response.json() as Promise<LauncherResult>;
}
```


## src/lib/open-launch.ts

> 启动入口

```
typescript
import type { LaunchMethod } from "@/features/data/schema";
import { launchResource } from "./desktop-launch";

export async function openLaunch(launch: LaunchMethod) {
  return launchResource(launch);
}
```


## src/lib/runtime.ts

> 运行时检测

```
typescript
export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}
```


## src/features/data/life-schema.ts

> 生活工具 schema（含 vault 加密字段）

```
typescript
import { z } from "zod";

const timestamp = z.string();

/* ===== 记账本 bookkeeping ===== */
export const ledgerAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  icon: z.string().default("wallet"),
  createdAt: timestamp,
});

export const ledgerTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int(), // 金额以「分」存储，避免浮点误差
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(40),
  accountId: z.string().min(1),
  date: z.string(), // YYYY-MM-DD
  note: z.string().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: timestamp,
});

/* ===== 健身打卡 fitness ===== */
export const workoutSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  exercise: z.string().trim().min(1).max(60),
  durationMinutes: z.number().int().positive(),
  sets: z.number().int().min(0).default(0),
  reps: z.number().int().min(0).default(0),
  note: z.string().default(""),
  createdAt: timestamp,
});

export const fitnessGoalSchema = z.object({
  id: z.string().min(1),
  period: z.enum(["weekly", "monthly"]),
  targetMinutes: z.number().int().positive(),
  targetDays: z.number().int().positive(),
});

/* ===== 日记 diary ===== */
export const diaryEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  title: z.string().trim().max(120).default(""),
  body: z.string().default(""),
  mood: z.enum(["great", "good", "okay", "low", "bad"]),
  weather: z.string().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/* ===== 课程表 schedule ===== */
export const courseSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  room: z.string().default(""),
  teacher: z.string().default(""),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string(),
  endTime: z.string(),
  weeks: z.array(z.number().int().min(1)).default([]),
  termId: z.string().default(""),
  createdAt: timestamp,
});

export const termSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  startDate: z.string(),
  endDate: z.string(),
});

/* ===== 习惯打卡 habits ===== */
export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  icon: z.string().default("droplet"),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  remind: z.boolean().default(false),
  createdAt: timestamp,
});

export const habitCheckSchema = z.object({
  habitId: z.string().min(1),
  date: z.string(),
  done: z.boolean(),
});

/* ===== 倒数日 countdown ===== */
export const countdownEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  targetDate: z.string(),
  mode: z.enum(["countdown", "countup"]).default("countdown"),
  pinned: z.boolean().default(false),
  repeatRule: z.enum(["none", "annual"]).default("none"),
  categoryId: z.string().default(""),
  createdAt: timestamp,
});

export const countdownCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  icon: z.string().default("flag"),
});

/* ===== 阅读清单 readingList ===== */
export const bookSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().max(120).default(""),
  status: z.enum(["want", "reading", "finished"]).default("want"),
  rating: z.number().int().min(0).max(5).default(0),
  progress: z.number().int().min(0).max(100).default(0),
  note: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/* ===== 密码本 vault ===== */
export const vaultMetaSchema = z.object({
  salt: z.string(),
  iv: z.string(),
  // 限制合理范围，防止损坏/恶意导入的极端 iterations 导致解锁长时间卡死。
  iterations: z.number().int().min(100_000).max(1_000_000),
  verifier: z.string(), // 用于校验主密码是否正确
});

export const vaultEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  username: z.string().default(""),
  passwordCipher: z.string(), // AES-GCM 加密后的 base64
  urlCipher: z.string(),
  noteCipher: z.string(),
  // 每个敏感字段独立 IV（默认空字符串兼容旧数据，旧数据回退 vaultMeta.iv 解密）。
  passwordIv: z.string().default(""),
  urlIv: z.string().default(""),
  noteIv: z.string().default(""),
  category: z.string().default(""),
  createdAt: timestamp,
});

export type LedgerAccount = z.infer<typeof ledgerAccountSchema>;
export type LedgerTransaction = z.infer<typeof ledgerTransactionSchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type FitnessGoal = z.infer<typeof fitnessGoalSchema>;
export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type Course = z.infer<typeof courseSchema>;
export type Term = z.infer<typeof termSchema>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitCheck = z.infer<typeof habitCheckSchema>;
export type CountdownEvent = z.infer<typeof countdownEventSchema>;
export type CountdownCategory = z.infer<typeof countdownCategorySchema>;
export type Book = z.infer<typeof bookSchema>;
export type VaultMeta = z.infer<typeof vaultMetaSchema>;
export type VaultEntry = z.infer<typeof vaultEntrySchema>;
```

---

## 附：审查重点与已知情况（供第三方 AI 参考）

### 已完成的加固（请复核是否到位、有无遗漏/回归）

1. **AES-GCM 每字段独立 IV**（`crypto.ts` + `life-schema.ts` vaultEntrySchema）：password/url/note 各用独立 `generateIv()`，解密 `entry.passwordIv || vaultMeta.iv` 回退兼容旧数据。
2. **URL 严格校验**（`launch.rs` validate_url + `LaunchPlugin.kt` isAllowedScheme）：仅 http/https 且要求合法 host；Kotlin 侧二次校验（纵深防御）。拒绝 file/content/javascript/intent/data/ftp/obsidian。
3. **IPC Result 错误传播**：`list_android_apps` 返回 `Result<Vec<InstalledApp>, LaunchError>`，前端 `installed-apps.ts` 区分空列表 vs 失败。
4. **Android 应用枚举移出主线程**：`LaunchPlugin.kt` listInstalledApps 用 `CoroutineScope(SupervisorJob()+Dispatchers.IO)` + `runOnUiThread` 回主线程 resolve。
5. **生命周期安全**：`resolveSafely`/`rejectSafely`（`!isFinishing && !isDestroyed`），`onDestroy(activity)` 里 `scope.cancel()`。
6. **Bitmap finally recycle**：`iconToBase64` 的 `bitmap.recycle()` 在 finally 中。
7. **repository 先写盘**：`set()` 先 `setItem` 成功再更新 cache + 通知，失败抛出。
8. **PBKDF2 iterations 范围**：100k–1M（`life-schema.ts` vaultMetaSchema）。
9. **密码生成 rejection sampling**：消除 modulo bias（`crypto.ts` generatePassword）。
10. **CSP**：`tauri.conf.json` connect-src 已加 `https:`。
11. **AI baseUrl 校验**：`ai-schema.ts` 仅 http/https。
12. **AI 60s 超时**：`ai-client.ts` AbortController + AbortError → "请求超时"。
13. **Storage Key 迁移**：`repository.ts` 新增 `LEGACY_STORAGE_KEY`（`solaris.workspace.open`），首次启动读旧→校验→写新（`zynthel.workspace.open`）。

### 已知/待审点（如实标注）

1. **`flag()` 用 `unwrap_or(false)`**（`launch.rs` android::flag）：查询失败与"未安装"无法区分，但该函数**前端无调用方**（`detect_applications` 对 Android 返回空 Vec），故有意保留，属 P2。
2. **`isInstalled` 命令**（`LaunchPlugin.kt`）直接 `invoke.resolve(result)`，未用 `resolveSafely`（同步路径，无协程竞态，但可复核是否有 Activity 已销毁的边界）。
3. **API Key 明文存储**（`ai-schema.ts` apiKey）：用户已确认接受明文存本地 localStorage（非系统 Keystore 级别），导出 JSON 备份会包含明文 key。
4. **AI 无重试/流式**：`ai-client.ts` 仅非流式 + 单次超时，无重试、无 SSE。
5. **desktop-launch.ts 的 fallback**：非 Tauri 环境走 `http://127.0.0.1:47135/launch`（本地启动器 server），需复核该端点的鉴权/安全。
6. **CSP `script-src 'self'`**：未加 `'unsafe-inline'`（本项目为 Tauri 本地 WebView，无外部注入风险，但可复核 Next.js 静态导出是否有内联脚本被拦）。
7. **QUERY_ALL_PACKAGES 权限**：仅用于 App Picker 枚举应用，会触发 Google Play 政策审核（本项目定位 sideload + GitHub 分发，已如实记录）。

### 明确不变更（任务书约定）

- 不恢复 Obsidian / obsidian:// scheme、不恢复境外服务。
- 不做 UI 重构、不新增功能、不恢复已删的 3 个主题。
- 背景图仅作用于首页，其他页面不变。

