# Zynthel（SOLARIS 开源版）—— 后端源码审查包

> 生成时间：2026-09-19 20:55
> 用途：交给第三方 AI 做后端代码安全 / 正确性 / 稳定性审查。
> 技术栈：Next.js + Tauri 2（Rust 原生层 + Kotlin Android 插件）+ Web Crypto + IndexedDB。
> 平台定位：Android 平板（本地优先工作台）。
> 开源版：已更名 Zynthel（商标去风险），无 Obsidian 集成、无境外 AI 服务，可公开。
> 包名：`com.zynthel.workspace`。

> 本轮改动 A（PDF 页面显示不完整 + 纵向滚动适配，两版共用；改 `book-reader.tsx` 与 `life.css`，纯前端）：
> 1. **真实根因**：`PdfEngine` 只写了 `canvas.style.width`，**没有写 `canvas.style.height`**；
>    canvas 的 CSS 高度回落到 intrinsic 高度即**设备像素高度（DPR 倍）**，再被
>    `.pdf-body canvas{max-height:100%}` 压回容器高度 → 页面纵向被压缩、下半部分看不到。
> 2. **容器改为可滚动**：`.pdf-body` 由 `display:grid; place-items:center; overflow:hidden`
>    改为 `display:block; overflow-y:auto; overflow-x:hidden` + `-webkit-overflow-scrolling:touch`
>    + `overscroll-behavior:contain`。grid 居中会让超高内容溢出到不可达区域（既看不到也滚不到）。
> 3. **渲染倍率封顶**：`dpr = min(devicePixelRatio, 2)`，且单张 canvas 限制 16M 像素
>    （超出则整体同比降倍率，宽高绝不变形），避免高 DPR 设备 OOM / 白屏。
> 4. **翻页与旋转**：翻页时把容器 `scrollTop` 归零，同页重渲染（旋转屏幕）保留当前位置；
>    用 `ResizeObserver` 监听容器宽度变化并防抖重渲染，横竖屏切换后按新宽度重新适配。
> 5. **手势**：横向滑动翻页增加纵向判定——`|dy| >= |dx|` 时不翻页，避免上下滚动误触发翻页。
> 6. **验证**（Chromium + 真实构建产物 `out/`，走真实 UI：本地文件 → 阅读）：
>    竖屏 820x1180 单页 / 竖屏三页 / 横屏 1180x820 三页，共 3 组全部 PASS ——
>    canvas 宽高比 1.4146~1.4152（A4 为 1.4151，无变形）、`style.height` 已正确写入、
>    容器可滚动（竖屏可滚 100px、横屏 970px）、滚到底后 canvas 下边缘完整落在可视区内、
>    翻页后 `scrollTop` 归零、控制台无错误。单元测试 45 项全通过，typecheck / lint 干净。
>
> 本轮改动 B（应用图标，纯资源层，两版各自独立）：
> 1. 用 `pnpm tauri icon` 从新图源生成全套图标（`src-tauri/icons/` + Android `mipmap-*`，
>    并新增 `mipmap-anydpi-v26/ic_launcher.xml` 自适应图标）。
> 2. 自适应图标底色 `values/ic_launcher_background.xml` 由默认 `#fff` 改为图标自身边缘均值色，
>    避免视差滚动 / 异形遮罩时露白边。本项只涉及资源文件，不涉及任何业务逻辑。
>
> 上一轮修复（Android 本地 PDF 无法阅读：worker MIME，两版共用；只改 `book-reader.tsx`，纯前端）：
> 1. **真实根因**：pdf.js 6 用 `new Worker()` 且 type 为 `module`（模块 worker）——**模块 worker 强制校验
>    JavaScript MIME**。Tauri Android 的 asset 响应对 `.mjs` 返回 `application/octet-stream`，
>    WebView 按 HTML 规范直接拒载（Strict MIME type checking is enforced for module scripts），
>    pdf.js 于是退化到 fake worker 并抛
>    `Setting up fake worker failed: "Failed to fetch dynamically imported module: .../pdf.worker.min.mjs"`；
>    旧代码 catch 后一律显示「PDF 解析失败，文件可能已损坏」，把真实原因完全掩盖。
> 2. **worker 修法**：新增 `ensurePdfWorker()`——先 `fetch("/pdf.worker.min.mjs")` 取源码
>    （校验含 `WorkerMessageHandler`，防止拿到 404/兜底 HTML 也当 JS 用），再包成 `text/javascript`
>    的 blob: URL 交给 pdf.js：MIME 由应用自己保证、完全离线、不走 CDN；建好后**不 revoke**
>    （pdf.js 延迟到 getDocument 时才 new Worker）。
> 3. **PDF 数据链路**：改为 `IndexedDB → Blob → blob.arrayBuffer() → Uint8Array → getDocument 的 data 选项`，
>    不再 `URL.createObjectURL` 后走 `url` 选项；进 pdf.js 之前先校验 `blob.size > 0` 与 `%PDF-` 文件头。
>    EPUB / TXT·MD 保持原有 blob URL 链路与 revoke 逻辑不变。
> 4. **错误处理**：`catch (err)` 保留 `name / message / stack` 并 `console.error("[PDF Reader] ...")`，
>    再按错误类型区分提示（worker 加载失败 / 文件为空 / 找不到本地文件 / 真的解析失败），
>    不再把所有失败统一说成「文件已损坏」。
> 5. **页码初始化**：文档就绪后把页码夹到 `1..numPages`（首次打开进度 0 → 第 1 页；旧进度超总页数 →
>    收敛到最后一页），并新增 `docReady` 状态触发渲染 effect —— 一并修复「解析成功但 canvas 不渲染」。
> 6. **资源释放全部保留**：`loadingTask.destroy()`、`renderTask.cancel()`、切换书籍 / 关闭 / unmount 清理、
>    EPUB·TXT 的 blob URL revoke，均未改动。
>
> 上一轮修复（commit 50a168f，已与内测版同步）：
> 1. **阅读器修复**：`book-reader.tsx` 动态 import 改顶部静态 import + CSP 补 worker-src。
> 2. **备份恢复回滚保旧文件**、**降低内存上限(40MB/150MB)**、**PDF 资源释放(destroy/cancel)**、
>    **IndexedDB 打开失败重试**、**termSchema 严格日期校验 + endDate>=startDate**。
>
> 第二轮修复（commit cfd06c1，两版共用）：
> 1. **IndexedDB 事务判断**：`book-storage.ts` 的 `runTx()` 不再在 `request.onsuccess` 判定成功，
>    改为等 `transaction.oncomplete` 才返回，并补 `onerror`/`onabort`；`getAllBookFiles()` 同样补事务级错误处理。
> 2. **ZIP 解压异常**：`transfer.ts` 的 `entry.async("blob")` 增加 try/catch，损坏条目返回 `invalid-zip`，不再冒到 UI。
> 3. **密码本自动锁定**：`vault-page.tsx` 监听 `visibilitychange`(document.hidden) + `window blur` 进后台自动锁定，
>    并提供手动「锁定」按钮；锁定时清除 CryptoKey 与明文状态（页面刷新天然保持锁定）。
> 4. **密码本异步解密竞态**：`VaultRow` 用 `revealToken` 令牌，快速「显示→隐藏」时忽略旧的 decrypt 结果，
>    防止旧 Promise 完成后重新显示明文。
>
> 第四轮收尾（commit a943103，两版共用，本次为最终修复）：
> 1. **getAllBookFiles() 事务判定**：cursor 遍历结束只标记读取完成，必须等 `transaction.oncomplete`
>    才 `resolve`（与 `runTx()` 一致）；保留 onerror/onabort/cursorRequest.onerror。
> 2. **备份书籍校验加强**：`parseFullBackup()` 由「只查 bookId 存在」升级为
>    bookId 存在 + `source==="file"` + `fileName` 非空 + ZIP 条目名与元数据 fileName 一致
>    （用打包时同样的 `/` `\` → `_` 清洗规则，保证旧备份可恢复）+ 同一 bookId 只取一个；
>    孤儿 / manual / 空 fileName / 名不匹配的条目直接忽略，不写入 IndexedDB。
>
> 第三轮新增（commit 39e3763，纯前端配色）：
> 5. **内置渐变主题**：新增 `theme-presets.css`（`html[data-theme]` 驱动 CSS 变量，一套 UI + 多套主题变量），
>    `themeIdSchema` 扩展为 default + 5 个渐变主题（旧数据 default 完全兼容），设置页 6 张预览卡即时切换并自动保存。
>    **注意：主题系统只写 `document.documentElement.dataset.theme`，不写 inline 样式、不涉及任何后端/加密/网络逻辑。**

---

## 目录

1. `src-tauri/src/main.rs`
2. `src-tauri/src/lib.rs`
3. `src-tauri/src/launch.rs`
4. `src-tauri/Cargo.toml`
5. `src-tauri/build.rs`
6. `src-tauri/tauri.conf.json`
7. `src-tauri/capabilities/default.json`
8. `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
9. `src/features/data/schema.ts`
10. `src/features/data/life-schema.ts`
11. `src/features/data/repository.ts`
12. `src/features/data/transfer.ts`
13. `src/features/data/crypto.ts`
14. `src/features/data/ai-schema.ts`
15. `src/features/ai/ai-client.ts`
16. `src/lib/book-storage.ts`
17. `src/lib/installed-apps.ts`
18. `src/lib/open-launch.ts`
19. `src/lib/desktop-launch.ts`
20. `src/lib/runtime.ts`
21. `src/features/life/book-reader.tsx`
22. `src/app/life.css（阅读器容器样式）`
23. `src/features/life/vault-page.tsx（密码本加密）`
24. `src/features/themes/registry.ts（主题预设元数据）`
25. `src/features/themes/theme-provider.tsx（主题应用）`
26. `src/app/theme-presets.css（主题变量）`
27. `LaunchPlugin.kt`
28. `MainActivity.kt`

