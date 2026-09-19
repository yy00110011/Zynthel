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
    let ok = response.get("ok").and_then(|value| value.as_bool()).unwrap_or(true);
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

  pub fn apps<R: Runtime>(handle: &PluginHandle<R>) -> Vec<InstalledApp> {
    handle
      .run_mobile_plugin::<serde_json::Value>("listInstalledApps", serde_json::json!({}))
      .ok()
      .and_then(|value| value.get("apps").cloned())
      .and_then(|apps| serde_json::from_value::<Vec<InstalledApp>>(apps).ok())
      .unwrap_or_default()
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
