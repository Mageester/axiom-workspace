use super::process;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::{Duration, Instant};

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
    pub refresh_duration_ms: u128,
    pub git_command_count: u32,
    pub last_command_error: Option<String>,
}

struct DirtySummary {
    count: u32,
    files: Vec<RepoChangedFile>,
    has_more: bool,
}

struct RepoCheckContext {
    started: Instant,
    git_command_count: u32,
    last_command_error: Option<String>,
}

impl RepoCheckContext {
    fn new() -> Self {
        Self {
            started: Instant::now(),
            git_command_count: 0,
            last_command_error: None,
        }
    }

    fn duration_ms(&self) -> u128 {
        self.started.elapsed().as_millis()
    }

    fn git_command(&mut self, repo_path: &str, args: &[&str]) -> Result<String, String> {
        self.git_command_count += 1;
        let mut full_args = vec!["-C", repo_path];
        full_args.extend_from_slice(args);
        match process::run_command("git", &full_args, None, Duration::from_secs(5)) {
            Ok(output) => Ok(output.stdout),
            Err(error) => {
                let message = if matches!(error.kind, process::ProcessErrorKind::NotFound) {
                    "Git is not installed or not found on PATH".to_string()
                } else {
                    error.user_message()
                };
                self.last_command_error = Some(message.clone());
                Err(message)
            }
        }
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

fn error_status(
    path: &str,
    name: String,
    id: String,
    message: &str,
    ctx: &RepoCheckContext,
) -> RepoStatus {
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
        refresh_duration_ms: ctx.duration_ms(),
        git_command_count: ctx.git_command_count,
        last_command_error: ctx
            .last_command_error
            .clone()
            .or_else(|| Some(message.to_string())),
    }
}

fn repo_error_status(
    path: &str,
    name: String,
    id: String,
    message: &str,
    ctx: &RepoCheckContext,
) -> RepoStatus {
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
        refresh_duration_ms: ctx.duration_ms(),
        git_command_count: ctx.git_command_count,
        last_command_error: ctx
            .last_command_error
            .clone()
            .or_else(|| Some(message.to_string())),
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
    let mut ctx = RepoCheckContext::new();
    let name = repo_name_from_path(path);
    let id = id_from_path(path);

    let is_git_repo = match ctx.git_command(path, &["rev-parse", "--is-inside-work-tree"]) {
        Ok(output) => output == "true",
        Err(e) => {
            let msg = if e.contains("not found on PATH") {
                e
            } else if !Path::new(path).exists() {
                "Path does not exist".to_string()
            } else {
                "Not a Git repository".to_string()
            };
            return error_status(path, name, id, &msg, &ctx);
        }
    };

    if !is_git_repo {
        return error_status(path, name, id, "Not a Git repository", &ctx);
    }

    let (current_branch, is_detached_head) =
        match ctx.git_command(path, &["rev-parse", "--abbrev-ref", "HEAD"]) {
            Ok(branch) if branch == "HEAD" => {
                let short_hash = ctx
                    .git_command(path, &["rev-parse", "--short", "HEAD"])
                    .unwrap_or_else(|_| "Detached HEAD".to_string());
                (short_hash, true)
            }
            Ok(branch) => (branch, false),
            Err(e) => return repo_error_status(path, name, id, &e, &ctx),
        };

    let dirty_summary = match ctx.git_command(path, &["status", "--porcelain=v1"]) {
        Ok(output) => summarize_dirty_files(&output, 20),
        Err(e) => return repo_error_status(path, name, id, &e, &ctx),
    };
    let has_uncommitted_changes = dirty_summary.count > 0;

    let (ahead, behind, has_upstream, upstream_status, upstream_error_message) = match ctx
        .git_command(
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
                        return repo_error_status(path, name, id, &message, &ctx);
                    }
                }
            } else {
                let message = format!("Failed to parse upstream counts: {}", output);
                return repo_error_status(path, name, id, &message, &ctx);
            }
        }
        Err(e) if is_missing_upstream_error(&e) => (0, 0, false, UpstreamStatus::Missing, None),
        Err(e) => {
            let mut status = repo_error_status(path, name, id, &e, &ctx);
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
        refresh_duration_ms: ctx.duration_ms(),
        git_command_count: ctx.git_command_count,
        last_command_error: ctx.last_command_error,
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