---

## 文件：`src-tauri/src/main.rs`

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  zynthel_lib::run();
}
```

## 文件：`src-tauri/src/lib.rs`

```rust
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

## 文件：`src-tauri/Cargo.toml`

```toml
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

## 文件：`src-tauri/build.rs`

```rust
fn main() {
  tauri_build::build()
}
```

## 文件：`src-tauri/tauri.conf.json`

```json
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
      "csp": "default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https: http://127.0.0.1:47135 ipc: http://ipc.localhost",
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

## 文件：`src-tauri/capabilities/default.json`

```json
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

## 文件：`src-tauri/gen/android/app/src/main/AndroidManifest.xml`

```xml
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

// 内置主题："default" 为原始默认主题（旧数据完全兼容），其余为可选渐变主题。
export const themeIdSchema = z.enum([
  "default",
  "ink-blue",
  "rose-mist",
  "sakura-almond",
  "moon-frost",
  "moss-peach",
]);
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
  weeks: z.array(z.number().int().min(1).max(20)).default([]),
  termId: z.string().default(""),
  createdAt: timestamp,
});

// 严格 YYYY-MM-DD 日期：格式合法 + 真实日历日期（拒绝 2026-02-30 等非法日期）。
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}, { message: "必须是有效的 YYYY-MM-DD 日期" });

export const termSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
}).superRefine((term, ctx) => {
  if (term.endDate < term.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "结束日期不能早于开始日期",
    });
  }
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
  source: z.enum(["manual", "file"]).default("manual"),
  fileName: z.string().max(200).default(""),
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

## 文件：`src/features/data/repository.ts`

```typescript
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

/* ===== 完整备份（ZIP：workspace.json + 书籍文件） ===== */

export type FullBackupFile = { bookId: string; fileName: string; blob: Blob };

const BACKUP_MARKER = "zynthel-full-backup";

// 恢复备份的资源限制（Android 平板合理默认，防止超大备份一次性载入内存导致 OOM）
const MAX_BACKUP_ZIP_BYTES = 200 * 1024 * 1024; // ZIP 文件总大小上限 200MB
const MAX_BACKUP_FILES = 500; // 书籍文件数量上限
const MAX_BACKUP_FILE_BYTES = 40 * 1024 * 1024; // 单个书籍文件解压上限 40MB
const MAX_BACKUP_TOTAL_BYTES = 150 * 1024 * 1024; // 全部书籍文件解压总量上限 150MB

export type FullBackupParseError =
  | "invalid-zip"
  | "unsupported-data"
  | "zip-too-large"
  | "too-many-files"
  | "file-too-large"
  | "total-too-large";

export type FullBackupParseResult =
  | { ok: true; data: WorkspaceData; files: FullBackupFile[] }
  | { ok: false; error: FullBackupParseError };

/** 打包完整备份：工作区数据 JSON + 本地书籍文件（IndexedDB blob） */
export async function buildFullBackup(data: WorkspaceData, files: FullBackupFile[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify({ marker: BACKUP_MARKER, exportedAt: new Date().toISOString(), workspace: workspaceSchema.parse(data) }, null, 2));
  if (files.length) {
    const folder = zip.folder("books")!;
    for (const f of files) folder.file(`${f.bookId}__${f.fileName.replace(/[/\\]/g, "_")}`, f.blob);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** 解析完整备份：返回工作区数据与书籍文件列表（供写入 IndexedDB）。带资源限制 + bookId 校验。 */
export async function parseFullBackup(file: Blob): Promise<FullBackupParseResult> {
  // 1. ZIP 文件大小限制（避免超大备份整体载入内存）
  if (file.size > MAX_BACKUP_ZIP_BYTES) return { ok: false, error: "zip-too-large" };

  let zip: InstanceType<typeof import("jszip")>;
  try {
    const JSZip = (await import("jszip")).default;
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, error: "invalid-zip" };
  }
  const manifestEntry = zip.file("backup.json");
  if (!manifestEntry) return { ok: false, error: "unsupported-data" };
  let manifest: { marker?: string; workspace?: unknown };
  try {
    manifest = JSON.parse(await manifestEntry.async("string"));
  } catch {
    return { ok: false, error: "unsupported-data" };
  }
  if (manifest.marker !== BACKUP_MARKER) return { ok: false, error: "unsupported-data" };
  const parsed = workspaceSchema.safeParse(manifest.workspace);
  if (!parsed.success) return { ok: false, error: "unsupported-data" };

  // 2. 合法书籍映射：只恢复 workspace.books 中 source==="file" 且 fileName 非空的书籍。
  //    source==="manual"（手动录入）没有本地文件；fileName 为空说明元数据与文件不一致。
  const bookFileNames = new Map<string, string>();
  for (const book of parsed.data.books) {
    if (book.source === "file" && book.fileName) bookFileNames.set(book.id, book.fileName);
  }

  // 3. 遍历 books/ 目录：bookId 合法 + source 为 file + 文件名与元数据一致 + 无重复 + 文件名安全
  const entries: { bookId: string; fileName: string; entry: import("jszip").JSZipObject }[] = [];
  const seenBookIds = new Set<string>();
  zip.folder("books")?.forEach((relativePath: string, entry: import("jszip").JSZipObject) => {
    if (entry.dir) return;
    const sep = relativePath.indexOf("__");
    const bookId = sep > 0 ? relativePath.slice(0, sep) : relativePath;
    const fileName = sep > 0 ? relativePath.slice(sep + 2) : relativePath;
    // 忽略孤儿文件 / source!=="file" / fileName 为空的书籍
    const rawFileName = bookFileNames.get(bookId);
    if (rawFileName === undefined) return;
    // 异常文件名（含路径分隔符等）直接忽略
    if (!fileName || fileName.length > 200 || /[\\/]/.test(fileName)) return;
    // ZIP 条目文件名必须与元数据中的 fileName 一致（用打包时同样的清洗规则，保证旧备份可恢复），
    // 避免元数据与 Blob 不一致
    if (fileName !== rawFileName.replace(/[/\\]/g, "_")) return;
    // 防止重复 bookId：同一本书只取第一个合法文件
    if (seenBookIds.has(bookId)) return;
    seenBookIds.add(bookId);
    entries.push({ bookId, fileName, entry });
  });

  // 4. 文件数量限制
  if (entries.length > MAX_BACKUP_FILES) return { ok: false, error: "too-many-files" };

  // 5. 逐个解压，边解压边累计大小（不在内存中同时持有所有文件）
  const files: FullBackupFile[] = [];
  let totalBytes = 0;
  for (const { bookId, fileName, entry } of entries) {
    let blob: Blob;
    try {
      blob = await entry.async("blob");
    } catch {
      // ZIP 条目损坏、解压失败：不要冒到 UI，统一按损坏备份处理。
      return { ok: false, error: "invalid-zip" };
    }
    if (blob.size > MAX_BACKUP_FILE_BYTES) return { ok: false, error: "file-too-large" };
    totalBytes += blob.size;
    if (totalBytes > MAX_BACKUP_TOTAL_BYTES) return { ok: false, error: "total-too-large" };
    files.push({ bookId, fileName, blob });
  }
  return { ok: true, data: parsed.data, files };
}

/** 触发浏览器下载备份文件（Tauri WebView 落到系统下载目录） */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}
```

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

## 文件：`src/features/data/ai-schema.ts`

```typescript
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

## 文件：`src/lib/book-storage.ts`

```typescript
// 阅读文件本地存储：IndexedDB 存 blob（localStorage 5MB 上限放不下 PDF/EPUB）。
// 以书籍 id 为 key，选文件时写入，删除书时清理，阅读器打开时读取。

const DB_NAME = "zynthel-books";
const STORE = "files";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

/** 归一化 IndexedDB 错误，识别配额/不可用/事务失败，抛出带语义的 Error */
function normalizeError(err: unknown, fallback: string): Error {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === "QuotaExceededError") return new Error("存储空间不足（QuotaExceededError）");
  if (name === "InvalidStateError" || name === "TransactionInactiveError") return new Error("存储事务失败");
  if (err instanceof Error) return err;
  return new Error(fallback);
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(normalizeError(request.error, "打开本地书库失败"));
    } catch (err) {
      // IndexedDB 不可用（隐私模式 / WebView 禁用存储）
      reject(normalizeError(err, "本地存储不可用"));
    }
  });
  // 打开失败时清除缓存的 Promise，允许下一次操作重新尝试打开（避免一次失败后永久无法重试）。
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function runTx<T>(mode: IDBTransactionMode, operate: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result: T | undefined;
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(normalizeError(tx.error, "本地书库事务失败"));
    tx.onabort = () => reject(normalizeError(tx.error, "本地书库事务失败"));
    const request = operate(tx.objectStore(STORE));
    // 仅在 request 成功时暂存结果，最终以 transaction.oncomplete 为准（真正提交完成才成功）。
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(normalizeError(request.error, "本地书库读写失败"));
  }));
}

export async function putBookFile(bookId: string, file: Blob): Promise<void> {
  await runTx("readwrite", (store) => store.put(file, bookId));
}

export async function getBookFile(bookId: string): Promise<Blob | undefined> {
  return runTx("readonly", (store) => store.get(bookId) as IDBRequest<Blob | undefined>);
}

export async function deleteBookFile(bookId: string): Promise<void> {
  await runTx("readwrite", (store) => store.delete(bookId));
}

