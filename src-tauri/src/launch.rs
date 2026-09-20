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
  /// 该扩展名具有执行或跳转能力，不允许通过普通「本地文件打开」通道启动。
  FileTypeNotAllowed,
  /// 该路径不是后端实际扫描/确认过的本机应用，不能走「本机应用启动」通道。
  AppNotConfirmed,
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
  /// 「后端确认过的本机应用」专用通道：只有 find_local_app 实际扫描命中的路径才被接受。
  /// 与 LocalPath 分开，避免前端伪造一个普通路径拿到应用启动权限。
  LocalApp { path: String },
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
#[tauri::command(name = "detect-applications")]
pub fn detect_applications(_app: tauri::AppHandle) -> Vec<AppStatus> {
  // 不预置任何第三方应用检测，应用列表由用户自行添加。
  Vec::new()
}

#[cfg(target_os = "android")]
#[tauri::command(name = "launch-resource")]
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
    LaunchMethod::MacosApp { .. }
    | LaunchMethod::LocalPath { .. }
    | LaunchMethod::LocalApp { .. }
    | LaunchMethod::CustomCommand { .. } => Err(LaunchError::Unsupported),
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
#[tauri::command(name = "detect-applications")]
pub fn detect_applications() -> Vec<AppStatus> {
  #[cfg(target_os = "macos")] {
    [
      ("krita", "Krita", "/Applications/Krita.app"),
      ("terminal", "Terminal", "/System/Applications/Utilities/Terminal.app"),
      ("finder", "Finder", "/System/Library/CoreServices/Finder.app"),
      ("vscode", "Visual Studio Code", "/Applications/Visual Studio Code.app"),
      ("github-desktop", "GitHub Desktop", "/Applications/GitHub Desktop.app"),
    ].into_iter().map(|(id,name,path)|AppStatus{id:id.into(),name:name.into(),path:path.into(),installed:Path::new(path).exists()}).collect()
  }
  #[cfg(not(target_os = "macos"))] {
    // Windows / Linux：不预置任何第三方应用检测，由用户自行添加。
    Vec::new()
  }
}

#[cfg(not(target_os = "android"))]
pub fn validate_path(value: &str) -> Result<PathBuf, LaunchError> {
  validate_argument(value)?;
  let path = PathBuf::from(value);
  if !path.is_absolute() { return Err(LaunchError::InvalidPath); }
  Ok(path)
}

/// Windows 上「具有执行或跳转能力」的扩展名：普通本地文件打开通道一律拒绝。
///
/// 覆盖任务书明确要求的 exe / com / bat / cmd / ps1 / msi / lnk / url，
/// 以及 Windows 其余常见的可执行、脚本化与跳转入口：
/// - scr / pif：可执行屏幕保护与程序信息文件（历史执行入口）
/// - vbs / vbe / js / jse / wsf / wsh：Windows Script Host 脚本族
/// - hta：HTML Application（以 mshta 执行）
/// - jar：Java 可执行包
/// - appref-ms / application：ClickOnce 部署入口
/// - reg：注册表导入（写入系统配置）
/// - scf / inf / cpl：Shell 命令文件、安装信息、控制面板项
/// - dll / sys：可被 rundll32 等宿主加载执行的二进制
/// - gadget / vb：遗留可执行小工具与脚本
#[cfg(all(not(target_os = "android"), target_os = "windows"))]
const FORBIDDEN_WINDOWS_EXTENSIONS: &[&str] = &[
  "exe", "com", "bat", "cmd", "ps1", "psm1", "msi", "lnk", "url", "scr", "pif",
  "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "jar", "appref-ms", "application",
  "reg", "scf", "inf", "cpl", "dll", "sys", "gadget", "vb",
];

/// macOS / Linux 上的等价清单：可执行脚本与可直接启动的应用包/桌面入口。
/// 注意不要把普通文档、图片、音视频、压缩包误伤进去。
#[cfg(all(not(target_os = "android"), not(target_os = "windows")))]
const FORBIDDEN_UNIX_EXTENSIONS: &[&str] = &[
  "command", "sh", "bash", "zsh", "csh", "ksh", "fish", "run", "appimage", "desktop", "app",
];

/// 普通 `LocalPath` 通道的安全边界：路径必须存在，且不是可启动/可跳转的文件类型。
/// 文档、图片、音视频、压缩包等常规资源不受影响。
#[cfg(not(target_os = "android"))]
pub fn validate_local_file(path: &Path) -> Result<(), LaunchError> {
  if !path.exists() { return Err(LaunchError::InvalidPath); }
  let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
    return Ok(()); // 无扩展名：Windows 无法直接执行，按普通文件处理
  };
  let lower = extension.to_ascii_lowercase();
  #[cfg(target_os = "windows")]
  {
    if FORBIDDEN_WINDOWS_EXTENSIONS.contains(&lower.as_str()) {
      return Err(LaunchError::FileTypeNotAllowed);
    }
  }
  #[cfg(not(target_os = "windows"))]
  {
    if FORBIDDEN_UNIX_EXTENSIONS.contains(&lower.as_str()) {
      return Err(LaunchError::FileTypeNotAllowed);
    }
  }
  Ok(())
}

/* ---------------- 后端确认过的本机应用（独立权限通道） ---------------- */

