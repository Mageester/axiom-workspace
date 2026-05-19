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
pub enum RepoChangeKind {
    Added,
    Deleted,
    Modified,
    Renamed,
    Untracked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub kind: RepoChangeKind,
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
    pub changed_file_count: u32,
    pub changed_files: Vec<RepoChangedFile>,
    pub has_more_changed_files: bool,
    pub status: Status,
    pub last_checked_at: String,
    pub error_message: Option<String>,
}

struct DirtySummary {
    count: u32,
    files: Vec<RepoChangedFile>,
    has_more: bool,
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

fn parse_change_kind(index_status: char, worktree_status: char) -> RepoChangeKind {
    if index_status == '?' && worktree_status == '?' {
        RepoChangeKind::Untracked
    } else if index_status == 'R' || worktree_status == 'R' {
        RepoChangeKind::Renamed
    } else if index_status == 'D' || worktree_status == 'D' {
        RepoChangeKind::Deleted
    } else if index_status == 'A' || worktree_status == 'A' {
        RepoChangeKind::Added
    } else {
        RepoChangeKind::Modified
    }
}

fn parse_status_path(raw_path: &str, kind: &RepoChangeKind) -> (String, Option<String>) {
    if matches!(kind, RepoChangeKind::Renamed) {
        if let Some((old_path, new_path)) = raw_path.split_once(" -> ") {
            return (new_path.to_string(), Some(old_path.to_string()));
        }
    }

    (raw_path.to_string(), None)
}

fn summarize_dirty_files(status_output: &str, cap: usize) -> DirtySummary {
    let mut files = Vec::new();
    let mut count = 0_u32;

    for line in status_output.lines().filter(|line| !line.trim().is_empty()) {
        count += 1;

        if files.len() >= cap {
            continue;
        }

        let mut chars = line.chars();
        let index_status = chars.next().unwrap_or(' ');
        let worktree_status = chars.next().unwrap_or(' ');
        let raw_path = line.get(3..).unwrap_or("").trim();

        if raw_path.is_empty() {
            continue;
        }

        let kind = parse_change_kind(index_status, worktree_status);
        let (path, old_path) = parse_status_path(raw_path, &kind);
        files.push(RepoChangedFile {
            path,
            old_path,
            kind,
        });
    }

    DirtySummary {
        count,
        has_more: count as usize > files.len(),
        files,
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
        changed_file_count: 0,
        changed_files: Vec::new(),
        has_more_changed_files: false,
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
        changed_file_count: 0,
        changed_files: Vec::new(),
        has_more_changed_files: false,
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

    let dirty_summary = match git_command(path, &["status", "--porcelain=v1"]) {
        Ok(output) => summarize_dirty_files(&output, 20),
        Err(e) => return repo_error_status(path, name, id, &e),
    };
    let has_uncommitted_changes = dirty_summary.count > 0;

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
        changed_file_count: dirty_summary.count,
        changed_files: dirty_summary.files,
        has_more_changed_files: dirty_summary.has_more,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarizes_porcelain_status_with_kinds_and_cap() {
        let output = "\
 M src/main.ts
A  src/new.ts
D  src/old.ts
R  src/from.ts -> src/to.ts
?? scratch.txt
";

        let summary = summarize_dirty_files(output, 4);

        assert_eq!(summary.count, 5);
        assert!(summary.has_more);
        assert_eq!(summary.files.len(), 4);
        assert!(matches!(summary.files[0].kind, RepoChangeKind::Modified));
        assert!(matches!(summary.files[1].kind, RepoChangeKind::Added));
        assert!(matches!(summary.files[2].kind, RepoChangeKind::Deleted));
        assert!(matches!(summary.files[3].kind, RepoChangeKind::Renamed));
        assert_eq!(summary.files[3].old_path.as_deref(), Some("src/from.ts"));
        assert_eq!(summary.files[3].path, "src/to.ts");
    }

    #[test]
    fn summarizes_untracked_files() {
        let summary = summarize_dirty_files("?? notes.md", 20);

        assert_eq!(summary.count, 1);
        assert!(!summary.has_more);
        assert!(matches!(summary.files[0].kind, RepoChangeKind::Untracked));
        assert_eq!(summary.files[0].path, "notes.md");
    }
}
