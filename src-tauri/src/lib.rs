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
