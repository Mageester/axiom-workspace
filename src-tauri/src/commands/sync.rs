use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRepoValidation {
    ok: bool,
    message: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSyncEventsResult {
    events: Vec<Value>,
    skipped: u32,
}

fn git_command(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Git is not installed or not found on PATH".to_string()
            } else {
                format!("Failed to run git: {}", e)
            }
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn validate_sync_repo_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Choose a local sync repo path first.".to_string());
    }

    let repo_path = PathBuf::from(trimmed);
    if !repo_path.exists() {
        return Err("That sync repo path does not exist yet.".to_string());
    }
    if !repo_path.is_dir() {
        return Err("The sync repo path must be a folder.".to_string());
    }
    let folder_name = repo_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !folder_name.contains("sync") {
        return Err(
            "Choose a separate coordination sync repo folder, for example axiom-workspace-sync."
                .to_string(),
        );
    }

    let inside = git_command(&repo_path, &["rev-parse", "--is-inside-work-tree"])?;
    if inside != "true" {
        return Err("That folder is not a Git repository.".to_string());
    }

    Ok(repo_path)
}

fn safe_segment(value: &str, fallback: &str) -> String {
    let sanitized: String = value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .take(96)
        .collect();

    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

fn collect_json_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir).map_err(|e| format!("Could not read sync events: {}", e))? {
        let entry = entry.map_err(|e| format!("Could not read sync events: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            collect_json_files(&path, files)?;
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
            files.push(path);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn validate_sync_repo(path: String) -> SyncRepoValidation {
    match validate_sync_repo_path(&path) {
        Ok(repo_path) => SyncRepoValidation {
            ok: true,
            message: "Sync repo is ready.".to_string(),
            path: repo_path.to_string_lossy().to_string(),
        },
        Err(message) => SyncRepoValidation {
            ok: false,
            message,
            path,
        },
    }
}

#[tauri::command]
pub fn read_sync_events(path: String) -> Result<ReadSyncEventsResult, String> {
    let repo_path = validate_sync_repo_path(&path)?;
    let events_dir = repo_path.join("state").join("events");
    let mut files = Vec::new();
    collect_json_files(&events_dir, &mut files)?;

    let mut events = Vec::new();
    let mut skipped = 0;

    for file in files {
        match fs::read_to_string(&file)
            .ok()
            .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        {
            Some(value) if value.get("id").and_then(Value::as_str).is_some() => {
                events.push(value);
            }
            _ => skipped += 1,
        }
    }

    Ok(ReadSyncEventsResult { events, skipped })
}

#[tauri::command]
pub fn write_sync_event(path: String, event: Value) -> Result<String, String> {
    let repo_path = validate_sync_repo_path(&path)?;
    let device_id = safe_segment(
        event
            .get("deviceId")
            .and_then(Value::as_str)
            .unwrap_or("unknown-device"),
        "unknown-device",
    );
    let event_id = safe_segment(
        event.get("id").and_then(Value::as_str).unwrap_or("event"),
        "event",
    );
    let events_dir = repo_path.join("state").join("events").join(device_id);
    fs::create_dir_all(&events_dir)
        .map_err(|e| format!("Could not create sync event folder: {}", e))?;

    let event_path = events_dir.join(format!("{}.json", event_id));
    let content = serde_json::to_string_pretty(&event)
        .map_err(|e| format!("Could not serialize sync event: {}", e))?;
    fs::write(&event_path, content).map_err(|e| format!("Could not write sync event: {}", e))?;

    Ok(event_path.to_string_lossy().to_string())
}