/** 读取本地书库全部文件（用于完整备份） */
export async function getAllBookFiles(): Promise<{ bookId: string; blob: Blob }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const result: { bookId: string; blob: Blob }[] = [];
    let cursorDone = false;
    // 与 runTx() 保持一致：request 成功不等于事务已提交，只有 oncomplete 才判定成功。
    tx.oncomplete = () => { if (cursorDone) resolve(result); };
    tx.onerror = () => reject(normalizeError(tx.error, "遍历本地书库失败"));
    tx.onabort = () => reject(normalizeError(tx.error, "遍历本地书库失败"));
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      // 遍历结束只标记读取完成，真正的成功判定交给 transaction.oncomplete
      if (!cursor) { cursorDone = true; return; }
      result.push({ bookId: String(cursor.key), blob: cursor.value as Blob });
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("遍历本地书库失败"));
  });
}

/** 判断格式是否支持应用内阅读 */
export function supportedFileType(fileName: string): "pdf" | "epub" | "txt" | null {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "epub") return "epub";
  if (ext === "txt" || ext === "md") return "txt";
  return null;
}

/** 写入多个书籍文件；若任一失败，回滚到写入前状态（原有文件恢复、新增文件删除）并抛错。 */
export async function putBookFiles(files: { bookId: string; blob: Blob }[]): Promise<void> {
  // 写入前保存每个 bookId 的旧 Blob（若原来就有文件），供失败回滚时恢复。
  const previous = new Map<string, Blob | undefined>();
  const written: string[] = [];
  try {
    for (const f of files) {
      // 记录旧值（仅对尚未记录过的 bookId，避免重复读取）
      if (!previous.has(f.bookId)) {
        previous.set(f.bookId, await getBookFile(f.bookId));
      }
      await putBookFile(f.bookId, f.blob);
      written.push(f.bookId);
    }
  } catch (err) {
    // 回滚：恢复到写入前状态。
    for (const id of written) {
      const old = previous.get(id);
      try {
        if (old !== undefined) {
          await putBookFile(id, old); // 原来有文件 → 恢复旧 Blob
        } else {
          await deleteBookFile(id); // 原来没有文件 → 删除本轮新增文件
        }
      } catch { /* 尽力回滚，忽略回滚失败 */ }
    }
    throw normalizeError(err, "写入本地书库失败");
  }
}
```

## 文件：`src/lib/installed-apps.ts`

```typescript
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

## 文件：`src/lib/open-launch.ts`

```typescript
import type { LaunchMethod } from "@/features/data/schema";
import { launchResource } from "./desktop-launch";

export async function openLaunch(launch: LaunchMethod) {
  return launchResource(launch);
}
```

## 文件：`src/lib/desktop-launch.ts`

```typescript
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

## 文件：`src/lib/runtime.ts`

```typescript
export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}
```

## 文件：`src/features/life/book-reader.tsx`

```tsx
"use client";

// 应用内阅读器：PDF（pdf.js canvas 渲染）/ EPUB（epub.js 分页）/ TXT·MD（自研分页）。
// 统一左右翻页交互（按钮 + 键盘 + 触摸滑动），进度按书 id 记忆（localStorage）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import ePub from "epubjs";
import { getBookFile, supportedFileType } from "@/lib/book-storage";

export type ReaderTarget = { bookId: string; title: string; fileName: string };

const PROGRESS_KEY = (bookId: string) => `reader.progress.${bookId}`;

function loadProgress(bookId: string): number {
  const raw = localStorage.getItem(PROGRESS_KEY(bookId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveProgress(bookId: string, value: number) {
  localStorage.setItem(PROGRESS_KEY(bookId), String(value));
}

/** 检查 PDF 文件头（%PDF-）：避免把非 PDF / 截断数据丢给 pdf.js 后只得到「文件损坏」 */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 1024);
  let text = "";
  for (let i = 0; i < head.length; i += 1) text += String.fromCharCode(head[i]);
  return text.includes("%PDF-");
}

/** pdf.js worker 在 public/ 下的路径（Next 静态导出会原样拷进 out/，随 Tauri 资产一起打包） */
const PDF_WORKER_PATH = "/pdf.worker.min.mjs";
/** worker 源码转成的 blob: URL（模块级缓存，整个会话只建一次） */
let pdfWorkerBlobUrl = "";

/**
 * 配置 pdf.js worker。
 *
 * pdf.js 6 用 `new Worker(workerSrc, { type: "module" })` 起 worker——**模块 worker 强制要求
 * JS MIME**。桌面/浏览器开发服务器会把 .mjs 正确声明成 text/javascript，但 Tauri Android 的
 * asset 响应对 .mjs 未必给出 JS MIME（未知扩展名会退回 octet-stream），模块 worker 会被
 * WebView 直接拒掉，pdf.js 随即退化到 fake worker 并抛
 * "Setting up fake worker failed"，表现就是「PDF 解析失败，文件可能已损坏」。
 *
 * 这里先把 worker 源码 fetch 成文本，再包成 `text/javascript` 的 blob: URL，
 * MIME 由我们自己保证；完全离线，不走 CDN。取不到源码时退回原始路径。
 * 注意：blob: URL 建好后不能 revoke——pdf.js 是延迟到 getDocument 才用它 new Worker。
 */
async function ensurePdfWorker(): Promise<void> {
  if (pdfWorkerBlobUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
    return;
  }
  try {
    const res = await fetch(PDF_WORKER_PATH);
    const code = res.ok ? await res.text() : "";
    // 校验拿到的确实是 pdf.js worker 源码（防止拿到 404/兜底 HTML 还当 JS 用）
    if (!code || !code.includes("WorkerMessageHandler")) {
      throw new Error(`worker source invalid: HTTP ${res.status}, ${code.length} chars`);
    }
    pdfWorkerBlobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
  } catch (err) {
    console.error("[PDF Reader] worker fetch failed, fallback to path:", err);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;
  }
}

/** 把 pdf.js 的真实错误映射成对用户有意义的提示，不再一律说「文件已损坏」 */
function pdfErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (name === "MissingPDFException" || /missing pdf/i.test(message)) return "找不到本地 PDF，请重新添加文件。";
  if (name === "WorkerException" || /worker/i.test(message) || /fake worker/i.test(message)) return "PDF 阅读组件加载失败，请重新打开。";
  if (/password|encrypt/i.test(message)) return "此 PDF 已加密，暂不支持打开。";
  if (name === "InvalidPDFException" || /invalid pdf/i.test(message)) return "无法解析此 PDF，文件可能损坏或格式不受支持。";
  return "无法解析此 PDF，文件可能损坏或格式不受支持。";
}

