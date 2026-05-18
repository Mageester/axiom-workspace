mod commands;

use commands::{repos, sync};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            repos::get_repo_status,
            repos::get_multiple_repo_statuses,
            sync::validate_sync_repo,
            sync::read_sync_events,
            sync::write_sync_event,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