/// 文件身份快照：登记时采集，启动时重新计算比对，用于识别「同路径 + 同类型被替换」。
///
/// 只比较路径字符串不够——扫描 `Good.exe` 登记后，攻击者可以把另一个同名 `.exe`
/// 覆盖到同一路径，路径、扩展名、形态、扫描根、登记表全部不变，旧确认仍然生效。
/// 这里额外记录文件长度、修改时间，以及内容的 FNV-1a 64 位指纹：
/// 任何真实替换都会改变其中至少一项（内容指纹尤其无法靠改时间戳伪造），
/// 从而让旧确认状态失效。
///
/// macOS 的 `.app` 是目录，改用「目录修改时间 + 顶层条目名哈希」作为指纹，
/// 同样能识别「整个应用包被换成另一个同名包」的情况。
#[cfg(not(target_os = "android"))]
#[derive(Clone, Debug, PartialEq, Eq)]
struct FileFingerprint {
  /// 文件字节长度；目录则为直接子条目数。
  len: u64,
  /// 最后修改时间（纳秒），来自 `metadata().modified()`；不可用时为 0。
  mtime_ns: u64,
  /// 内容指纹：文件 = 头部+尾部字节的 FNV-1a；目录 = 排序后顶层条目名的 FNV-1a。
  hash: u64,
}

#[cfg(not(target_os = "android"))]
const FINGERPRINT_HEAD_BYTES: usize = 64 * 1024; // 文件头部采样 64 KiB
#[cfg(not(target_os = "android"))]
const FINGERPRINT_TAIL_BYTES: usize = 64 * 1024; // 文件尾部采样 64 KiB

#[cfg(not(target_os = "android"))]
impl FileFingerprint {
  /// 读取文件元数据 + 内容（文件）或顶层条目名（目录），计算身份指纹。
  /// 任何一步失败返回 None（按不可信处理）。
  fn compute(path: &Path) -> Option<Self> {
    let metadata = std::fs::metadata(path).ok()?;
    let mtime_ns = metadata.modified().ok()
      .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|d| d.as_nanos() as u64)
      .unwrap_or(0);

    if metadata.is_dir() {
      // macOS `.app` 等目录形态的应用包：用「直接子条目名 + 类型」排序哈希作为指纹。
      let mut names: Vec<Vec<u8>> = Vec::new();
      if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
          let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
          let mut key = entry.file_name().to_string_lossy().into_owned().into_bytes();
          key.push(if is_dir { b'/' } else { b'.' });
          names.push(key);
        }
      }
      names.sort();
      let mut hasher = Fnv1a::new();
      for name in &names { hasher.write(name); }
      return Some(FileFingerprint { len: names.len() as u64, mtime_ns, hash: hasher.finish() });
    }

    if !metadata.is_file() { return None; }
    let len = metadata.len();

    // 头部 + 尾部采样；文件小于两倍采样窗口时自然覆盖全文件。
    let head_len = (FINGERPRINT_HEAD_BYTES as u64).min(len) as usize;
    let tail_len = (FINGERPRINT_TAIL_BYTES as u64).min(len.saturating_sub(head_len as u64)) as usize;

    let mut hasher = Fnv1a::new();
    let mut file = std::fs::File::open(path).ok()?;
    use std::io::Read;
    if head_len > 0 {
      let mut buf = vec![0u8; head_len];
      file.read_exact(&mut buf).ok()?;
      hasher.write(&buf);
    }
    if tail_len > 0 {
      use std::io::{Seek, SeekFrom};
      file.seek(SeekFrom::Start(len.saturating_sub(tail_len as u64))).ok()?;
      let mut buf = vec![0u8; tail_len];
      file.read_exact(&mut buf).ok()?;
      hasher.write(&buf);
    }
    Some(FileFingerprint { len, mtime_ns, hash: hasher.finish() })
  }
}

/// 极简 FNV-1a 64 位哈希（无外部依赖，逐字节滚动，O(采样长度)）。
#[cfg(not(target_os = "android"))]
struct Fnv1a(u64);
#[cfg(not(target_os = "android"))]
impl Fnv1a {
  fn new() -> Self { Fnv1a(0xcbf29ce484222325) }
  fn write(&mut self, bytes: &[u8]) {
    for &byte in bytes {
      self.0 ^= byte as u64;
      self.0 = self.0.wrapping_mul(0x100000001b3);
    }
  }
  fn finish(&self) -> u64 { self.0 }
}

/// `find_local_app` 实际扫描命中的应用登记表（进程内，不落盘）。
/// key 为规范化后的路径字符串（小写），value 为「后端确认时的真实路径 + 文件身份快照」。
/// 只有出现在本表中、且启动时文件身份仍与登记时一致的路径才允许走 `LocalApp` 通道启动。
#[cfg(not(target_os = "android"))]
fn confirmed_apps() -> &'static std::sync::Mutex<std::collections::HashMap<String, (PathBuf, FileFingerprint)>> {
  use std::sync::{Mutex, OnceLock};
  static REGISTRY: OnceLock<Mutex<std::collections::HashMap<String, (PathBuf, FileFingerprint)>>> = OnceLock::new();
  REGISTRY.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

#[cfg(not(target_os = "android"))]
fn confirmed_key(path: &Path) -> String {
  path.to_string_lossy().to_lowercase()
}

/// 由 `find_local_app` 在扫描命中时调用，登记为「后端确认过的本机应用」，
/// 并采集该文件当下的身份指纹。指纹采集失败则**不登记**（宁可不可用，不可盲信）。
#[cfg(not(target_os = "android"))]
pub fn register_confirmed_app(path: &Path) {
  let Some(fingerprint) = FileFingerprint::compute(path) else { return };
  if let Ok(mut registry) = confirmed_apps().lock() {
    registry.insert(confirmed_key(path), (path.to_path_buf(), fingerprint));
  }
}

