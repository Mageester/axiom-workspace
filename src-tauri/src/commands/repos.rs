use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Clean,
    Dirty,
    Behind,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UpstreamStatus {
    Ok,
    Missing,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub id: String,
    pub name: String,
    pub path: String,
    pub current_branch: String,
    pub is_git_repo: bool,
    pub has_uncommitted_changes: bool,
    pub has_upstream: bool,
    pub upstream_status: UpstreamStatus,
    pub upstream_error_message: Option<String>,
    pub is_detached_head: bool,
    pub ahead: u32,
    pub behind: u32,
    pub status: Status,
    pub last_checked_at: String,
    pub error_message: Option<String>,
}

fn git_command(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C", repo_path])
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
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(stderr)
    }
}

fn now_unix_secs() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", secs)
}

fn derive_status(has_uncommitted: bool, behind: u32) -> Status {
    if has_uncommitted {
        Status::Dirty
    } else if behind > 0 {
        Status::Behind
    } else {
        Status::Clean
    }
}

fn id_from_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn repo_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn error_status(path: &str, name: String, id: String, message: &str) -> RepoStatus {
    RepoStatus {
        id,
        name,
        path: path.to_string(),
        current_branch: String::new(),
        is_git_repo: false,
        has_uncommitted_changes: false,
        has_upstream: false,
        upstream_status: UpstreamStatus::Error,
        upstream_error_message: None,
        is_detached_head: false,
        ahead: 0,
        behind: 0,
        status: Status::Error,
        last_checked_at: now_unix_secs(),
        error_message: Some(message.to_string()),
    }
}

fn repo_error_status(path: &str, name: String, id: String, message: &str) -> RepoStatus {
    RepoStatus {
        id,
        name,
        path: path.to_string(),
        current_branch: String::new(),
        is_git_repo: true,
        has_uncommitted_changes: false,
        has_upstream: false,
        upstream_status: UpstreamStatus::Error,
        upstream_error_message: None,
        is_detached_head: false,
        ahead: 0,
        behind: 0,
        status: Status::Error,
        last_checked_at: now_unix_secs(),
        error_message: Some(message.to_string()),
    }
}

fn is_missing_upstream_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("no upstream")
        || lower.contains("no tracking information")
        || lower.contains("does not have any commits yet")
        || lower.contains("head does not point to a branch")
}

fn check_repo_status(path: &str) -> RepoStatus {
    let name = repo_name_from_path(path);
    let id = id_from_path(path);

    let is_git_repo = match git_command(path, &["rev-parse", "--is-inside-work-tree"]) {
        Ok(output) => output == "true",
        Err(e) => {
            let msg = if e.contains("not found on PATH") {
                e
            } else if !Path::new(path).exists() {
                "Path does not exist".to_string()
            } else {
                "Not a Git repository".to_string()
            };
            return error_status(path, name, id, &msg);
        }
    };

    if !is_git_repo {
        return error_status(path, name, id, "Not a Git repository");
    }

    let (current_branch, is_detached_head) =
        match git_command(path, &["rev-parse", "--abbrev-ref", "HEAD"]) {
            Ok(branch) if branch == "HEAD" => {
                let short_hash = git_command(path, &["rev-parse", "--short", "HEAD"])
                    .unwrap_or_else(|_| "Detached HEAD".to_string());
                (short_hash, true)
            }
            Ok(branch) => (branch, false),
            Err(e) => return repo_error_status(path, name, id, &e),
        };

    let has_uncommitted_changes = match git_command(path, &["status", "--porcelain"]) {
        Ok(output) => !output.is_empty(),
        Err(e) => return repo_error_status(path, name, id, &e),
    };

    let (ahead, behind, has_upstream, upstream_status, upstream_error_message) = match git_command(
        path,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ) {
        Ok(output) => {
            let parts: Vec<&str> = output.split('\t').collect();
            if parts.len() == 2 {
                match (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    (Ok(ahead), Ok(behind)) => (ahead, behind, true, UpstreamStatus::Ok, None),
                    _ => {
                        let message = format!("Failed to parse upstream counts: {}", output);
                        return repo_error_status(path, name, id, &message);
                    }
                }
            } else {
                let message = format!("Failed to parse upstream counts: {}", output);
                return repo_error_status(path, name, id, &message);
            }
        }
        Err(e) if is_missing_upstream_error(&e) => (0, 0, false, UpstreamStatus::Missing, None),
        Err(e) => {
            let mut status = repo_error_status(path, name, id, &e);
            status.upstream_error_message = Some(e);
            return status;
        }
    };

    let status = derive_status(has_uncommitted_changes, behind);

    RepoStatus {
        id,
        name,
        path: path.to_string(),
        current_branch,
        is_git_repo: true,
        has_uncommitted_changes,
        has_upstream,
        upstream_status,
        upstream_error_message,
        is_detached_head,
        ahead,
        behind,
        status,
        last_checked_at: now_unix_secs(),
        error_message: None,
    }
}

#[tauri::command]
pub fn get_repo_status(path: String) -> RepoStatus {
    check_repo_status(&path)
}

#[tauri::command]
pub fn get_multiple_repo_statuses(paths: Vec<String>) -> Vec<RepoStatus> {
    paths.iter().map(|p| check_repo_status(p)).collect()
}
