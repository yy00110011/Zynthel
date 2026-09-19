# SOLARIS 开源版 —— 后端源码审查包
> 供第三方 AI / 开发者进行代码安全与正确性审查。
> 项目：本地优先个人工作台（Tauri 2 + Next.js），Android 优先，MIT 开源分发。
> 开源版：合规减法版（无 Obsidian、无境外 AI 服务、主题用中性名、版权素材已剥离）。
> 与内测版差异：包名 com.solaris.opensource、STORAGE_KEY solaris.workspace.open、无 obsidian:// scheme、无 ai-center/services 境外服务、主题保留 3 个但改中性名。

---

## 文件：`src-tauri/src/main.rs`

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  solaris_lib::run();
}

```

---

## 文件：`src-tauri/src/lib.rs`

```rust
mod launch;
use tauri::Manager;

#[cfg(target_os = "android")]
fn launcher_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
  tauri::plugin::Builder::new("launcher")
    .setup(|app, api| {
      let handle = api
        .register_android_plugin("com.solaris.opensource", "LaunchPlugin")
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

---

## 文件：`src-tauri/src/launch.rs`

```rust
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
  if value.starts_with("https://") || value.starts_with("http://") {
    Ok(())
  } else {
    Err(LaunchError::InvalidUrl)
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
  use tauri::{plugin::PluginHandle, Manager, Runtime};
  use super::{InstalledApp, LaunchError, LaunchResult};

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
pub fn list_android_apps(app: tauri::AppHandle) -> Vec<InstalledApp> {
  match app.try_state::<android::Launcher<tauri::Wry>>() {
    Some(state) => android::apps(&state.0),
    None => Vec::new(),
  }
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn list_android_apps() -> Vec<InstalledApp> {
  Vec::new()
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

---

## 文件：`src-tauri/Cargo.toml`

```toml
[package]
name = "solaris"
version = "0.1.0"
description = "SOLARIS Personal Resonance Terminal"
authors = ["SOLARIS Project Contributors"]
license = "MIT"
repository = "https://github.com/solaris-terminal/solaris"
edition = "2021"
rust-version = "1.77.2"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
name = "solaris_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.6.3", features = [] }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2.11.3", features = [] }
tauri-plugin-log = "2"


```

---

## 文件：`src-tauri/tauri.conf.json`

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "SOLARIS Open",
  "version": "0.1.0",
  "identifier": "com.solaris.opensource",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://127.0.0.1:3000",
    "beforeDevCommand": "pnpm dev:web",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "SOLARIS Open",
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
      "csp": "default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://127.0.0.1:47135 ipc: http://ipc.localhost",
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

---

## 文件：`src-tauri/gen/android/app/src/main/java/com/solaris/opensource/LaunchPlugin.kt`

```kotlin
package com.solaris.opensource

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
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
    private fun start(intent: Intent?) {
        if (intent == null) return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    @Command
    fun launchPackage(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val packageManager = activity.packageManager
        var intent = packageManager.getLaunchIntentForPackage(args.packageName)

        if (intent == null && !args.fallbackUrl.isNullOrEmpty()) {
            intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.fallbackUrl))
        }

        val result = JSObject()
        if (intent == null) {
            result.put("ok", false)
            invoke.resolve(result)
            return
        }

        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "launch failed")
            return
        }
        invoke.resolve(result)
    }

    @Command
    fun openUrl(invoke: Invoke) {
        val args = invoke.parseArgs(OpenUrlArgs::class.java)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.url))
        val result = JSObject()
        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "open url failed")
            return
        }
        invoke.resolve(result)
    }

    private fun iconToBase64(packageName: String, packageManager: PackageManager): String? {
        return try {
            val drawable = packageManager.getApplicationIcon(packageName)
            val size = 48
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            bitmap.recycle()
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (error: Exception) {
            null
        }
    }

    @Command
    fun listInstalledApps(invoke: Invoke) {
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
        invoke.resolve(result)
    }

    @Command
    fun isInstalled(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val intent = activity.packageManager.getLaunchIntentForPackage(args.packageName)
        val result = JSObject()
        result.put("installed", intent != null)
        invoke.resolve(result)
    }
}

```

---

## 文件：`src-tauri/gen/android/app/src/main/java/com/solaris/opensource/MainActivity.kt`

```kotlin
package com.solaris.opensource

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}

```

---

## 文件：`src-tauri/gen/android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- AndroidTV support -->
    <uses-feature android:name="android.software.leanback" android:required="false" />

    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.solaris"
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

---

## 文件：`src/features/data/schema.ts`

```typescript
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

export const themeIdSchema = z.enum(["peach-bloom", "dark-purple", "ember"]);
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
      theme: "peach-bloom",
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

---

## 文件：`src/features/data/repository.ts`

```typescript
import { createDefaultWorkspace, type WorkspaceData, workspaceSchema } from "./schema";