/// 该路径是否经过后端实际扫描确认（只判断「是否登记过」，不校验文件身份）。
#[cfg(not(target_os = "android"))]
pub fn is_confirmed_app(path: &Path) -> bool {
  confirmed_apps()
    .lock()
    .map(|registry| registry.contains_key(&confirmed_key(path)))
    .unwrap_or(false)
}

/// 该路径当前文件身份是否仍与登记时一致（用于识别「同路径同类型被替换」）。
/// 未登记 → false；文件已无法读取/指纹计算失败 → false（按被替换处理）。
#[cfg(not(target_os = "android"))]
fn is_fingerprint_unchanged(path: &Path) -> bool {
  let Some(current) = FileFingerprint::compute(path) else { return false };
  confirmed_apps()
    .lock()
    .map(|registry| {
      registry.get(&confirmed_key(path))
        .map(|(_, registered)| registered == &current)
        .unwrap_or(false)
    })
    .unwrap_or(false)
}

/// 该路径是否落在后端允许扫描的应用来源目录内（`local_app_roots()` 之下）。
/// 用 canonicalize 比对，避免通过符号链接把目标挪出受信任目录。
#[cfg(not(target_os = "android"))]
pub fn is_within_local_app_roots(path: &Path) -> bool {
  let Ok(target) = path.canonicalize() else { return false };
  local_app_roots().into_iter().any(|root| {
    root.canonicalize().map(|canonical| target.starts_with(canonical)).unwrap_or(false)
  })
}

/// **启动前重新确认**（TOCTOU 防护）。
///
/// 登记表只说明「这个路径曾经被后端扫描命中过」，不能当作永久信任：
/// 扫描之后该文件完全可能被替换、被删除、被改成别的类型。
/// 因此真正启动 `LocalApp` 之前必须重新验证当前目标本身：
/// 1. 仍然存在
/// 2. 仍是允许的本机应用入口类型（`is_app_entry`）
/// 3. 形态仍然正确（macOS 的 `.app` 必须是目录；Windows 的 `.lnk/.exe/.url` 必须是文件）
/// 4. 仍位于后端允许扫描的应用来源目录内
/// 5. 仍在登记表内（前端不能凭空构造路径）
/// 6. 文件身份快照与登记时一致（杜绝「同路径 + 同类型被替换」后旧确认仍生效）
#[cfg(not(target_os = "android"))]
pub fn revalidate_local_app(path: &Path) -> Result<(), LaunchError> {
  if !path.exists() { return Err(LaunchError::InvalidPath); }
  if !is_app_entry(path) { return Err(LaunchError::FileTypeNotAllowed); }
  let is_dir = path.is_dir();
  if cfg!(target_os = "macos") && !is_dir {
    // .app 被替换成了同名普通文件 → 不再是可启动的应用包
    return Err(LaunchError::FileTypeNotAllowed);
  }
  if !cfg!(target_os = "macos") && is_dir {
    // Windows 的 .lnk/.exe/.url 必须是文件，目录形态不合法
    return Err(LaunchError::FileTypeNotAllowed);
  }
  if !is_within_local_app_roots(path) { return Err(LaunchError::AppNotConfirmed); }
  if !is_confirmed_app(path) { return Err(LaunchError::AppNotConfirmed); }
  // 最后一道：同路径 + 同类型的文件被替换，必须让旧确认失效。
  if !is_fingerprint_unchanged(path) { return Err(LaunchError::AppNotConfirmed); }
  Ok(())
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

// 用系统默认程序打开 URL 或本地文件路径。
// 跨平台均不调用 cmd / PowerShell，也不拼接 shell 字符串：
// - Windows 走 rundll32 url.dll,FileProtocolHandler（ShellExecute 的安全封装）
// - macOS 走 /usr/bin/open
// - Linux 走 xdg-open
#[cfg(all(not(target_os = "android"), target_os = "windows"))]
fn open_via_default_handler(target: String) -> Result<LaunchResult, LaunchError> {
  Command::new("rundll32")
    .arg("url.dll,FileProtocolHandler")
    .arg(target)
    .spawn()
    .map_err(|_| LaunchError::LaunchFailed)?;
  Ok(LaunchResult { ok: true })
}

#[cfg(all(not(target_os = "android"), target_os = "macos"))]
fn open_via_default_handler(target: String) -> Result<LaunchResult, LaunchError> {
  Command::new("/usr/bin/open")
    .arg(target)
    .spawn()
    .map_err(|_| LaunchError::LaunchFailed)?;
  Ok(LaunchResult { ok: true })
}

#[cfg(all(not(target_os = "android"), not(any(target_os = "windows", target_os = "macos"))))]
fn open_via_default_handler(target: String) -> Result<LaunchResult, LaunchError> {
  Command::new("xdg-open")
    .arg(target)
    .spawn()
    .map_err(|_| LaunchError::LaunchFailed)?;
  Ok(LaunchResult { ok: true })
}

#[cfg(not(target_os = "android"))]
#[tauri::command(name = "launch-resource")]
pub fn launch_resource(request: LaunchEnvelope) -> Result<LaunchResult, LaunchError> {
  match request.launch {
    LaunchMethod::Website { url } => {
      validate_url(&url)?;
      open_via_default_handler(url)
    }
    LaunchMethod::AndroidApp { fallback_url, .. } => {
      let url = fallback_url.ok_or(LaunchError::Unsupported)?;
      validate_url(&url)?;
      open_via_default_handler(url)
    }
    LaunchMethod::LocalPath { path } => {
      let local_path = validate_path(&path)?;
      // 普通本地文件通道：只打开文档/资源，绝不启动可执行或可跳转的文件。
      validate_local_file(&local_path)?;
      open_via_default_handler(path)
    }
    LaunchMethod::LocalApp { path } => {
      let app_path = validate_path(&path)?;
      // 不能只查「这个路径字符串以前登记过没有」：登记之后文件可能被替换。
      // 启动前按当前磁盘上的真实目标重新确认一遍（存在性/类型/形态/来源目录/登记）。
      revalidate_local_app(&app_path)?;
      open_via_default_handler(path)
    }
    LaunchMethod::MacosApp { app_name, path } => {
      #[cfg(target_os = "macos")] {
        let app_path = validate_path(&path)?;
        if !app_path.exists() { return Err(LaunchError::MissingApp); }
        validate_argument(&app_name)?;
        Command::new("/usr/bin/open").args(["-a", &app_name]).spawn().map_err(|_| LaunchError::LaunchFailed)?;
        Ok(LaunchResult { ok: true })
      }
      #[cfg(not(target_os = "macos"))] { Err(LaunchError::Unsupported) }
    }
    LaunchMethod::CustomCommand { executable, args } => {
      // Windows：禁止任意命令执行，不把用户输入传入 Command::new，严格拒绝。
      #[cfg(target_os = "windows")] { let _ = (executable, args); Err(LaunchError::CommandNotAllowed) }
      #[cfg(not(target_os = "windows"))] {
        for argument in &args { validate_argument(argument)?; }
        let exe = resolve_executable(&executable)?;
        Command::new(exe).args(args).spawn().map_err(|_| LaunchError::LaunchFailed)?;
        Ok(LaunchResult { ok: true })
      }
    }
  }
}

