use super::process;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredRepo {
    pub name: String,
    pub path: String,
    pub detected_type: String,
    pub confidence_score: u8,
    pub reason: String,
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

fn normalize_name(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase()
}

fn known_axiom_profile(name: &str) -> Option<(&'static str, u8)> {
    match normalize_name(name).as_str() {
        "axiomworkspace" => Some(("Axiom Workspace", 98)),
        "axiomsite" | "getaxiom" => Some(("Axiom Site", 96)),
        "axiompipelineengine" => Some(("Axiom Pipeline Engine", 96)),
        _ => None,
    }
}

fn detect_repo_type(path: &Path) -> String {
    if path.join("src-tauri").exists() && path.join("package.json").exists() {
        "Tauri app".to_string()
    } else if path.join("package.json").exists() {
        "Node frontend".to_string()
    } else if path.join("Cargo.toml").exists() {
        "Rust".to_string()
    } else if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        "Python".to_string()
    } else {
        "Git repo".to_string()
    }
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        ".git"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".cache"
            | ".tauri"
            | "vendor"
    )
}

fn discovery_roots() -> Vec<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from));
    let Some(home) = home else {
        return Vec::new();
    };

    vec![
        home.join("Desktop"),
        home.join("Documents"),
        home.join("OneDrive").join("Desktop"),
        home.join("OneDrive").join("Documents"),
        home.join("source").join("repos"),
        home.join("OneDrive").join("Desktop").join("Repos"),
        home.join("Desktop").join("Repos"),
    ]
}

fn push_repo_candidate(path: &Path, output: &mut Vec<DiscoveredRepo>, seen: &mut HashSet<String>) {
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let path_text = canonical.to_string_lossy().to_string();
    let dedupe_key = path_text.to_lowercase();
    if !seen.insert(dedupe_key) {
        return;
    }

    let name = canonical
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path_text.clone());
    let detected_type = detect_repo_type(&canonical);
    let (confidence_score, reason) = match known_axiom_profile(&name) {
        Some((friendly, score)) => (
            score,
            format!("Recognized as {} by repository folder name.", friendly),
        ),
        None if matches!(
            detected_type.as_str(),
            "Tauri app" | "Node frontend" | "Rust" | "Python"
        ) =>
        {
            (
                72,
                format!("Detected a {} project with Git metadata.", detected_type),
            )
        }
        None => (58, "Detected a local Git repository.".to_string()),
    };

    output.push(DiscoveredRepo {
        name,
        path: path_text,
        detected_type,
        confidence_score,
        reason,
    });
}

fn scan_for_repos(
    dir: &Path,
    depth: u8,
    output: &mut Vec<DiscoveredRepo>,
    seen: &mut HashSet<String>,
) {
    if depth > 3 || output.len() >= 80 || !dir.is_dir() {
        return;
    }

    if dir.join(".git").exists() {
        push_repo_candidate(dir, output, seen);
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if output.len() >= 80 {
            return;
        }
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if should_skip_dir(name) {
            continue;
        }
        scan_for_repos(&path, depth + 1, output, seen);
    }
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullResult {
    pub ok: bool,
    pub message: String,
    pub commits_pulled: u32,
    pub had_stash: bool,
    pub stash_conflict: bool,
    pub duration_ms: u128,
}

fn pull_repo_inner(path: &str) -> PullResult {
    let started = Instant::now();
    let mut ctx = RepoCheckContext::new();

    if ctx.git_command(path, &["rev-parse", "--is-inside-work-tree"]).is_err() {
        return PullResult {
            ok: false,
            message: "Not a Git repository.".to_string(),
            commits_pulled: 0,
            had_stash: false,
            stash_conflict: false,
            duration_ms: started.elapsed().as_millis(),
        };
    }

    let has_changes = ctx
        .git_command(path, &["status", "--porcelain=v1"])
        .map(|out| !out.trim().is_empty())
        .unwrap_or(false);

    let had_stash = if has_changes {
        ctx.git_command(path, &["stash", "push", "-m", "axiom-auto-stash"]).is_ok()
    } else {
        false
    };

    let before_hash = ctx
        .git_command(path, &["rev-parse", "HEAD"])
        .unwrap_or_default();

    let pull_result = ctx.git_command(path, &["pull", "--ff-only"]);

    if let Err(err) = pull_result {
        if had_stash {
            let _ = ctx.git_command(path, &["stash", "pop"]);
        }
        return PullResult {
            ok: false,
            message: if err.contains("divergent") || err.contains("not possible to fast-forward") {
                "Can't fast-forward — branches have diverged. Pull manually to merge.".to_string()
            } else if err.contains("no tracking information") || err.contains("no upstream") {
                "No remote branch set up. Push this branch first.".to_string()
            } else {
                format!("Pull failed: {}", err)
            },
            commits_pulled: 0,
            had_stash,
            stash_conflict: false,
            duration_ms: started.elapsed().as_millis(),
        };
    }

    let after_hash = ctx
        .git_command(path, &["rev-parse", "HEAD"])
        .unwrap_or_default();

    let commits_pulled = if before_hash != after_hash {
        ctx.git_command(path, &["rev-list", "--count", &format!("{}..{}", before_hash, after_hash)])
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(1)
    } else {
        0
    };

    let stash_conflict = if had_stash {
        ctx.git_command(path, &["stash", "pop"]).is_err()
    } else {
        false
    };

    let message = if commits_pulled == 0 {
        "Already up to date.".to_string()
    } else if stash_conflict {
        format!("Pulled {} new commit{}. Your local changes need manual merging (stash conflict).",
            commits_pulled,
            if commits_pulled == 1 { "" } else { "s" })
    } else if had_stash {
        format!("Pulled {} new commit{} and restored your local changes.",
            commits_pulled,
            if commits_pulled == 1 { "" } else { "s" })
    } else {
        format!("Pulled {} new commit{}.",
            commits_pulled,
            if commits_pulled == 1 { "" } else { "s" })
    };

    PullResult {
        ok: true,
        message,
        commits_pulled,
        had_stash,
        stash_conflict,
        duration_ms: started.elapsed().as_millis(),
    }
}

#[tauri::command]
pub fn pull_repo(path: String) -> PullResult {
    pull_repo_inner(&path)
}

#[tauri::command]
pub fn get_repo_status(path: String) -> RepoStatus {
    check_repo_status(&path)
}

#[tauri::command]
pub fn get_multiple_repo_statuses(paths: Vec<String>) -> Vec<RepoStatus> {
    let handles: Vec<_> = paths
        .into_iter()
        .map(|path| std::thread::spawn(move || check_repo_status(&path)))
        .collect();
    handles
        .into_iter()
        .filter_map(|handle| handle.join().ok())
        .collect()
}

#[tauri::command]
pub fn discover_local_repos() -> Vec<DiscoveredRepo> {
    let mut repos = Vec::new();
    let mut seen = HashSet::new();
    let mut root_seen = HashSet::new();

    for root in discovery_roots() {
        let canonical = fs::canonicalize(&root).unwrap_or(root);
        let key = canonical.to_string_lossy().to_string().to_lowercase();
        if root_seen.insert(key) {
            scan_for_repos(&canonical, 0, &mut repos, &mut seen);
        }
    }

    repos.sort_by(|a, b| {
        b.confidence_score
            .cmp(&a.confidence_score)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    repos
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