export const STORAGE_KEY = "solaris.workspace.open";

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
    cache = structuredClone(validated);
    target?.setItem(STORAGE_KEY, JSON.stringify(cache));
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

---

## 文件：`src/features/data/crypto.ts`

```typescript
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
  return encryptText(key, ivBase64, "solaris-vault-verifier");
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
    return plain === "solaris-vault-verifier";
  } catch {
    return false;
  }
}

/** 随机密码生成器。 */
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
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += pool[bytes[i] % pool.length];
  }
  return result;
}

```

---

## 文件：`src/features/data/ai-schema.ts`

```typescript
import { z } from "zod";

const timestamp = z.string();

/* 用户自定义 AI 模型配置（纯配置入口，不内置任何默认端点/密钥） */
export const aiModelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  provider: z.string().trim().max(40).default("openai"),
  baseUrl: z.string().trim().min(1),
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

---

## 文件：`src/features/data/life-schema.ts`

```typescript
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
  iterations: z.number().int().positive(),
  verifier: z.string(), // 用于校验主密码是否正确
});

export const vaultEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  username: z.string().default(""),
  passwordCipher: z.string(), // AES-GCM 加密后的 base64
  urlCipher: z.string(),
  noteCipher: z.string(),
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

## 文件：`src/features/data/transfer.ts`

```typescript
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

---

## 文件：`src/features/ai/ai-client.ts`

```typescript
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
  const response = await fetch(endpoint, {
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
  });

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

---

## 文件：`src/features/life/vault-page.tsx`