/* ------------------- 本机桌面客户端探测（本地优先） ------------------- */

/// 本机找到的一个桌面应用条目（供首页内置入口判断「本地优先」）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAppMatch {
  pub id: String,
  pub name: String,
  pub path: String,
}

/// 只读遍历的上限，避免在超大目录树上卡住 UI。
#[cfg(not(target_os = "android"))]
const MAX_SCAN_ENTRIES: usize = 4_000;
#[cfg(not(target_os = "android"))]
const MAX_SCAN_DEPTH: usize = 4;
#[cfg(not(target_os = "android"))]
const MAX_KEYWORDS: usize = 8;
#[cfg(not(target_os = "android"))]
const MAX_KEYWORD_LEN: usize = 64;

/// 本机常见「已安装应用」目录（全部来自环境变量/固定系统路径，不含任何用户输入）。
#[cfg(not(target_os = "android"))]
fn local_app_roots() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();
  #[cfg(target_os = "windows")]
  {
    // Windows 客户端安装后会在开始菜单建立快捷方式；用户级与全局都查。
    if let Some(appdata) = std::env::var_os("APPDATA") {
      roots.push(Path::new(&appdata).join("Microsoft").join("Windows").join("Start Menu").join("Programs"));
    }
    if let Some(programdata) = std::env::var_os("PROGRAMDATA") {
      roots.push(Path::new(&programdata).join("Microsoft").join("Windows").join("Start Menu").join("Programs"));
    }
    // 部分应用（如 Electron 系）只装在用户目录下，没有开始菜单项。
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
      roots.push(Path::new(&local).join("Programs"));
    }
  }
  #[cfg(target_os = "macos")]
  {
    roots.push(PathBuf::from("/Applications"));
    if let Some(home) = std::env::var_os("HOME") {
      roots.push(Path::new(&home).join("Applications"));
    }
  }
  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
  {
    if let Some(home) = std::env::var_os("HOME") {
      roots.push(Path::new(&home).join(".local").join("share").join("applications"));
    }
    roots.push(PathBuf::from("/usr/share/applications"));
  }
  roots
}

/// 该文件是否是「可启动的桌面应用条目」。
#[cfg(not(target_os = "android"))]
fn is_app_entry(path: &Path) -> bool {
  let Some(ext) = path.extension().and_then(|value| value.to_str()) else { return false };
  let lower = ext.to_ascii_lowercase();
  if cfg!(target_os = "windows") {
    matches!(lower.as_str(), "lnk" | "exe" | "url")
  } else if cfg!(target_os = "macos") {
    lower == "app"
  } else {
    lower == "desktop"
  }
}

#[cfg(not(target_os = "android"))]
fn scan_app_entries(dir: &Path, depth: usize, budget: &mut usize, out: &mut Vec<PathBuf>) {
  if depth > MAX_SCAN_DEPTH || *budget == 0 { return; }
  let Ok(entries) = std::fs::read_dir(dir) else { return };
  for entry in entries.flatten() {
    if *budget == 0 { return; }
    *budget -= 1;
    let path = entry.path();
    let Ok(kind) = entry.file_type() else { continue };
    // macOS 的 .app 本身是「目录形式的可执行包」，必须当成条目而不是继续递归进去，
    // 否则永远匹配不到 /Applications 下的应用。
    if is_app_entry(&path) {
      out.push(path);
      continue;
    }
    if kind.is_dir() {
      scan_app_entries(&path, depth + 1, budget, out);
    }
  }
}

