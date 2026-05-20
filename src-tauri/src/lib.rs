mod commands;

use commands::{repos, sync, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            repos::get_repo_status,
            repos::get_multiple_repo_statuses,
            repos::discover_local_repos,
            sync::check_git_installed,
            sync::validate_github_access,
            sync::get_default_sync_path,
            sync::setup_sync_repo,
            sync::validate_sync_repo,
            sync::validate_sync_write_access,
            sync::ensure_sync_structure,
            sync::sync_now,
            system::get_system_identity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