```tsx
"use client";

import { Plus, Trash2, KeyRound, Lock, Shield, Eye, EyeOff, Wand2, Copy } from "lucide-react";
import { useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import {
  deriveKey, generateSalt, generateIv, encryptText, decryptText,
  makeVerifier, verifyMasterPassword, generatePassword,
} from "@/features/data/crypto";

export function VaultPage() {
  const data = useWorkspace();
  const vaultMeta = data.vaultMeta;
  const [masterPassword, setMasterPassword] = useState("");
  const [unlockedKey, setUnlockedKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState("");

  // 新建条目表单
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);

  const hasVault = vaultMeta !== null;
  const isUnlocked = unlockedKey !== null;

  // 初始化主密码（首次使用）
  const initVault = async () => {
    const pw = masterPassword;
    if (!pw) return;
    const salt = generateSalt();
    const iv = generateIv();
    const iterations = 150000;
    const key = await deriveKey(pw, salt, iterations);
    const verifier = await makeVerifier(key, iv);
    workspaceRepository.update((d) => ({
      ...d,
      vaultMeta: { salt, iv, iterations, verifier },
      vaultEntries: [],
      updatedAt: new Date().toISOString(),
    }));
    setUnlockedKey(key);
    setMasterPassword("");
    setError("");
  };

  // 解锁
  const unlock = async () => {
    if (!vaultMeta) return;
    const ok = await verifyMasterPassword(masterPassword, vaultMeta.salt, vaultMeta.iterations, vaultMeta.iv, vaultMeta.verifier);
    if (!ok) {
      setError("主密码错误，请重试。");
      return;
    }
    const key = await deriveKey(masterPassword, vaultMeta.salt, vaultMeta.iterations);
    setUnlockedKey(key);
    setMasterPassword("");
    setError("");
  };

  const addEntry = async () => {
    if (!unlockedKey || !vaultMeta) return;
    const t = title.trim();
    if (!t || !password) return;
    const iv = vaultMeta.iv;
    const passwordCipher = await encryptText(unlockedKey, iv, password);
    const urlCipher = await encryptText(unlockedKey, iv, url.trim());
    const noteCipher = await encryptText(unlockedKey, iv, note.trim());
    workspaceRepository.update((d) => ({
      ...d,
      vaultEntries: [...d.vaultEntries, {
        id: crypto.randomUUID(),
        title: t,
        username: username.trim(),
        passwordCipher,
        urlCipher,
        noteCipher,
        category: category.trim(),
        createdAt: new Date().toISOString(),
      }],
      updatedAt: new Date().toISOString(),
    }));
    setTitle(""); setUsername(""); setPassword(""); setUrl(""); setNote(""); setCategory("");
  };

  const removeEntry = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, vaultEntries: d.vaultEntries.filter((e) => e.id !== id) }));
  };

  const revealPassword = async (id: string) => {
    if (!unlockedKey || !vaultMeta) return;
    if (revealId === id) { setRevealId(null); return; }
    setRevealId(id);
  };

  const decryptPassword = async (entry: { passwordCipher: string }): Promise<string> => {
    if (!unlockedKey || !vaultMeta) return "";
    try {
      return await decryptText(unlockedKey, vaultMeta.iv, entry.passwordCipher);
    } catch {
      return "";
    }
  };

  const copyPassword = async (cipher: string) => {
    if (!unlockedKey || !vaultMeta) return;
    try {
      const plain = await decryptText(unlockedKey, vaultMeta.iv, cipher);
      await navigator.clipboard.writeText(plain);
    } catch {
      // ignore
    }
  };

  // 首次：设置主密码
  if (!hasVault) {
    return (
      <div className="page-stack">
        <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>所有密码使用本地主密码加密存储，不上传云端。</span></header>
        <GlassPanel className="vault-setup">
          <SectionTitle><><Lock /> 设置主密码</></SectionTitle>
          <p className="settings-copy">请设置一个主密码用于加密你的密码本。主密码不会被存储，忘记后数据将无法恢复。</p>
          <div className="vault-form">
            <input aria-label="主密码" type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="输入主密码" />
            <button className="primary-action" onClick={() => void initVault()}><Shield /> 创建密码本</button>
          </div>
          {error && <p className="inline-message">{error}</p>}
        </GlassPanel>
      </div>
    );
  }

  // 已设置但未解锁
  if (!isUnlocked) {
    return (
      <div className="page-stack">
        <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>输入主密码解锁你的密码本。</span></header>
        <GlassPanel className="vault-setup">
          <SectionTitle><><Lock /> 解锁</></SectionTitle>
          <div className="vault-form">
            <input aria-label="主密码" type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="输入主密码" onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }} />
            <button className="primary-action" onClick={() => void unlock()}><KeyRound /> 解锁</button>
          </div>
          {error && <p className="inline-message">{error}</p>}
        </GlassPanel>
      </div>
    );
  }

  // 已解锁
  return (
    <div className="page-stack">
      <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>已解锁，敏感信息默认掩码显示。</span></header>

      <GlassPanel>
        <SectionTitle>添加密码</SectionTitle>
        <div className="vault-form">
          <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（如：邮箱、银行）" />
          <input aria-label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
          <div className="vault-password-row">
            <input aria-label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
            <button type="button" onClick={() => setPassword(generatePassword(16))} title="生成随机密码"><Wand2 /></button>
          </div>
          <input aria-label="网址" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="网址（可选）" />
          <input aria-label="分类" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="分类（可选）" />
          <input aria-label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" />
          <button className="primary-action" onClick={() => void addEntry()}><Plus /> 保存</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>密码列表</SectionTitle>
        {data.vaultEntries.length === 0 ? (
          <p className="ledger-empty">还没有保存的密码。</p>
        ) : (
          <div className="vault-list">
            {data.vaultEntries.map((e) => (
              <VaultRow
                key={e.id}
                entry={e}
                revealed={revealId === e.id}
                onToggleReveal={() => void revealPassword(e.id)}
                onCopy={() => void copyPassword(e.passwordCipher)}
                onRemove={() => removeEntry(e.id)}
                decryptPassword={(cipher) => decryptPassword({ passwordCipher: cipher })}
              />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function VaultRow({ entry, revealed, onToggleReveal, onCopy, onRemove, decryptPassword }: {
  entry: { id: string; title: string; username: string; passwordCipher: string; urlCipher: string; noteCipher: string; category: string };
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRemove: () => void;
  decryptPassword: (cipher: string) => Promise<string>;
}) {
  const [plain, setPlain] = useState<string | null>(null);
  return (
    <div className="vault-item">
      <span className="vault-icon"><Lock /></span>
      <div className="vault-main">
        <strong>{entry.title}</strong>
        {entry.username && <small>{entry.username}</small>}
        <span className="vault-password">{revealed ? (plain ?? "••••••••") : "••••••••"}</span>
      </div>
      {entry.category && <span className="vault-category">{entry.category}</span>}
      <button aria-label="显示/隐藏" onClick={() => {
        if (!revealed) void decryptPassword(entry.passwordCipher).then(setPlain);
        onToggleReveal();
      }}>{revealed ? <EyeOff /> : <Eye />}</button>
      <button aria-label="复制" onClick={onCopy}><Copy /></button>
      <button aria-label="删除" onClick={onRemove}><Trash2 /></button>
    </div>
  );
}

```

---

## 文件：`src/features/themes/registry.ts`