/// 按关键词在本机查找已安装的桌面客户端。
/// 只做只读目录遍历，**不执行任何命令**。
/// 命中的路径会被登记进「后端确认应用表」，前端只能以 `LocalApp` 通道启动它们；
/// 普通 `LocalPath` 通道已拒绝一切可执行/可跳转文件，两条通道互不越权。
#[cfg(not(target_os = "android"))]
#[tauri::command(name = "find-local-app")]
pub fn find_local_app(keywords: Vec<String>) -> Vec<LocalAppMatch> {
  let needles: Vec<String> = keywords
    .into_iter()
    .take(MAX_KEYWORDS)
    .map(|keyword| keyword.trim().to_lowercase())
    .filter(|keyword| !keyword.is_empty() && keyword.len() <= MAX_KEYWORD_LEN)
    .collect();
  if needles.is_empty() { return Vec::new(); }

  let mut candidates: Vec<PathBuf> = Vec::new();
  let mut budget = MAX_SCAN_ENTRIES;
  for root in local_app_roots() {
    if !root.is_dir() { continue; }
    scan_app_entries(&root, 0, &mut budget, &mut candidates);
    if budget == 0 { break; }
  }

  let mut matches: Vec<LocalAppMatch> = Vec::new();
  let mut seen: Vec<String> = Vec::new();
  for path in candidates {
    let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("");
    let lower = stem.to_lowercase();
    if !needles.iter().any(|needle| lower.contains(needle.as_str())) { continue; }
    if seen.contains(&lower) { continue; }
    seen.push(lower.clone());
    // 命中即登记：后续只能通过 LocalApp 通道启动这些后端确认过的路径。
    register_confirmed_app(&path);
    matches.push(LocalAppMatch {
      id: lower,
      name: stem.to_string(),
      path: path.to_string_lossy().to_string(),
    });
    if matches.len() >= 5 { break; }
  }
  matches
}