export function BookReader({ target, onClose }: { target: ReaderTarget; onClose: () => void }) {
  const mode = useMemo(() => supportedFileType(target.fileName), [target.fileName]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  // PDF 直接以字节交给 pdf.js，不再依赖 blob: URL（Android WebView 取 blob: 不稳定）
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  // 追踪当前活跃的 blob URL，保证切换书籍/关闭/unmount 时都能 revoke，避免内存泄漏
  const activeUrlRef = useRef<string>("");
  // Portal 到 body：避免玻璃面板的 backdrop-filter 把 fixed 遮罩退化成局部定位
  // 惰性初始化判断 document 可用性（客户端），避免 effect 内 setState
  const [mounted] = useState(() => typeof document !== "undefined");

  const [pdfPage, setPdfPage] = useState(() => loadProgress(target.bookId));
  const [pdfTotal, setPdfTotal] = useState(0);
  const [epubPercent, setEpubPercent] = useState(() => (loadProgress(target.bookId) || 0));
  const [txtIndex, setTxtIndex] = useState(() => loadProgress(target.bookId));
  const [txtTotal, setTxtTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await getBookFile(target.bookId);
        if (cancelled) return;
        if (!blob) { setError("找不到文件内容，请重新选择文件添加。"); setLoading(false); return; }
        if (blob.size === 0) {
          setError(mode === "pdf" ? "PDF 文件内容为空，请重新添加文件。" : "文件内容为空，请重新添加文件。");
          setLoading(false);
          return;
        }
        // PDF 直接读成字节交给 pdf.js：Android WebView 下 blob: URL 取 PDF 不稳定，
        // 而且这样能在进 pdf.js 之前就校验文件完整性（大小 + %PDF- 头）。
        if (mode === "pdf") {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (cancelled) return;
          if (bytes.byteLength === 0) { setError("PDF 文件内容为空，请重新添加文件。"); setLoading(false); return; }
          if (!hasPdfHeader(bytes)) { setError("无法解析此 PDF，文件可能损坏或格式不受支持。"); setLoading(false); return; }
          setPdfData(bytes);
          setLoading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        // 若已有旧 URL（切换书籍），先 revoke
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = url;
        setBlobUrl(url);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[PDF Reader] read file failed:", err);
          setError("读取本地文件失败。");
          setLoading(false);
        }
      }
    })();
    // 卸载或 bookId 变化时 revoke 当前 URL
    return () => {
      cancelled = true;
      setPdfData(null);
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = "";
      }
    };
  }, [target.bookId, mode]);

  // 页码合法化回调：首次打开进度为 0 → 回到第 1 页；旧进度超过总页数 → 收敛到最后一页。
  // 由 PdfEngine 在文档就绪后（异步）回调，避免解析成功却因页码非法而不渲染。
  const handlePdfPageResolved = useCallback((n: number) => {
    setPdfPage(n);
    saveProgress(target.bookId, n);
  }, [target.bookId]);

  const goNext = useCallback(() => {
    if (mode === "pdf" && pdfPage < pdfTotal) { const n = pdfPage + 1; setPdfPage(n); saveProgress(target.bookId, n); }
    if (mode === "txt" && txtIndex < txtTotal - 1) { const n = txtIndex + 1; setTxtIndex(n); saveProgress(target.bookId, n); }
  }, [mode, pdfPage, pdfTotal, txtIndex, txtTotal, target.bookId]);

  const goPrev = useCallback(() => {
    if (mode === "pdf" && pdfPage > 1) { const n = pdfPage - 1; setPdfPage(n); saveProgress(target.bookId, n); }
    if (mode === "txt" && txtIndex > 0) { const n = txtIndex - 1; setTxtIndex(n); saveProgress(target.bookId, n); }
  }, [mode, pdfPage, txtIndex, target.bookId]);

  // 键盘翻页 + 触摸滑动翻页
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // 纵向为主的手势（上下滑动看完整页）不算翻页，避免滚动时误触发翻页
    if (Math.abs(dy) >= Math.abs(dx)) return;
    if (dx < -50) goNext();
    if (dx > 50) goPrev();
  };

  const progressLabel = mode === "pdf" && pdfTotal ? `${Math.min(Math.max(pdfPage, 1), pdfTotal)} / ${pdfTotal}`
    : mode === "txt" && txtTotal ? `${Math.min(txtIndex + 1, txtTotal)} / ${txtTotal}`
    : mode === "epub" ? `${Math.min(epubPercent, 100)}%`
    : "";

  if (!mounted) return null;

  return createPortal(
    <div className="book-reader-backdrop" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="book-reader-head">
        <strong title={target.title}>{target.title}</strong>
        <span className="book-reader-progress">{progressLabel}</span>
        <button aria-label="关闭阅读器" onClick={onClose}><X /></button>
      </header>

      {loading && <div className="book-reader-status"><Loader2 className="spin" /> 正在打开文件…</div>}
      {!loading && error && <div className="book-reader-status">{error}</div>}

      {!loading && !error && mode === "pdf" && pdfData && (
        <PdfEngine
          data={pdfData}
          page={pdfPage}
          onPageCount={setPdfTotal}
          onPageResolved={handlePdfPageResolved}
          onError={setError}
        />
      )}
      {!loading && !error && mode === "epub" && (
        <EpubEngine url={blobUrl} onPercent={(p) => { setEpubPercent(p); saveProgress(target.bookId, p); }} onError={setError} />
      )}
      {!loading && !error && mode === "txt" && (
        <TxtEngine url={blobUrl} index={txtIndex} onReady={setTxtTotal} />
      )}

      {!loading && !error && (mode === "pdf" || mode === "txt") && (
        <div className="book-reader-nav">
          <button aria-label="上一页" onClick={goPrev} disabled={mode === "pdf" ? pdfPage <= 1 : txtIndex <= 0}><ChevronLeft /> 上一页</button>
          <span>{progressLabel}</span>
          <button aria-label="下一页" onClick={goNext} disabled={mode === "pdf" ? pdfPage >= pdfTotal : txtIndex >= txtTotal - 1}>下一页 <ChevronRight /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ===== PDF 引擎：pdf.js 渲染当前页到 canvas ===== */
function PdfEngine({ data, page, onPageCount, onPageResolved, onError }: {
  data: Uint8Array;
  page: number;
  onPageCount: (n: number) => void;
  onPageResolved: (n: number) => void;
  onError: (msg: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 容器尺寸变化（横竖屏切换/窗口缩放）后需要按新宽度重新渲染一次
  const [renderTick, setRenderTick] = useState(0);
  // 上一次渲染的页码：仅在翻页时把滚动位置归零，避免重渲染打断当前阅读位置
  const lastPageRef = useRef(0);
  // PDF document proxy（numPages/getPage）
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<unknown>; cancel: () => void } }> } | null>(null);
  // loading task（destroy 释放 worker + 文档）
  const taskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  // 当前 renderTask（cancel 释放渲染）
  const renderTaskRef = useRef<{ promise: Promise<unknown>; cancel: () => void } | null>(null);
  // 文档就绪计数器：文档是异步加载的，必须让渲染 effect 在文档就绪后再跑一次，
  // 否则「页码没变、数据没变」时 effect 不会重跑，页面解析成功但 canvas 一片空白。
  const [docReady, setDocReady] = useState(0);
  // 打开时的页码快照：只用于文档就绪后做一次合法化，不能进加载 effect 的依赖
  // （否则每翻一页都会重新解析整份 PDF）。
  const initialPageRef = useRef(page);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // worker 必须先就绪（MIME 由 ensurePdfWorker 保证），再以字节形式交给 pdf.js，
        // 不再走 blob: URL —— Android WebView 取 blob: PDF 不稳定。
        await ensurePdfWorker();
        const task = pdfjs.getDocument({ data });
        taskRef.current = task as unknown as typeof taskRef.current;
        const doc = await task.promise;
        if (cancelled) return;
        pdfRef.current = doc as unknown as typeof pdfRef.current;
        onPageCount(doc.numPages);
        // 页码合法化：pdf.js 只接受 1..numPages。首次打开（进度 0）必须落到第 1 页，
        // 旧进度超出总页数则收敛到最后一页，否则解析成功也不会渲染。
        const initialPage = initialPageRef.current;
        const clamped = Math.min(Math.max(initialPage, 1), doc.numPages);
        if (clamped !== initialPage) onPageResolved(clamped);
        setDocReady((v) => v + 1);
      } catch (err) {
        if (cancelled) return;
        // 保留真实错误（name/message/stack），不再一律报「文件已损坏」
        console.error("[PDF Reader] load failed:", err, `bytes=${data.byteLength}`);
        onError(pdfErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      pdfRef.current = null;
      // 卸载/切换时销毁 PDF loading task，释放 worker 与文档，避免资源泄漏
      const task = taskRef.current;
      if (task) {
        taskRef.current = null;
        void task.destroy().catch(() => { /* 忽略 destroy 失败 */ });
      }
    };
  }, [data, onPageCount, onPageResolved, onError]);

  // 容器宽度变化 → 重新适配渲染（横竖屏切换时页面不再被裁/留黑边）
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRenderTick((v) => v + 1), 120);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    // 渲染时同样夹到合法范围，保证父层页码还没同步过来时也能画出第一页
    const safePage = Math.min(Math.max(page, 1), doc.numPages);
    let cancelled = false;
    // 翻页时回到页顶；同页重渲染（如旋转屏幕）保留当前滚动位置
    if (safePage !== lastPageRef.current && bodyRef.current) bodyRef.current.scrollTop = 0;
    lastPageRef.current = safePage;
    (async () => {
      try {
        const pdfPage = await doc.getPage(safePage);
        if (cancelled) return;
        const container = canvas.parentElement;
        const base = pdfPage.getViewport({ scale: 1 });
        // 左右各留 12px 呼吸位，避免贴边
        const availWidth = Math.max(160, (container?.clientWidth ?? 600) - 24);
        // 按宽度铺满；窄页面最多放大 2 倍，防止小 PDF 被拉得过大
        const cssScale = Math.min(2, availWidth / base.width);
        // 渲染倍率封顶 2（DPR 3 的设备上 canvas 像素会翻 9 倍，Android WebView 容易 OOM/白屏）
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let devScale = cssScale * dpr;
        // 单张 canvas 像素上限保护：超过则整体降倍率（宽高同比，绝不变形）
        const maxPixels = 16_000_000;
        const need = base.width * base.height * devScale * devScale;
        if (need > maxPixels) devScale = Math.sqrt(maxPixels / (base.width * base.height));
        const viewport = pdfPage.getViewport({ scale: devScale });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        // 关键：宽高都写 CSS 尺寸。之前只写 width，高度回落到设备像素高度（DPR 倍），
        // 再被 max-height 压回容器 → 页面纵向被压缩、下半部分看不到。
        const cssW = (base.width * devScale) / dpr;
        const cssH = (base.height * devScale) / dpr;
        canvas.style.width = `${Math.round(cssW)}px`;
        canvas.style.height = `${Math.round(cssH)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        const renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch {
        // cancel 会抛 RenderingCancelledException，正常翻页/卸载场景下忽略
        // 真正的渲染失败已由 pdf.js 内部处理，这里不重复上报
      }
    })();
    return () => {
      cancelled = true;
      // 页面切换或卸载时取消进行中的渲染，避免并发渲染 + 资源泄漏
      const task = renderTaskRef.current;
      if (task) {
        renderTaskRef.current = null;
        try { task.cancel(); } catch { /* 忽略 cancel 异常 */ }
      }
    };
  }, [page, data, docReady, renderTick]);

  return <div ref={bodyRef} className="book-reader-body pdf-body"><canvas ref={canvasRef} /></div>;
}

/* ===== EPUB 引擎：epub.js paginated 左右翻页 ===== */
function EpubEngine({ url, onPercent, onError }: {
  url: string; onPercent: (p: number) => void; onError: (msg: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<{ prev: () => void; next: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const book = ePub(url);
        if (cancelled || !hostRef.current) return;
        const rendition = book.renderTo(hostRef.current, { width: "100%", height: "100%", spread: "none", flow: "paginated" });
        await rendition.display();
        (rendition as unknown as { on: (ev: string, cb: (location: { start: { percentage: number } }) => void) => void }).on("relocated", (location) => {
          const pct = Math.round((location?.start?.percentage ?? 0) * 100);
          onPercent(pct);
        });
        navRef.current = { prev: () => rendition.prev(), next: () => rendition.next() };
        // 键盘翻页（焦点在宿主页面时）；iframe 内的按键由 epub.js 自行处理
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") rendition.next();
          if (e.key === "ArrowLeft") rendition.prev();
        };
        window.addEventListener("keydown", onKey);
        cleanup = () => {
          window.removeEventListener("keydown", onKey);
          rendition.destroy();
          book.destroy();
        };
      } catch {
        if (!cancelled) onError("EPUB 解析失败，文件可能已损坏。");
      }
    })();
    return () => { cancelled = true; cleanup?.(); navRef.current = null; };
  }, [url, onPercent, onError]);

  const touchX = useRef(0);
  return (
    <div
      className="book-reader-body epub-body"
      ref={hostRef}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -50) navRef.current?.next();
        if (dx > 50) navRef.current?.prev();
      }}
    />
  );
}

/* ===== TXT/MD 引擎：按字符量分页，左右翻页 ===== */
const CHARS_PER_PAGE = 1600;

function TxtEngine({ url, index, onReady }: {
  url: string; index: number;
  onReady: (n: number) => void;
}) {
  const [pages, setPages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const text = await (await fetch(url)).text();
      if (cancelled) return;
      const chunks: string[] = [];
      // 按段落边界优先切页，段落超长再硬切
      const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
      let current = "";
      for (const p of paragraphs) {
        if (p.length > CHARS_PER_PAGE) {
          if (current) { chunks.push(current); current = ""; }
          for (let i = 0; i < p.length; i += CHARS_PER_PAGE) chunks.push(p.slice(i, i + CHARS_PER_PAGE));
          continue;
        }
        if (current.length + p.length > CHARS_PER_PAGE) { chunks.push(current); current = p; }
        else current = current ? `${current}\n\n${p}` : p;
      }
      if (current) chunks.push(current);
      setPages(chunks);
      onReady(chunks.length);
    })();
    return () => { cancelled = true; };
  }, [url, onReady]);

  return (
    <div className="book-reader-body txt-body">
      <pre>{pages[Math.min(index, Math.max(pages.length - 1, 0))] ?? ""}</pre>
    </div>
  );
}
```

## 文件：`src/app/life.css（阅读器容器样式）`

```css
/* 8 个生活工具模块通用样式 */

/* ===== 记账本 ===== */
.ledger-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px}
.ledger-stat{display:flex;flex-direction:column;gap:4px;align-items:center;padding:16px;border-radius:14px;background:rgba(255,255,255,.5);text-align:center}
.ledger-stat svg{color:#48b9bd}
.ledger-stat span{font-size:11px;color:#7890a2}
.ledger-stat strong{font-size:22px;color:#344e67}
.ledger-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ledger-form{display:grid;gap:10px}
.ledger-form input,.ledger-form select,.fitness-form input,.fitness-form select,.schedule-form input,.schedule-form select,.habits-form input,.countdown-form input,.countdown-form select,.reading-form input,.reading-form select,.vault-form input,.diary-form input,.diary-form select,.diary-form textarea{width:100%;padding:10px 12px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.7);color:#344e67;font-size:13px;outline:none}
.ledger-form textarea,.diary-form textarea{min-height:80px;resize:vertical}
.ledger-type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ledger-type-toggle button{padding:10px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.5);color:#7890a2;cursor:pointer}
.ledger-type-toggle button.active{background:#48b9bd;color:#fff;border-color:#48b9bd}
.ledger-account-form{display:flex;gap:8px;margin-bottom:12px}
.ledger-account-form input{flex:1;padding:10px 12px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.7);color:#344e67;outline:none}
.ledger-account-list{display:grid;gap:6px}
.ledger-account-list>div{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.45);color:#48677d;font-size:13px}
.ledger-empty{padding:20px;text-align:center;color:#7890a2;font-size:13px}
.ledger-category-bars{display:grid;gap:10px}
.ledger-category-row{display:grid;grid-template-columns:70px 1fr 80px;align-items:center;gap:10px}
.ledger-category-name{font-size:12px;color:#48677d}
.ledger-category-bar{height:12px;border-radius:6px;background:rgba(120,144,162,.15);overflow:hidden}
.ledger-category-bar i{display:block;height:100%;background:linear-gradient(90deg,#48b9bd,#8b5cf6);border-radius:6px}
.ledger-category-value{font-size:12px;color:#344e67;text-align:right}
.ledger-list{display:grid;gap:6px}
.ledger-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.45);font-size:13px;color:#344e67}
.ledger-row .income{color:#10b981;font-weight:600}
.ledger-row .expense{color:#f97316;font-weight:600}
.ledger-row small{color:#7890a2}
.ledger-row button{background:transparent;border:0;color:#7890a2;cursor:pointer;margin-left:auto}
.ledger-tags{font-size:11px;color:#8b5cf6}
.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border:0;border-radius:10px;background:#48b9bd;color:#fff;font-size:13px;cursor:pointer}
.primary-action:hover{background:#3aaeb3}

/* ===== 健身打卡 ===== */
.fitness-summary{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:18px}
.fitness-stat{display:flex;flex-direction:column;gap:4px;align-items:center;padding:16px;border-radius:14px;background:rgba(255,255,255,.5);text-align:center}
.fitness-stat svg{color:#f97316}
.fitness-stat span{font-size:11px;color:#7890a2}
.fitness-stat strong{font-size:22px;color:#344e67}
.fitness-form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.fitness-form .primary-action{grid-column:span 1}

/* ===== 日记 ===== */
.diary-form{display:grid;gap:10px}
.diary-mood-row,.diary-weather-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.diary-label{font-size:12px;color:#7890a2;margin-right:4px}
.diary-mood{display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(120,144,162,.3);border-radius:20px;background:rgba(255,255,255,.5);cursor:pointer}
.diary-mood i{width:12px;height:12px;border-radius:50%}
.diary-mood span{font-size:12px;color:#48677d}
.diary-mood.active{border-color:#48b9bd;background:rgba(72,185,189,.12)}
.diary-search{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.6)}
.diary-search input{border:0;background:transparent;outline:0;color:#344e67;font-size:12px;width:140px}
.diary-timeline{display:grid;gap:10px}
.diary-entry{padding:14px;border-radius:12px;background:rgba(255,255,255,.45)}
.diary-entry-head{display:flex;align-items:center;gap:10px}
.diary-date{font-size:12px;color:#7890a2;font-weight:600}
.diary-mood-dot{width:12px;height:12px;border-radius:50%}
.diary-weather{font-size:12px;color:#48677d}
.diary-entry-head button{margin-left:auto;background:transparent;border:0;color:#7890a2;cursor:pointer}
.diary-entry h3{margin:8px 0 4px;font-size:15px;color:#344e67}
.diary-entry p{margin:0;font-size:13px;color:#48677d;line-height:1.7}

/* ===== 课程表 ===== */
.schedule-form{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.schedule-form .primary-action{grid-column:span 1}
.schedule-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.schedule-day{padding:10px;min-height:160px}
.schedule-day.today{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.25)}
.schedule-day .section-title h2{font-size:11px}
.schedule-course{padding:10px;margin-top:8px;border-left:4px solid;border-radius:8px;background:rgba(255,255,255,.5);font-size:11px;display:grid;gap:3px;position:relative}
.schedule-course strong{color:#344e67;font-size:12px}
.schedule-course span{color:#48677d}
.schedule-course small{color:#7890a2}
.schedule-course>button{position:absolute;top:6px;right:6px;background:transparent;border:0;color:#7890a2;cursor:pointer;padding:0}

/* ===== 习惯打卡 ===== */
.habits-form{display:flex;gap:10px;align-items:center}
.habits-form input{flex:1}
.habits-icon-row{display:flex;gap:6px}
.habits-icon{padding:10px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.5);cursor:pointer}
.habits-icon.active{border-color:#48b9bd;background:rgba(72,185,189,.12);color:#48b9bd}
.habits-list{display:grid;gap:8px}
.habit-row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.45)}
.habit-row.done{background:rgba(72,185,189,.08)}
.habit-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:rgba(72,185,189,.15);color:#48b9bd}
.habit-name{flex:1;font-size:14px;color:#344e67;font-weight:500}
.habit-streak{display:flex;align-items:center;gap:4px;font-size:12px;color:#f97316}
.habit-check{width:28px;height:28px;border-radius:50%;border:2px solid rgba(120,144,162,.4);background:transparent;cursor:pointer;display:grid;place-items:center}
.habit-check.checked{background:#48b9bd;border-color:#48b9bd;color:#fff}
.habit-row>button:last-child{background:transparent;border:0;color:#7890a2;cursor:pointer}

/* ===== 倒数日 ===== */
.countdown-form{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.countdown-list{display:grid;gap:8px}
.countdown-item{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,.45)}
.countdown-item.pinned{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25)}
.countdown-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:rgba(72,185,189,.15);color:#48b9bd}
.countdown-main{flex:1;display:grid;gap:3px}
.countdown-main strong{font-size:14px;color:#344e67}
.countdown-main small{font-size:11px;color:#7890a2}
.countdown-days{font-size:18px;color:#48b9bd;font-weight:600;white-space:nowrap}
.countdown-item button{background:transparent;border:0;color:#7890a2;cursor:pointer}

/* ===== 阅读清单 ===== */
.reading-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:18px}
.reading-stat{display:flex;flex-direction:column;gap:4px;align-items:center;padding:16px;border-radius:14px;background:rgba(255,255,255,.5);text-align:center}
.reading-stat svg{color:#8b5cf6}
.reading-stat span{font-size:11px;color:#7890a2}
.reading-stat strong{font-size:22px;color:#344e67}
.reading-form{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.reading-list{display:grid;gap:8px}
.reading-item{display:flex;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,.45)}
.reading-cover{display:grid;place-items:center;width:44px;height:60px;border-radius:8px;background:linear-gradient(145deg,#8b5cf6,#48b9bd);color:#fff;flex-shrink:0}
.reading-main{flex:1;display:grid;gap:4px}
.reading-main strong{font-size:14px;color:#344e67}
.reading-main small{font-size:11px;color:#7890a2}
.reading-progress-row{display:flex;align-items:center;gap:10px;margin-top:4px}
.reading-status{font-size:11px;padding:3px 8px;border-radius:10px}
.status-want{background:rgba(148,163,184,.2);color:#64748b}
.status-reading{background:rgba(72,185,189,.15);color:#2f8f95}
.status-finished{background:rgba(139,92,246,.15);color:#7c3aed}
.reading-progress-row input[type=range]{flex:1}
.reading-stars{display:flex;gap:2px}
.reading-stars button{background:transparent;border:0;color:#cbd5e1;cursor:pointer;padding:0}
.reading-stars button.active{color:#f59e0b}
.reading-note{font-size:12px;color:#48677d;margin:4px 0 0}
.reading-actions{display:flex;flex-direction:column;gap:6px}
.reading-actions button{background:rgba(255,255,255,.6);border:1px solid rgba(120,144,162,.2);border-radius:8px;color:#48677d;font-size:11px;cursor:pointer;padding:6px 10px;white-space:nowrap}

/* ===== 密码本 ===== */
.vault-setup{max-width:480px;margin:0 auto;padding:24px}
.vault-form{display:grid;gap:10px}
.vault-form input{width:100%;padding:10px 12px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.7);color:#344e67;font-size:13px;outline:none}
.vault-password-row{display:flex;gap:8px}
.vault-password-row input{flex:1}
.vault-password-row button{padding:0 14px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.5);cursor:pointer}
.vault-list{display:grid;gap:8px}
.vault-item{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,.45)}
.vault-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:rgba(139,92,246,.15);color:#8b5cf6}
.vault-main{flex:1;display:grid;gap:3px}
.vault-main strong{font-size:14px;color:#344e67}
.vault-main small{font-size:11px;color:#7890a2}
.vault-password{font-size:13px;color:#48677d;letter-spacing:2px}
.vault-category{font-size:11px;padding:3px 8px;border-radius:10px;background:rgba(139,92,246,.12);color:#7c3aed}
.vault-item button{background:transparent;border:0;color:#7890a2;cursor:pointer}

/* 响应式 */
@media(max-width:900px){
  .ledger-grid,.fitness-summary,.ledger-summary,.reading-summary{grid-template-columns:1fr}
  .fitness-form,.schedule-form,.countdown-form,.reading-form{grid-template-columns:1fr 1fr}
  .schedule-grid{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:600px){
  .schedule-grid{grid-template-columns:1fr}
  .fitness-form,.schedule-form,.countdown-form,.reading-form{grid-template-columns:1fr}
  .ledger-category-row{grid-template-columns:60px 1fr 70px}
}

/* ===== AI 对话 ===== */
.ai-chat-layout{display:grid;grid-template-columns:280px 1fr;gap:14px;min-height:60vh}
.ai-chat-sidebar{padding:14px;display:flex;flex-direction:column;gap:10px}
.ai-chat-model-select select{width:100%;padding:8px 10px;border:1px solid rgba(120,144,162,.3);border-radius:10px;background:rgba(255,255,255,.7);color:#344e67;font-size:13px;outline:none}
.ai-chat-list{display:grid;gap:6px;overflow-y:auto;max-height:40vh}
.ai-chat-list button{padding:10px 12px;border:0;border-radius:10px;background:rgba(255,255,255,.4);color:#48677d;font-size:13px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-chat-list button.active{background:rgba(72,185,189,.15);color:#2f8f95;font-weight:600}
.ai-icon-btn{border:0;background:transparent;color:#48b9bd;cursor:pointer;padding:4px}
.ai-clear-btn{display:flex;align-items:center;gap:6px;justify-content:center;padding:10px;border:1px solid rgba(239,68,68,.3);border-radius:10px;background:rgba(239,68,68,.06);color:#ef4444;font-size:12px;cursor:pointer}
.ai-chat-main{padding:0;display:flex;flex-direction:column;min-height:60vh}
.ai-chat-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#7890a2}
.ai-chat-empty svg{width:48px;height:48px;color:#48b9bd}
.ai-chat-messages{flex:1;overflow-y:auto;padding:18px;display:grid;gap:14px;align-content:start}
.ai-message{display:flex;gap:10px}
.ai-message.user{flex-direction:row-reverse}
.ai-message-avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;flex-shrink:0}
.ai-message.user .ai-message-avatar{background:#48b9bd;color:#fff}
.ai-message.assistant .ai-message-avatar{background:#8b5cf6;color:#fff}
.ai-message-content{max-width:78%;padding:12px 14px;border-radius:14px;font-size:13px;line-height:1.7}
.ai-message.user .ai-message-content{background:rgba(72,185,189,.15);color:#344e67}
.ai-message.assistant .ai-message-content{background:rgba(255,255,255,.55);color:#344e67}
.ai-message-content p{margin:0}
.ai-typing{color:#7890a2;font-style:italic}
.markdown-body h2,.markdown-body h3,.markdown-body h4{margin:10px 0 6px;color:#344e67}
.markdown-body h2{font-size:16px}.markdown-body h3{font-size:15px}.markdown-body h4{font-size:14px}
.markdown-body code{background:rgba(72,185,189,.12);padding:2px 5px;border-radius:4px;font-size:12px;color:#2f8f95}
.markdown-body pre{background:rgba(30,41,59,.9);color:#e2e8f0;padding:12px;border-radius:10px;overflow-x:auto}
.markdown-body pre code{background:transparent;color:#e2e8f0;padding:0}
.markdown-body li{margin:2px 0}
.ai-chat-input{display:flex;gap:10px;padding:14px;border-top:1px solid rgba(120,144,162,.15)}
.ai-chat-input input{flex:1;padding:12px 14px;border:1px solid rgba(120,144,162,.3);border-radius:12px;background:rgba(255,255,255,.7);color:#344e67;font-size:14px;outline:none}
.ai-chat-input button{display:grid;place-items:center;width:46px;border:0;border-radius:12px;background:#48b9bd;color:#fff;cursor:pointer}
.ai-chat-input button:disabled{opacity:.5;cursor:not-allowed}
.ai-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:12px;background:rgba(30,41,59,.92);color:#fff;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:200}

/* ===== 设置页 AI 模型配置 + 背景图 ===== */
.ai-model-form{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.ai-model-form .primary-action{grid-column:span 1}
.ai-model-list{display:grid;gap:8px}
.ai-model-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.45)}
.ai-model-item>div{flex:1;display:grid;gap:3px}
.ai-model-item strong{font-size:13px;color:#344e67}
.ai-model-item small{font-size:11px;color:#7890a2}
.ai-model-item .ai-key{font-size:11px;color:#8b5cf6;letter-spacing:1px}
.ai-model-item button{background:transparent;border:0;color:#7890a2;cursor:pointer}
.bg-upload-row{display:flex;gap:8px}
.bg-preview{height:80px;border-radius:10px;background-size:cover;background-position:center;margin-top:10px;border:1px solid rgba(120,144,162,.2)}
.about-section{margin-top:14px}
.about-section h3{font-size:13px;color:#344e67;margin:0 0 6px}
.about-section ul{margin:0;padding-left:18px}
.about-section li{font-size:12px;color:#48677d;margin:4px 0;line-height:1.6}

@media(max-width:900px){
  .ai-chat-layout{grid-template-columns:1fr}
  .ai-model-form{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){
  .ai-model-form{grid-template-columns:1fr}
}


/* ===== 课程表周次选择（1-20 周） ===== */
.week-row{grid-column:1/-1;display:grid;gap:6px}
.week-row>label{font-size:12px;color:#48677d}
.week-row>label small{display:block;color:#7890a2;font-size:10px}
.week-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.week-chips>button{min-width:34px;height:28px;padding:0 6px;border:1px solid rgba(120,144,162,.35);border-radius:8px;background:rgba(255,255,255,.65);color:#48677d;font-size:11px;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}
.week-chips>button.on{background:#48b9bd;border-color:#48b9bd;color:#fff}
.week-chip-actions{display:flex;gap:6px;margin-left:6px}
.week-chip-actions>button{height:28px;padding:0 10px;border:1px solid rgba(120,144,162,.35);border-radius:8px;background:transparent;color:#397c8d;font-size:11px;cursor:pointer}
.week-chip-actions>button:hover{background:rgba(255,255,255,.7)}
.course-weeks{color:#397c8d!important}
.schedule-course{cursor:pointer}
.schedule-course .week-editor{grid-column:1/-1;margin-top:6px;padding-top:8px;border-top:1px dashed rgba(120,144,162,.3);cursor:default}
.schedule-course .week-editor>label{display:block;font-size:10px;color:#7890a2;margin-bottom:4px}
.schedule-course .week-chips{gap:3px}
.schedule-course .week-chips>button{min-width:24px;height:22px;padding:0 3px;font-size:9px;border-radius:6px}
.schedule-course .week-chip-actions{margin-left:0;width:100%}
.schedule-course .week-chip-actions>button{height:20px;padding:0 8px;font-size:9px}
.schedule-course.week-off{opacity:.45}
.schedule-course .week-off-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;background:rgba(245,158,11,.16);color:#b45309;font-size:9px;font-style:normal;vertical-align:1px}
.term-week-badge{display:inline-block;margin-left:8px;padding:2px 10px;border-radius:10px;background:rgba(72,185,189,.16);color:#2f8f95;font-size:11px}

/* ===== 阅读清单：本地文件添加 ===== */
.reading-file-btn{display:flex;align-items:center;justify-content:center;gap:6px;height:42px;padding:0 14px;border:1px dashed rgba(120,144,162,.45);border-radius:10px;background:rgba(255,255,255,.5);color:#397c8d;font-size:13px;cursor:pointer}
.reading-file-btn:hover{background:rgba(255,255,255,.8)}
.visually-hidden-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.reading-file-tag{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 7px;border-radius:6px;background:rgba(72,185,189,.14);color:#2f8f95;font-size:9px;font-style:normal;vertical-align:1px;white-space:nowrap}
.reading-file-name{color:#7890a2!important;font-style:italic}

/* ===== 应用内阅读器（PDF/EPUB/TXT） ===== */
.book-reader-backdrop{position:fixed;z-index:200;inset:0;background:#0e1a20;color:#e8f2f2;display:grid;grid-template-rows:auto 1fr auto;user-select:none}
.book-reader-head{display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.08)}
.book-reader-head strong{flex:1;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.book-reader-progress{font-size:12px;color:#9fc3c8;font-variant-numeric:tabular-nums}
.book-reader-head button{border:0;background:transparent;color:#9fc3c8;cursor:pointer;padding:4px}
.book-reader-status{display:flex;align-items:center;justify-content:center;gap:8px;color:#9fc3c8;font-size:14px}
.book-reader-body{overflow:hidden;display:grid;place-items:center;min-height:0}
/* PDF：按容器宽度适配，纵向自然高度 + 可上下滚动（不再用 grid 居中，否则超高内容会被裁掉且滚不到）。
   -webkit-overflow-scrolling 让 Android WebView 有惯性滚动；overscroll-behavior 防止滚动穿透到外层。 */
.pdf-body{display:block;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:14px 0 28px}
.pdf-body canvas{display:block;margin:0 auto;max-width:100%;height:auto;border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
.epub-body{width:100%;height:100%}
.txt-body{overflow:hidden;width:100%;height:100%;padding:28px clamp(20px,6vw,80px)}
.txt-body pre{margin:0;width:100%;height:100%;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:clamp(14px,2.2vw,19px);line-height:1.9;color:#dcecec;overflow:hidden}
.book-reader-nav{display:flex;align-items:center;justify-content:center;gap:18px;padding:12px;background:rgba(255,255,255,.06);border-top:1px solid rgba(255,255,255,.08)}
.book-reader-nav button{display:flex;align-items:center;gap:4px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.08);color:#e8f2f2;font-size:13px;padding:8px 18px;cursor:pointer}
.book-reader-nav button:disabled{opacity:.35;cursor:default}
.book-reader-nav span{min-width:70px;text-align:center;font-size:12px;color:#9fc3c8;font-variant-numeric:tabular-nums}
.reading-read-btn{color:#2f8f95!important;border-color:rgba(47,143,149,.4)!important}
```

## 文件：`src/features/life/vault-page.tsx（密码本加密）`

```tsx
"use client";

import { Plus, Trash2, KeyRound, Lock, Shield, Eye, EyeOff, Wand2, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  // 锁定：清除 CryptoKey 与明文状态。页面刷新后天然保持锁定（key 仅存于内存）。
  const lockVault = useCallback(() => {
    setUnlockedKey(null);
    setRevealId(null);
    setMasterPassword("");
  }, []);

  // App 进入后台（WebView 切走 / 失焦）自动锁定密码本。
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) lockVault();
    };
    const onBlur = () => lockVault();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [lockVault]);

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
    // 每个敏感字段独立 IV，避免在同一 AES-GCM key 下重用 nonce。
    const passwordIv = generateIv();
    const urlIv = generateIv();
    const noteIv = generateIv();
    const passwordCipher = await encryptText(unlockedKey, passwordIv, password);
    const urlCipher = await encryptText(unlockedKey, urlIv, url.trim());
    const noteCipher = await encryptText(unlockedKey, noteIv, note.trim());
    workspaceRepository.update((d) => ({
      ...d,
      vaultEntries: [...d.vaultEntries, {
        id: crypto.randomUUID(),
        title: t,
        username: username.trim(),
        passwordCipher,
        urlCipher,
        noteCipher,
        passwordIv,
        urlIv,
        noteIv,
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

  const decryptPassword = async (entry: { passwordCipher: string; passwordIv: string }): Promise<string> => {
    if (!unlockedKey || !vaultMeta) return "";
    try {
      // 新数据用条目自己的 IV，旧数据（无独立 IV）回退 vaultMeta.iv。
      const iv = entry.passwordIv || vaultMeta.iv;
      return await decryptText(unlockedKey, iv, entry.passwordCipher);
    } catch {
      return "";
    }
  };

  const copyPassword = async (entry: { passwordCipher: string; passwordIv: string }) => {
    if (!unlockedKey || !vaultMeta) return;
    try {
      const iv = entry.passwordIv || vaultMeta.iv;
      const plain = await decryptText(unlockedKey, iv, entry.passwordCipher);
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
      <header className="page-heading" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div><p>本地加密</p><h1>密码本</h1><span>已解锁，敏感信息默认掩码显示。</span></div>
        <button type="button" className="primary-action" onClick={lockVault} title="锁定密码本"><Lock /> 锁定</button>
      </header>

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
                onCopy={() => void copyPassword({ passwordCipher: e.passwordCipher, passwordIv: e.passwordIv })}
                onRemove={() => removeEntry(e.id)}
                decryptPassword={(entry) => decryptPassword(entry)}
              />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function VaultRow({ entry, revealed, onToggleReveal, onCopy, onRemove, decryptPassword }: {
  entry: { id: string; title: string; username: string; passwordCipher: string; urlCipher: string; noteCipher: string; passwordIv: string; category: string };
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRemove: () => void;
  decryptPassword: (entry: { passwordCipher: string; passwordIv: string }) => Promise<string>;
}) {
  const [plain, setPlain] = useState<string | null>(null);
  // 令牌用于忽略旧的异步解密结果：快速「显示→隐藏」时，旧 Promise 完成后不得再显示明文。
  const revealToken = useRef(0);

  const handleToggle = () => {
    revealToken.current += 1;
    setPlain(null);
    if (!revealed) {
      const token = revealToken.current;
      void decryptPassword({ passwordCipher: entry.passwordCipher, passwordIv: entry.passwordIv }).then((p) => {
        if (revealToken.current === token) setPlain(p);
      });
    }
    onToggleReveal();
  };

  return (
    <div className="vault-item">
      <span className="vault-icon"><Lock /></span>
      <div className="vault-main">
        <strong>{entry.title}</strong>
        {entry.username && <small>{entry.username}</small>}
        <span className="vault-password">{revealed ? (plain ?? "••••••••") : "••••••••"}</span>
      </div>
      {entry.category && <span className="vault-category">{entry.category}</span>}
      <button aria-label="显示/隐藏" onClick={handleToggle}>{revealed ? <EyeOff /> : <Eye />}</button>
      <button aria-label="复制" onClick={onCopy}><Copy /></button>
      <button aria-label="删除" onClick={onRemove}><Trash2 /></button>
    </div>
  );
}
```

## 文件：`src/features/themes/registry.ts（主题预设元数据）`

```typescript
import type { ThemeId } from "../data/schema";

/** 主题预设：仅描述元信息与渐变预览，具体配色由 CSS 变量（theme-presets.css）承载。 */
export type ThemePreset = {
  id: ThemeId;
  label: string;
  /** 预览卡渐变，仅用于展示，不写入页面素材 */
  gradient: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", label: "默认", gradient: "linear-gradient(180deg,#eaf7f7 0%,#dceef0 100%)" },
  { id: "ink-blue", label: "砚蓝", gradient: "linear-gradient(180deg,#404D62 0%,#DDBECA 100%)" },
  { id: "rose-mist", label: "玫雾", gradient: "linear-gradient(180deg,#E87C8D 0%,#F9CB8E 100%)" },
  { id: "sakura-almond", label: "樱杏", gradient: "linear-gradient(180deg,#946368 0%,#F3D6BD 100%)" },
  { id: "moon-frost", label: "月霜", gradient: "linear-gradient(180deg,#B0B1CF 0%,#F1E2D2 100%)" },
  { id: "moss-peach", label: "苔桃", gradient: "linear-gradient(180deg,#A66191 0%,#F1E9DA 100%)" },
];

/** 非默认主题需要由 CSS 提供变量覆盖；这里用于统一判断。 */
export function isPresetTheme(theme: ThemeId): boolean {
  return theme !== "default";
}
```

## 文件：`src/features/themes/theme-provider.tsx（主题应用）`

```tsx
"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/features/data/use-workspace";

/**
 * 主题应用器：只把当前主题写到 <html data-theme>，配色全部由 CSS 变量承载。
 * 默认主题（default）在 CSS 中没有任何覆盖规则，因此不会改变原有视觉。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const data = useWorkspace();
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  return children;
}
```

## 文件：`src/app/theme-presets.css（主题变量）`

```css
/* ===== 内置渐变主题：一套 UI + 多套主题变量 =====
 * 只用 CSS 变量驱动配色，不复制页面组件，不新增图片素材。
 * 默认主题（default）在此不加任何覆盖，完全保持原有视觉效果。
 */

/* 1. 砚蓝 */
html[data-theme="ink-blue"]{
  --theme-bg-start:#404D62; --theme-bg-end:#DDBECA;
  --base:#404D62;
  --surface:rgba(41,48,62,.72); --surface-strong:rgba(48,56,72,.90);
  --text:#F5F2F7!important; --muted:#C9C3D2!important;
  --accent:#DDBECA!important; --accent-soft:#EFD9E1;
  --border:rgba(221,190,202,.34); --glow:rgba(221,190,202,.20);
}
/* 2. 玫雾 */
html[data-theme="rose-mist"]{
  --theme-bg-start:#E87C8D; --theme-bg-end:#F9CB8E;
  --base:#E87C8D;
  --surface:rgba(255,252,250,.74); --surface-strong:rgba(255,253,251,.92);
  --text:#4A3540!important; --muted:#7A6370!important;
  --accent:#C4566B!important; --accent-soft:#E87C8D;
  --border:rgba(148,86,105,.28); --glow:rgba(232,124,141,.22);
}
/* 3. 樱杏 */
html[data-theme="sakura-almond"]{
  --theme-bg-start:#946368; --theme-bg-end:#F3D6BD;
  --base:#946368;
  --surface:rgba(255,250,246,.74); --surface-strong:rgba(255,252,249,.92);
  --text:#4A3238!important; --muted:#7C6169!important;
  --accent:#946368!important; --accent-soft:#C79A91;
  --border:rgba(148,99,104,.28); --glow:rgba(148,99,104,.20);
}
/* 4. 月霜 */
html[data-theme="moon-frost"]{
  --theme-bg-start:#B0B1CF; --theme-bg-end:#F1E2D2;
  --base:#B0B1CF;
  --surface:rgba(252,252,255,.74); --surface-strong:rgba(253,253,255,.92);
  --text:#3B3F55!important; --muted:#6E7290!important;
  --accent:#6B6E9C!important; --accent-soft:#A9AACB;
  --border:rgba(107,110,156,.28); --glow:rgba(176,177,207,.24);
}
/* 5. 苔桃 */
html[data-theme="moss-peach"]{
  --theme-bg-start:#A66191; --theme-bg-end:#F1E9DA;
  --base:#A66191;
  --surface:rgba(255,251,252,.74); --surface-strong:rgba(255,253,254,.92);
  --text:#4A2E42!important; --muted:#7C5C72!important;
  --accent:#8E4E7C!important; --accent-soft:#C88FB0;
  --border:rgba(166,97,145,.28); --glow:rgba(166,97,145,.20);
}

/* ===== 非默认主题的统一结构覆盖：只改色彩体系，不动布局/圆角/阴影/字体 ===== */
html:is([data-theme="ink-blue"],[data-theme="rose-mist"],[data-theme="sakura-almond"],[data-theme="moon-frost"],[data-theme="moss-peach"]){
  /* 主背景渐变（用户自定义背景图通过行内样式覆盖，优先级更高） */
  body,.scene-artwork{background:linear-gradient(180deg,var(--theme-bg-start) 0%,var(--theme-bg-end) 100%)}
  .scene-artwork:before{background:linear-gradient(90deg,color-mix(in srgb,var(--surface) 56%,transparent),transparent 62%)}
  .scene-artwork:after{background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--base) 14%,transparent))}
  /* 侧栏 */
  .sidebar{background:var(--surface);border-right:1px solid var(--border)}
  .sidebar nav a{color:var(--muted)}
  .sidebar nav a:hover{color:var(--text)}
  .sidebar nav a.active{background:var(--surface-strong);color:var(--text);box-shadow:inset 3px 0 var(--accent)}
  /* 顶栏 / 命令触发 */
  .date-time{color:var(--text);text-shadow:0 1px 8px color-mix(in srgb,var(--base) 45%,transparent)}
  .command-trigger{background:var(--surface);color:var(--muted);border-color:var(--border)}
  /* 首页与卡片（覆盖 final-ui 中的固定浅色） */
  .final-home,.final-home *{color:var(--text)}
  .glass-light{background:var(--surface);border-color:var(--border)}
  .final-task i{border-color:var(--muted)}
  .apps-panel i{color:var(--accent)}
  .focus-dial{border-color:color-mix(in srgb,var(--accent) 32%,transparent);border-right-color:var(--accent)}
  /* 输入框 / 按钮 */
  .chat-input{background:var(--surface)}
  .chat-input button{background:var(--accent);color:var(--surface-strong)}
  /* 弹窗与通用面板跟随变量 */
  .dialog-backdrop{background:color-mix(in srgb,var(--base) 55%,transparent)}
  .confirm-dialog,.app-picker{background:var(--surface-strong);border-color:var(--border)}
}

/* ===== 设置页：主题颜色预览卡 ===== */
.theme-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px}
.theme-card{position:relative;display:grid;gap:6px;padding:0;border:1px solid rgba(120,144,162,.25);border-radius:12px;background:rgba(255,255,255,.5);cursor:pointer;overflow:hidden;text-align:left}
.theme-card .theme-swatch{height:56px;width:100%}
.theme-card span{display:block;padding:7px 10px;font-size:12px;color:#344e67}
.theme-card.active{border:2px solid #4db9bc;box-shadow:0 0 0 3px rgba(77,185,188,.18)}
.theme-card.active span{font-weight:600}
@media(max-width:600px){.theme-grid{grid-template-columns:repeat(2,1fr)}}
```

## 文件：`LaunchPlugin.kt`

```kotlin
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

## 文件：`MainActivity.kt`

```kotlin
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

---

## 附：审查重点与已知情况（供第三方 AI 参考）

### 🔴 P0 —— 原生命令层（安全边界）
1. **`launch.rs`**：URL 校验（http/https 白名单）、拒绝控制字符、路径校验、可执行命令白名单。
2. **`LaunchPlugin.kt`**：启动第三方应用 / 打开网址 / 枚举应用，含 scheme 白名单、IO 协程防 ANR、
   `resolveSafely`/`rejectSafely`、`bitmap.recycle()` finally。
3. **`lib.rs`**：Android 插件注册 + 命令注册。

### 🟡 P1 —— 数据与加密层
4. **`crypto.ts`**：密码本 AES-GCM + PBKDF2，每字段独立 IV，密钥仅存内存。
5. **`repository.ts`**：localStorage 读写 + 订阅（storage key 迁移）。
6. **`ai-client.ts`**：AI 客户端 fetch + 60s 超时。
7. **`transfer.ts`**：数据导入导出 + 完整 ZIP 备份（jszip + 资源限制 + 书籍校验 + 回滚 + 损坏条目 invalid-zip）。
   书籍校验需同时满足：bookId 存在、`source==="file"`、fileName 非空、ZIP 条目名与元数据一致、同一 bookId 单一文件。
8. **`book-storage.ts`**：IndexedDB 书籍 blob 存储（`runTx()` 与 `getAllBookFiles()` 均以 transaction.oncomplete 判定成功）。
9. **`vault-page.tsx`**：密码本 UI，进后台自动锁定 + 手动锁定 + 异步解密竞态防护（令牌忽略旧结果）。

### 开源版合规说明（已去风险）
- 无 Obsidian 集成、无境外 AI 服务、品牌已更名 Zynthel。
- `validate_url` 仅 http/https（无 obsidian scheme）。

### 主题系统说明（本轮新增，非安全面）
- 仅 CSS 变量 + `html[data-theme]` 属性，`default` 主题**不加任何覆盖规则**，原有默认视觉完全不变。
- `themeIdSchema` 为枚举，旧数据 `default` 继续校验通过；主题随完整备份/恢复一起保存。
- 无网络请求、无本地存储新增字段（复用 settings.theme）、无加密改动。

### PDF 页面显示适配说明（本轮，非安全面）
- 改动面：仅 `src/features/life/book-reader.tsx` 与 `src/app/life.css`。
  未动 EPUB / TXT·MD 链路，未动主题、密码本、AI、备份、Kotlin / Rust 启动器、包名与品牌。
- 适配策略：PDF 按容器宽度铺满、高度自然延展，容器纵向可滚动（惯性滚动 + overscroll 隔离）；
  渲染倍率封顶 2 且单张 canvas 限制 16M 像素，避免高 DPR 设备 OOM。
- 已知限制：EPUB 仍由 epub.js 分页渲染（本轮未改动）；TXT·MD 分页逻辑未改动。

### PDF 阅读修复说明（本轮，非安全面）
- 改动面：仅 `src/features/life/book-reader.tsx`。未动 UI / 主题 / 首页 / 密码本 / AI / App Picker /
  课程表 / 日记 / 记账 / 备份架构 / Kotlin·Rust 启动器 / 包名 / 品牌名。
- 两版结构一致，已同步同一套修复；内测版既有功能未受影响。
- 验证（Chromium + 真实产物，非模拟器）：
  1) **根因复现**：把 `.mjs` 以 `application/octet-stream` 提供时，旧链路必失败并报
     `Setting up fake worker failed` + `Strict MIME type checking is enforced for module scripts`；
     新链路在同一条件下解析成功。
  2) **端到端**：真实 `out/` 产物 + 3 个测试 PDF（1 页纯文字 / 8 页多页 / 3 页图片密集）：
     首屏渲染、连续翻页、上一页、关闭重开后进度记忆，全部通过。
- ⚠️ Android 真机 APK 尚未重建（按要求本轮不产出 APK），真机复测待确认。

### 验证基线
- typecheck ✓ / lint ✓ / test 45/45 ✓ / build 20 页（含 /help）✓ / cargo test 7 ✓ / cargo check ✓。
- APK：上一轮（commit a943103）已签名通过（`com.zynthel.workspace`）；**本轮 PDF 修复尚未重建 APK**。

### 与内测版差异（供对比审查）
- 开源版包名 `com.zynthel.workspace`；内测版 `com.solaris.personal_terminal`。
- 开源版无 Obsidian 集成、无境外 AI 服务。
- 开源版多内置《使用说明》（`/help`，离线随 APK）。
- 阅读器、备份、IndexedDB、termSchema、密码本、主题系统**两版已完全同步一致**。