```typescript
import type { ThemeId } from "../data/schema";

export type ThemeDefinition = {
  label: string;
  character: string;
  tokens: Record<"base" | "surface" | "surfaceStrong" | "text" | "muted" | "accent" | "accentSoft" | "border" | "glow" | "heroStart" | "heroEnd", string>;
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  "peach-bloom": {
    label: "蜜桃 · 晨曦", character: "Peach",
    tokens: { base: "#0d0b13", surface: "rgba(31,24,37,.62)", surfaceStrong: "rgba(38,29,44,.84)", text: "#fff8fb", muted: "#c8bbc6", accent: "#ff9fbe", accentSoft: "#ffd0de", border: "rgba(255,188,210,.3)", glow: "rgba(255,126,172,.24)", heroStart: "#331c32", heroEnd: "#17101f" },
  },
  "dark-purple": {
    label: "幽紫 · 夜幕", character: "Violet",
    tokens: { base: "#0b0913", surface: "rgba(25,20,40,.64)", surfaceStrong: "rgba(31,24,50,.84)", text: "#fbf7ff", muted: "#bdb3cf", accent: "#b894ff", accentSoft: "#d8c8ff", border: "rgba(190,157,255,.3)", glow: "rgba(132,84,230,.26)", heroStart: "#281a45", heroEnd: "#100d1c" },
  },
  ember: {
    label: "余烬 · 暖阳", character: "Ember",
    tokens: { base: "#120b0d", surface: "rgba(39,24,26,.64)", surfaceStrong: "rgba(48,29,30,.84)", text: "#fff9f6", muted: "#ccb9b2", accent: "#ff8f75", accentSoft: "#ffc0ad", border: "rgba(255,158,129,.3)", glow: "rgba(238,83,54,.24)", heroStart: "#4a201c", heroEnd: "#1b0d12" },
  },
};

export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement) {
  const definition = THEMES[theme];
  root.dataset.theme = theme;
  Object.entries(definition.tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  });
}

```

---

## 文件：`src/lib/installed-apps.ts`

```typescript
import { isTauriRuntime } from "./runtime";

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null;
};

export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (!isTauriRuntime()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<{ apps?: InstalledApp[] }>("list_android_apps");
    return response.apps ?? [];
  } catch {
    return [];
  }
}

```

---

## 文件：`src/lib/open-launch.ts`

```typescript
import type { LaunchMethod } from "@/features/data/schema";
import { launchResource } from "./desktop-launch";

export async function openLaunch(launch: LaunchMethod) {
  return launchResource(launch);
}

```

---

## 文件：`src/features/tools/app-picker.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Smartphone, X } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { addTool } from "./model";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { listInstalledApps, type InstalledApp } from "@/lib/installed-apps";

export function AppPicker({ onClose }: { onClose: () => void }) {
  const data = useWorkspace();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void listInstalledApps().then((result) => {
      if (!active) return;
      setApps(result);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const owned = useMemo(
    () => new Set(data.tools.map((tool) => (tool.launch.type === "android-app" ? tool.launch.packageName : ""))),
    [data.tools],
  );

  const visible = apps.filter((app) => `${app.name} ${app.packageName}`.toLowerCase().includes(query.trim().toLowerCase()));

  const pick = (app: InstalledApp) => {
    workspaceRepository.set(addTool(data, {
      name: app.name,
      icon: "smartphone",
      launch: {
        type: "android-app",
        packageName: app.packageName,
        fallbackUrl: `https://play.google.com/store/apps/details?id=${app.packageName}`,
      },
    }));
    onClose();
  };

  return <div className="dialog-backdrop" onMouseDown={onClose}>
    <GlassPanel className="confirm-dialog app-picker" onMouseDown={(event) => event.stopPropagation()}>
      <header className="app-picker-head">
        <h2>本机应用</h2>
        <button aria-label="关闭" onClick={onClose}><X /></button>
      </header>
      <label className="app-picker-search"><Search /><input
        autoFocus
        aria-label="搜索已安装应用"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索应用…"
      /></label>
      <div className="app-picker-list">
        {loading && <p className="app-picker-empty"><Loader2 className="spin" /> 正在读取已安装应用…</p>}
        {!loading && !apps.length && <p className="app-picker-empty">没有读到应用列表。请在工具页用「Android 应用」类型手动填写包名。</p>}
        {!loading && apps.length > 0 && !visible.length && <p className="app-picker-empty">没有匹配「{query}」的应用。</p>}
        {visible.map((app) => <button
          key={app.packageName}
          className="app-picker-item"
          disabled={owned.has(app.packageName)}
          onClick={() => pick(app)}
        >
          <span className="app-picker-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {app.icon ? <img src={`data:image/png;base64,${app.icon}`} alt="" /> : <Smartphone size={20} />}
          </span>
          <span className="app-picker-meta"><strong>{app.name}</strong><small>{app.packageName}</small></span>
          <em>{owned.has(app.packageName) ? "已添加" : "添加"}</em>
        </button>)}
      </div>
    </GlassPanel>
  </div>;
}

```

---