/// Android 上不存在桌面客户端概念，返回空列表（保持命令名在两平台都可用）。
#[cfg(target_os = "android")]
#[tauri::command(name = "find-local-app")]
pub fn find_local_app(_keywords: Vec<String>) -> Vec<LocalAppMatch> {
  Vec::new()
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

  #[cfg(all(not(target_os = "android"), not(target_os = "windows")))]
  #[test]
  fn accepts_explicit_open_and_codex_commands() {
    assert!(validate_executable("/usr/bin/open").is_ok());
    assert!(validate_executable("open").is_ok());
    assert!(validate_executable("codex").is_ok());
  }

  // 覆盖「macOS 的 .app 是目录」这一关键分支：必须被识别为应用条目，而不是被递归进去。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn scan_app_entries_finds_platform_specific_entries() {
    let root = std::env::temp_dir().join(format!("zynthel-scan-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let entry = if cfg!(target_os = "macos") {
      root.join("虎扑.app")
    } else if cfg!(target_os = "windows") {
      root.join("虎扑.lnk")
    } else {
      root.join("虎扑.desktop")
    };
    if entry.extension().and_then(|value| value.to_str()) == Some("app") {
      std::fs::create_dir_all(&entry).unwrap(); // .app 是目录
    } else {
      std::fs::write(&entry, b"stub").unwrap();
    }
    // 干扰项：普通文本文件不应被当成应用条目。
    std::fs::write(root.join("readme.txt"), b"not an app").unwrap();

    let mut budget = 100;
    let mut found: Vec<PathBuf> = Vec::new();
    scan_app_entries(&root, 0, &mut budget, &mut found);

    assert_eq!(found.len(), 1, "应恰好命中应用条目本身，实际: {found:?}");
    assert!(found[0].to_string_lossy().contains("虎扑"));
    let _ = std::fs::remove_dir_all(&root);
  }

  #[cfg(not(target_os = "android"))]
  #[test]
  fn find_local_app_ignores_empty_and_oversized_keywords() {
    // 空/全空白/超长关键词必须直接返回空，不触发任何目录遍历。
    assert!(find_local_app(Vec::new()).is_empty());
    assert!(find_local_app(vec!["".into(), "   ".into()]).is_empty());
    assert!(find_local_app(vec!["x".repeat(200)]).is_empty());
  }

  // 普通 LocalPath 不能启动可执行/可跳转文件（任务书明确清单 + Windows 其他常见入口）。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_path_rejects_executable_and_shortcut_files() {
    let root = std::env::temp_dir().join(format!("zynthel-localpath-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let forbidden = if cfg!(target_os = "windows") {
      vec![
        "app.exe", "tool.com", "run.bat", "run.cmd", "script.ps1", "install.msi",
        "shortcut.lnk", "site.url", "saver.scr", "prog.pif", "a.vbs", "b.vbe",
        "c.js", "d.jse", "e.wsf", "f.wsh", "g.hta", "h.jar", "i.appref-ms",
        "j.reg", "k.scf", "l.inf", "m.cpl", "n.dll", "o.sys",
      ]
    } else {
      vec!["run.command", "run.sh", "run.bash", "run.zsh", "App.app", "entry.desktop"]
    };

    for name in &forbidden {
      let file = root.join(name);
      if name.ends_with(".app") {
        std::fs::create_dir_all(&file).unwrap();
      } else {
        std::fs::write(&file, b"stub").unwrap();
      }
      assert_eq!(
        validate_local_file(&file),
        Err(LaunchError::FileTypeNotAllowed),
        "普通本地路径不应允许启动 {name}",
      );
    }
  }

  // 正常文档/资源必须仍然可以打开，不能被上面的收紧误伤。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_path_still_opens_normal_documents() {
    let root = std::env::temp_dir().join(format!("zynthel-docs-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    for name in [
      "note.txt", "report.pdf", "book.epub", "photo.png", "photo.jpg",
      "clip.webp", "song.mp3", "movie.mp4", "archive.zip", "sheet.xlsx",
      "slides.pptx", "data.json", "page.html", "style.css", "main.rs",
      "无扩展名文件",
    ] {
      let file = root.join(name);
      std::fs::write(&file, b"stub").unwrap();
      assert_eq!(validate_local_file(&file), Ok(()), "正常文件应允许打开: {name}");
    }
    let _ = std::fs::remove_dir_all(&root);
  }

  // 本机应用通道：只认后端扫描确认过的路径，伪造路径一律拒绝。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_app_channel_only_accepts_backend_confirmed_paths() {
    let root = std::env::temp_dir().join(format!("zynthel-confirmed-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let confirmed = root.join("虎扑.lnk");
    std::fs::write(&confirmed, b"stub").unwrap();
    let forged = root.join("evil.lnk");
    std::fs::write(&forged, b"stub").unwrap();

    assert!(!is_confirmed_app(&confirmed));
    register_confirmed_app(&confirmed);
    assert!(is_confirmed_app(&confirmed));
    // 前端伪造的同类型路径，只要没被后端扫描确认过就必须是 false。
    assert!(!is_confirmed_app(&forged));

    let _ = std::fs::remove_dir_all(&root);
  }

  // 端到端：LocalApp 未确认 → AppNotConfirmed；LocalPath 传 exe/lnk → FileTypeNotAllowed。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn launch_resource_separates_the_two_channels() {
    let root = std::env::temp_dir().join(format!("zynthel-channels-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    // 各平台「合法本机应用入口」的形态不同：macOS 是 .app 目录包，
    // Windows 是 .lnk/.exe/.url 文件，Linux 是 .desktop 文件。
    let target = if cfg!(target_os = "windows") {
      let file = root.join("app.exe");
      std::fs::write(&file, b"stub").unwrap();
      file
    } else if cfg!(target_os = "macos") {
      let dir = root.join("app.app");
      std::fs::create_dir_all(&dir).unwrap();
      dir
    } else {
      let file = root.join("app.desktop");
      std::fs::write(&file, b"stub").unwrap();
      file
    };
    let path = target.to_string_lossy().to_string();

    // 未经后端确认 → 不能借本机应用通道启动（此处不会真的启动进程）
    assert_eq!(
      launch_resource(LaunchEnvelope { launch: LaunchMethod::LocalApp { path: path.clone() } })
        .err(),
      Some(LaunchError::AppNotConfirmed),
    );
    // 普通本地文件通道 → 因为是可执行类型被拒，且同样不会启动
    assert_eq!(
      launch_resource(LaunchEnvelope { launch: LaunchMethod::LocalPath { path: path.clone() } }).err(),
      Some(LaunchError::FileTypeNotAllowed),
    );
    // 即使把它强行登记进「已确认表」，临时目录也不在后端允许扫描的应用来源内，
    // 启动前重新确认必须照样拒绝（TOCTOU + 来源双重校验）。
    register_confirmed_app(&target);
    assert_eq!(
      launch_resource(LaunchEnvelope { launch: LaunchMethod::LocalApp { path: path.clone() } }).err(),
      Some(LaunchError::AppNotConfirmed),
    );

    // 「来源合法且类型正确时可以启动」由 local_app_allows_entry_inside_scan_root 覆盖：
    // 这里不做正向 launch_resource，避免测试真的拉起系统程序。

    let _ = std::fs::remove_dir_all(&root);
  }

  // TOCTOU：登记过 ≠ 永久可信。登记后目标被替换/删除/挪出受信任目录都必须重新判定。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_app_revalidates_target_at_launch_time() {
    let root = std::env::temp_dir().join(format!("zynthel-toctou-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let entry = if cfg!(target_os = "macos") { root.join("虎扑.app") } else { root.join("虎扑.lnk") };
    if cfg!(target_os = "macos") { std::fs::create_dir_all(&entry).unwrap(); }
    else { std::fs::write(&entry, b"stub").unwrap(); }

    // 未登记 → 不能启动
    assert_eq!(revalidate_local_app(&entry), Err(LaunchError::AppNotConfirmed));

    register_confirmed_app(&entry);
    // 登记后若目标被删除 → 立即失效
    let removed = entry.clone();
    std::fs::remove_dir_all(&entry).ok();
    std::fs::remove_file(&entry).ok();
    assert_eq!(revalidate_local_app(&removed), Err(LaunchError::InvalidPath));

    // 重新放回，但形态被换掉：macOS 的 .app 变成普通文件 / Windows 的 .lnk 变成目录
    if cfg!(target_os = "macos") {
      std::fs::write(&entry, b"not an app bundle").unwrap();
    } else {
      std::fs::create_dir_all(&entry).unwrap();
    }
    assert_eq!(
      revalidate_local_app(&entry),
      Err(LaunchError::FileTypeNotAllowed),
      "登记过的路径在目标形态被替换后不能继续被视为已确认应用",
    );

    let _ = std::fs::remove_dir_all(&root);
  }

  // 登记过的路径若当前已不是「允许的应用入口类型」，必须拒绝
  // （例如 .app/.lnk 被换成一个同名但扩展名不同的文件）。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_app_rejects_when_type_changed_after_scan() {
    let root = std::env::temp_dir().join(format!("zynthel-toctou-type-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();

    let entry = if cfg!(target_os = "macos") { root.join("虎扑.app") } else { root.join("虎扑.lnk") };
    if cfg!(target_os = "macos") { std::fs::create_dir_all(&entry).unwrap(); }
    else { std::fs::write(&entry, b"stub").unwrap(); }
    register_confirmed_app(&entry);

    // 把内容换成普通文本（扩展名不变，但不再是应用入口）
    let _ = std::fs::remove_dir_all(&entry);
    std::fs::write(&entry, b"plain text").unwrap();
    if cfg!(target_os = "macos") {
      // macOS 上 .app 必须是目录，普通文件形态即拒绝
      assert_eq!(revalidate_local_app(&entry), Err(LaunchError::FileTypeNotAllowed));
    } else {
      // Windows 上 .lnk 仍是「允许的应用入口」类型，但必须仍在受信任来源目录内：
      // 临时目录不在 local_app_roots() 之下，所以这里也必须被拒绝。
      assert_eq!(revalidate_local_app(&entry), Err(LaunchError::AppNotConfirmed));
    }

    let _ = std::fs::remove_dir_all(&root);
  }

  // 受信任来源目录之外，即使类型正确也不能走 LocalApp
  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_app_rejects_paths_outside_scan_roots() {
    let root = std::env::temp_dir().join(format!("zynthel-outside-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    let entry = if cfg!(target_os = "macos") { root.join("Evil.app") } else { root.join("Evil.lnk") };
    if cfg!(target_os = "macos") { std::fs::create_dir_all(&entry).unwrap(); }
    else { std::fs::write(&entry, b"stub").unwrap(); }

    assert!(!is_within_local_app_roots(&entry), "临时目录不应属于应用扫描来源");
    register_confirmed_app(&entry);
    assert_eq!(revalidate_local_app(&entry), Err(LaunchError::AppNotConfirmed));

    let _ = std::fs::remove_dir_all(&root);
  }

  // 合法扫描来源：在 $HOME/Applications（macOS 扫描根之一）下的真实 .app 可以通过重新确认。
  #[cfg(target_os = "macos")]
  #[test]
  fn local_app_allows_entry_inside_scan_root() {
    let Some(home) = std::env::var_os("HOME") else { return };
    let dir = Path::new(&home).join("Applications");
    std::fs::create_dir_all(&dir).unwrap();
    let entry = dir.join("ZynthelToctouTest.app");
    std::fs::create_dir_all(&entry).unwrap();
    register_confirmed_app(&entry);

    assert!(is_within_local_app_roots(&entry));
    assert_eq!(revalidate_local_app(&entry), Ok(()));

    let _ = std::fs::remove_dir_all(&entry);
  }

  // 与上一用例配对：位置合法、类型合法、形态合法，但只要没被后端扫描登记过，
  // 就仍然不能借 LocalApp 通道启动（登记表不是摆设，缺它必须拒绝）。
  #[cfg(target_os = "macos")]
  #[test]
  fn local_app_inside_scan_root_still_needs_backend_confirmation() {
    let Some(home) = std::env::var_os("HOME") else { return };
    let dir = Path::new(&home).join("Applications");
    std::fs::create_dir_all(&dir).unwrap();
    let entry = dir.join("ZynthelUnregistered.app");
    std::fs::create_dir_all(&entry).unwrap();

    assert!(is_within_local_app_roots(&entry));
    assert!(!is_confirmed_app(&entry), "测试前不应残留登记");
    assert_eq!(
      revalidate_local_app(&entry),
      Err(LaunchError::AppNotConfirmed),
      "来源合法但未登记的应用入口不能被启动",
    );

    let _ = std::fs::remove_dir_all(&entry);
  }

  #[cfg(not(target_os = "android"))]
  #[test]
  fn local_path_rejects_missing_files() {
    let missing = std::env::temp_dir().join(format!("zynthel-missing-{}-{}", std::process::id(), "nope.txt"));
    assert_eq!(validate_local_file(&missing), Err(LaunchError::InvalidPath));
  }

  /* ---------- 文件身份快照：识别「同路径 + 同类型被替换」 ---------- */

  // 纯单元：文件内容一变，指纹必须变（这是「同路径同扩展名替换」能被识别的基础）。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn fingerprint_changes_when_file_content_changes() {
    let root = std::env::temp_dir().join(format!("zynthel-fp-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    let file = root.join("Good.exe");
    std::fs::write(&file, b"original-content").unwrap();

    let before = FileFingerprint::compute(&file).expect("应能计算指纹");
    // 同路径、同扩展名，仅内容不同
    std::fs::write(&file, b"replaced-content-different").unwrap();
    let after = FileFingerprint::compute(&file).expect("应能计算指纹");
    assert_ne!(before, after, "同路径同扩展名但内容被替换，指纹必须改变");

    let _ = std::fs::remove_dir_all(&root);
  }

  // 纯单元：目录（macOS `.app`）的顶层条目一变，指纹也必须变。
  #[cfg(not(target_os = "android"))]
  #[test]
  fn fingerprint_changes_when_directory_entries_change() {
    let root = std::env::temp_dir().join(format!("zynthel-fp-dir-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    let dir = root.join("App.app");
    std::fs::create_dir_all(&dir).unwrap();

    let before = FileFingerprint::compute(&dir).expect("应能计算目录指纹");
    std::fs::write(dir.join("Contents"), b"something").unwrap();
    let after = FileFingerprint::compute(&dir).expect("应能计算目录指纹");
    assert_ne!(before, after, "目录顶层条目变化，指纹必须改变");

    let _ = std::fs::remove_dir_all(&root);
  }

  // 核心回归：合法应用扫描后正常启动（正向通过），见下方平台各自用例。
  // 这里给出「同路径 + 同类型被替换」的端到端拒绝用例，按平台选择扫描根内形态。
  //
  // macOS：在 $HOME/Applications 下造一个 .app 目录 → 登记 → 换成一个「不同顶层内容」的同名 .app → 拒绝。
  #[cfg(target_os = "macos")]
  #[test]
  fn local_app_rejects_same_path_same_type_replacement() {
    let Some(home) = std::env::var_os("HOME") else { return };
    let dir = Path::new(&home).join("Applications");
    std::fs::create_dir_all(&dir).unwrap();
    let entry = dir.join("ZynthelSwapTest.app");
    let _ = std::fs::remove_dir_all(&entry);
    std::fs::create_dir_all(&entry).unwrap();
    std::fs::write(entry.join("Contents"), b"original-app").unwrap();

    // 1. 合法应用扫描后正常启动
    register_confirmed_app(&entry);
    assert!(is_confirmed_app(&entry));
    assert_eq!(revalidate_local_app(&entry), Ok(()), "登记后未改动应当通过");

    // 2. 扫描后删除 → 拒绝
    let _ = std::fs::remove_dir_all(&entry);
    assert_eq!(revalidate_local_app(&entry), Err(LaunchError::InvalidPath));

    // 3. 扫描后同路径、同扩展名内容被替换 → 旧确认失效
    std::fs::create_dir_all(&entry).unwrap();
    std::fs::write(entry.join("Contents"), b"different-replaced-app").unwrap();
    assert_eq!(
      revalidate_local_app(&entry),
      Err(LaunchError::AppNotConfirmed),
      "同路径同类型(.app)被替换后，旧确认必须失效",
    );

    let _ = std::fs::remove_dir_all(&entry);
  }

  // Windows / Linux：在扫描根内造一个文件（Windows .lnk，Linux .desktop），
  // 验证「同路径 + 同扩展名内容被替换」后旧确认失效。此用例在对应平台/CI 上运行。
  #[cfg(any(target_os = "windows", target_os = "linux"))]
  #[test]
  fn local_app_rejects_same_path_same_type_replacement_files() {
    // 构造一个真实落在扫描根内的文件路径。
    let entry = if cfg!(target_os = "windows") {
      // Windows：%APPDATA%\Microsoft\Windows\Start Menu\Programs 之下
      let root = std::env::var_os("APPDATA")
        .map(|a| Path::new(&a).join("Microsoft").join("Windows").join("Start Menu").join("Programs"))
        .unwrap_or_else(|| std::env::temp_dir().join("zynthel-win-scanroot"));
      std::fs::create_dir_all(&root).unwrap();
      root.join("ZynthelSwapTest.lnk")
    } else {
      // Linux：$HOME/.local/share/applications 之下
      let root = std::env::var_os("HOME")
        .map(|h| Path::new(&h).join(".local").join("share").join("applications"))
        .unwrap_or_else(|| std::env::temp_dir().join("zynthel-linux-scanroot"));
      std::fs::create_dir_all(&root).unwrap();
      root.join("ZynthelSwapTest.desktop")
    };
    let _ = std::fs::remove_file(&entry);

    // 1. 合法应用扫描后正常启动
    std::fs::write(&entry, b"[Desktop Entry]\nName=Zynthel Swap Test\n").unwrap();
    register_confirmed_app(&entry);
    assert_eq!(revalidate_local_app(&entry), Ok(()), "登记后未改动应当通过");

    // 2. 扫描后删除 → 拒绝
    let _ = std::fs::remove_file(&entry);
    assert_eq!(revalidate_local_app(&entry), Err(LaunchError::InvalidPath));

    // 3. 同路径、同扩展名，内容被替换 → 旧确认失效
    std::fs::write(&entry, b"[Desktop Entry]\nName=Different Replaced\nExec=/evil\n").unwrap();
    assert_eq!(
      revalidate_local_app(&entry),
      Err(LaunchError::AppNotConfirmed),
      "同路径同扩展名内容被替换后，旧确认必须失效",
    );

    let _ = std::fs::remove_file(&entry);
  }

  // 未确认路径（即使落在扫描根内、类型正确）必须拒绝 —— 已有用例覆盖，
  // 这里再补一个「扫描根内但从未登记」的明确断言，确保登记表不是摆设。
  #[cfg(target_os = "macos")]
  #[test]
  fn local_app_unconfirmed_path_inside_scan_root_rejected() {
    let Some(home) = std::env::var_os("HOME") else { return };
    let dir = Path::new(&home).join("Applications");
    std::fs::create_dir_all(&dir).unwrap();
    let entry = dir.join("ZynthelNeverRegistered.app");
    let _ = std::fs::remove_dir_all(&entry);
    std::fs::create_dir_all(&entry).unwrap();

    assert!(is_within_local_app_roots(&entry));
    assert!(!is_confirmed_app(&entry));
    assert_eq!(revalidate_local_app(&entry), Err(LaunchError::AppNotConfirmed));

    let _ = std::fs::remove_dir_all(&entry);
  }

  #[cfg(target_os = "windows")]
  #[test]
  fn windows_rejects_custom_command() {
    let request = LaunchEnvelope {
      launch: LaunchMethod::CustomCommand { executable: "notepad".into(), args: vec![] },
    };
    assert_eq!(launch_resource(request), Err(LaunchError::CommandNotAllowed));
  }
}
