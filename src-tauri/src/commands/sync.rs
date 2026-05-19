use super::process;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const DEFAULT_SYNC_REPO_URL: &str = "https://github.com/Mageester/axiom-workspace-sync";
const WRITE_ACCESS_ERROR: &str = "GitHub read access works, but Axiom Workspace cannot upload sync changes. Make sure this GitHub account has write access to Mageester/axiom-workspace-sync.";
const CONCURRENT_SYNC_ERROR: &str =
    "Sync needs attention. Remote updates arrived during sync. Try Sync Now again.";
static SYNC_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInstallCheck {
    installed: bool,
    version: Option<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GithubAccessCategory {
    Ready,
    GitMissing,
    NoAccess,
    RepoNotFound,
    NetworkError,
    UnknownError,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubAccessValidation {
    ok: bool,
    category: GithubAccessCategory,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRepoSetupResult {
    ok: bool,
    sync_local_path: String,
    message: String,
    recovered: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRepoValidation {
    ok: bool,
    message: String,
    path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNowResult {
    ok: bool,
    message: String,
    events: Vec<Value>,
    skipped: u32,
    committed: bool,
    duration_ms: u128,
    git_command_count: u32,
    last_command_error: Option<String>,
}

#[derive(Debug, Default)]
struct GitCommandStats {
    count: u32,
    last_error: Option<String>,
}

impl GitCommandStats {
    fn run(
        &mut self,
        args: &[&str],
        cwd: Option<&Path>,
        timeout: Duration,
    ) -> Result<String, String> {
        self.count += 1;
        match process::run_command("git", args, cwd, timeout) {
            Ok(output) => Ok(output.stdout),
            Err(error) => {
                let message = error.user_message();
                self.last_error = Some(message.clone());
                Err(message)
            }
        }
    }
}

fn git_command(args: &[&str], cwd: Option<&Path>, timeout: Duration) -> Result<String, String> {
    let mut stats = GitCommandStats::default();
    stats.run(args, cwd, timeout)
}

struct SyncInFlightGuard;

impl SyncInFlightGuard {
    fn acquire() -> Result<Self, String> {
        if SYNC_IN_FLIGHT
            .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .is_err()
        {
            return Err(
                "Sync is already running. Wait for it to finish, then try again.".to_string(),
            );
        }
        Ok(Self)
    }
}

impl Drop for SyncInFlightGuard {
    fn drop(&mut self) {
        SYNC_IN_FLIGHT.store(false, Ordering::Release);
    }
}

fn app_sync_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        return Ok(PathBuf::from(local_app_data)
            .join("Axiom Workspace")
            .join("sync"));
    }

    app.path()
        .app_data_dir()
        .map(|path| path.join("sync"))
        .map_err(|e| format!("Could not find the Axiom Workspace app data folder: {}", e))
}

fn normalize_repo_url(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/').trim_end_matches(".git");
    let lower = trimmed.to_lowercase();

    if let Some(rest) = lower.strip_prefix("git@github.com:") {
        return format!("github.com/{}", rest);
    }

    let without_scheme = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .or_else(|| lower.strip_prefix("ssh://git@"))
        .or_else(|| lower.strip_prefix("ssh://"))
        .unwrap_or(&lower);

    without_scheme.trim_start_matches("git@").to_string()
}

fn expected_repo_url(value: Option<String>) -> String {
    value
        .filter(|url| !url.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_SYNC_REPO_URL.to_string())
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

fn classify_github_error(message: &str) -> GithubAccessCategory {
    let lower = message.to_lowercase();
    if lower.contains("not found on path") || lower.contains("git is not installed") {
        GithubAccessCategory::GitMissing
    } else if lower.contains("repository not found") || lower.contains("not found") {
        GithubAccessCategory::RepoNotFound
    } else if lower.contains("authentication failed")
        || lower.contains("permission denied")
        || lower.contains("could not read username")
        || lower.contains("access denied")
    {
        GithubAccessCategory::NoAccess
    } else if lower.contains("could not resolve host")
        || lower.contains("failed to connect")
        || lower.contains("network")
        || lower.contains("timed out")
    {
        GithubAccessCategory::NetworkError
    } else {
        GithubAccessCategory::UnknownError
    }
}

fn is_push_rejection(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("rejected")
        || lower.contains("fetch first")
        || lower.contains("non-fast-forward")
        || lower.contains("failed to push some refs")
        || lower.contains("stale info")
}

fn strict_validation_error(message: String) -> String {
    format!(
        "{} Axiom will not write sync state into this folder.",
        message
    )
}

fn validate_repo_path_with_stats(
    path: &str,
    expected_url: Option<String>,
    stats: &mut GitCommandStats,
) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Axiom Workspace needs a local sync folder before it can sync.".to_string());
    }

    let repo_path = PathBuf::from(trimmed);
    if !repo_path.exists() {
        return Err("The local sync folder does not exist yet.".to_string());
    }
    if !repo_path.is_dir() {
        return Err("The local sync path must be a folder.".to_string());
    }

    let inside = stats.run(
        &["rev-parse", "--is-inside-work-tree"],
        Some(&repo_path),
        Duration::from_secs(5),
    )?;
    if inside != "true" {
        return Err(
            "A sync folder already exists but is not valid. Axiom can create a fresh sync folder safely during setup."
                .to_string(),
        );
    }

    let git_dir = stats.run(
        &["rev-parse", "--show-toplevel"],
        Some(&repo_path),
        Duration::from_secs(5),
    )?;
    let root = PathBuf::from(git_dir);
    if root != repo_path {
        return Err("The sync folder must be the root of the Axiom sync workspace.".to_string());
    }

    let remote = stats
        .run(
            &["remote", "get-url", "origin"],
            Some(&repo_path),
            Duration::from_secs(5),
        )
        .map_err(|_| {
            strict_validation_error(
                "The sync folder is a Git repo, but it has no origin remote.".to_string(),
            )
        })?;
    let expected = normalize_repo_url(&expected_repo_url(expected_url));
    let actual = normalize_repo_url(&remote);
    if actual != expected {
        return Err(strict_validation_error(
            "This folder is a Git repo, but it is not the Axiom team sync workspace.".to_string(),
        ));
    }

    Ok(repo_path)
}

fn validate_repo_path(path: &str, expected_url: Option<String>) -> Result<PathBuf, String> {
    let mut stats = GitCommandStats::default();
    validate_repo_path_with_stats(path, expected_url, &mut stats)
}

fn ensure_structure(repo_path: &Path) -> Result<(), String> {
    fs::create_dir_all(repo_path.join("state").join("events"))
        .map_err(|e| format!("Could not create sync events folder: {}", e))?;
    fs::create_dir_all(repo_path.join("state").join("snapshots"))
        .map_err(|e| format!("Could not create sync snapshots folder: {}", e))?;
    fs::create_dir_all(repo_path.join("state").join("access-checks"))
        .map_err(|e| format!("Could not create sync access check folder: {}", e))?;
    Ok(())
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

fn read_events(repo_path: &Path) -> Result<(Vec<Value>, u32), String> {
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
            Some(value)
                if value.get("id").and_then(Value::as_str).is_some()
                    && value.get("version").and_then(Value::as_u64) == Some(1) =>
            {
                events.push(value);
            }
            _ => skipped += 1,
        }
    }

    Ok((events, skipped))
}

fn write_event(repo_path: &Path, event: &Value) -> Result<(), String> {
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
    if event_path.exists() {
        return Ok(());
    }
    let content = serde_json::to_string_pretty(event)
        .map_err(|e| format!("Could not serialize sync event: {}", e))?;
    fs::write(&event_path, content).map_err(|e| format!("Could not write sync event: {}", e))
}

fn write_snapshot(repo_path: &Path, snapshot: &Value) -> Result<(), String> {
    let device_id = safe_segment(
        snapshot
            .get("createdByDeviceId")
            .and_then(Value::as_str)
            .unwrap_or("unknown-device"),
        "unknown-device",
    );
    let snapshot_path = repo_path
        .join("state")
        .join("snapshots")
        .join(format!("{}.json", device_id));
    let content = serde_json::to_string_pretty(snapshot)
        .map_err(|e| format!("Could not serialize sync snapshot: {}", e))?;
    fs::write(&snapshot_path, content).map_err(|e| format!("Could not write sync snapshot: {}", e))
}

fn snapshot_without_timestamp(value: &Value) -> Value {
    let mut copy = value.clone();
    if let Some(object) = copy.as_object_mut() {
        object.remove("createdAt");
    }
    copy
}

fn snapshot_has_meaningful_change(repo_path: &Path, snapshot: &Value) -> bool {
    let device_id = safe_segment(
        snapshot
            .get("createdByDeviceId")
            .and_then(Value::as_str)
            .unwrap_or("unknown-device"),
        "unknown-device",
    );
    let snapshot_path = repo_path
        .join("state")
        .join("snapshots")
        .join(format!("{}.json", device_id));
    let existing = fs::read_to_string(snapshot_path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok());

    match existing {
        Some(value) => snapshot_without_timestamp(&value) != snapshot_without_timestamp(snapshot),
        None => true,
    }
}

fn clone_sync_repo(sync_repo_url: &str, destination: &Path) -> Result<(), String> {
    let destination_text = destination.to_string_lossy().to_string();
    git_command(
        &["clone", sync_repo_url.trim(), &destination_text],
        None,
        Duration::from_secs(120),
    )
    .map_err(|e| {
        format!(
            "Axiom could not connect the team sync workspace. Check GitHub access and try again. {}",
            e
        )
    })?;
    Ok(())
}

fn recovered_sync_path(sync_path: &Path) -> PathBuf {
    let parent = sync_path.parent().unwrap_or_else(|| Path::new("."));
    for index in 2..100 {
        let candidate = parent.join(format!("sync-{}", index));
        if !candidate.exists() {
            return candidate;
        }
    }

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    parent.join(format!("sync-recovered-{}", seconds))
}

fn pull_remote_updates(repo_path: &Path, stats: &mut GitCommandStats) -> Result<(), String> {
    if let Err(message) = stats.run(
        &["pull", "--ff-only"],
        Some(repo_path),
        Duration::from_secs(60),
    ) {
        let lower = message.to_lowercase();
        if lower.contains("conflict") || lower.contains("merge") || lower.contains("overwritten") {
            return Err("Sync found a conflict in the team sync workspace. Contact Aidan before trying manual fixes.".to_string());
        }
        return Err(format!(
            "Sync could not download updates from GitHub. Check internet and GitHub login. {}",
            message
        ));
    }

    Ok(())
}

fn stage_state(repo_path: &Path) -> Result<bool, String> {
    let mut stats = GitCommandStats::default();
    stage_state_with_stats(repo_path, &mut stats)
}

fn stage_state_with_stats(repo_path: &Path, stats: &mut GitCommandStats) -> Result<bool, String> {
    stats.run(&["add", "state"], Some(repo_path), Duration::from_secs(15))?;
    let status = stats.run(
        &["status", "--porcelain", "state"],
        Some(repo_path),
        Duration::from_secs(5),
    )?;
    Ok(!status.trim().is_empty())
}

fn commit_state(repo_path: &Path, message: &str) -> Result<bool, String> {
    if !stage_state(repo_path)? {
        return Ok(false);
    }
    git_command(
        &["commit", "-m", message],
        Some(repo_path),
        Duration::from_secs(15),
    )?;
    Ok(true)
}

fn commit_state_with_stats(
    repo_path: &Path,
    message: &str,
    stats: &mut GitCommandStats,
) -> Result<bool, String> {
    if !stage_state_with_stats(repo_path, stats)? {
        return Ok(false);
    }
    stats.run(
        &["commit", "-m", message],
        Some(repo_path),
        Duration::from_secs(15),
    )?;
    Ok(true)
}

fn recover_after_push_rejection(
    repo_path: &Path,
    stats: &mut GitCommandStats,
) -> Result<(), String> {
    stats
        .run(
            &["pull", "--rebase"],
            Some(repo_path),
            Duration::from_secs(60),
        )
        .map_err(|_| {
            let _ = stats.run(
                &["rebase", "--abort"],
                Some(repo_path),
                Duration::from_secs(15),
            );
            CONCURRENT_SYNC_ERROR.to_string()
        })?;
    Ok(())
}

fn push_with_single_retry(
    repo_path: &Path,
    retry_commit_message: &str,
    stats: &mut GitCommandStats,
) -> Result<(), String> {
    match stats.run(&["push"], Some(repo_path), Duration::from_secs(60)) {
        Ok(_) => Ok(()),
        Err(message) if is_push_rejection(&message) => {
            recover_after_push_rejection(repo_path, stats)?;
            commit_state_with_stats(repo_path, retry_commit_message, stats)?;
            stats
                .run(&["push"], Some(repo_path), Duration::from_secs(60))
                .map_err(|retry_message| {
                    if is_push_rejection(&retry_message) {
                        CONCURRENT_SYNC_ERROR.to_string()
                    } else {
                        format!(
                            "Sync could not upload changes. Check internet and GitHub login. {}",
                            retry_message
                        )
                    }
                })?;
            Ok(())
        }
        Err(message) => Err(format!(
            "Sync could not upload changes. Check internet and GitHub login. {}",
            message
        )),
    }
}

fn write_access_check(repo_path: &Path, device_id: &str) -> Result<(), String> {
    let safe_device_id = safe_segment(device_id, "unknown-device");
    let access_dir = repo_path.join("state").join("access-checks");
    fs::create_dir_all(&access_dir)
        .map_err(|e| format!("Could not create sync access check folder: {}", e))?;
    let access_path = access_dir.join(format!("{}.json", safe_device_id));
    let checked_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let content = serde_json::to_string_pretty(&json!({
        "version": 1,
        "deviceId": safe_device_id,
        "checkedAtUnix": checked_at,
    }))
    .map_err(|e| format!("Could not serialize sync access check: {}", e))?;
    fs::write(access_path, content).map_err(|e| format!("Could not write sync access check: {}", e))
}

#[tauri::command]
pub fn check_git_installed() -> GitInstallCheck {
    match git_command(&["--version"], None, Duration::from_secs(5)) {
        Ok(version) => GitInstallCheck {
            installed: true,
            version: Some(version.clone()),
            message: version,
        },
        Err(message) => GitInstallCheck {
            installed: false,
            version: None,
            message: if message.is_empty() {
                "Git is needed for free team sync. Axiom Workspace uses GitHub to share sessions and locks without a paid database.".to_string()
            } else {
                message
            },
        },
    }
}

#[tauri::command]
pub fn validate_github_access(sync_repo_url: String) -> GithubAccessValidation {
    match git_command(
        &["ls-remote", sync_repo_url.trim()],
        None,
        Duration::from_secs(15),
    ) {
        Ok(_) => GithubAccessValidation {
            ok: true,
            category: GithubAccessCategory::Ready,
            message: "GitHub read access works. Axiom will verify upload access after the sync workspace is connected.".to_string(),
        },
        Err(message) => {
            let category = classify_github_error(&message);
            let user_message = match category {
                GithubAccessCategory::GitMissing => "Git is needed for free team sync. Install Git, then click Re-check. You may need to restart Axiom Workspace so Git is available.".to_string(),
                GithubAccessCategory::RepoNotFound => "Axiom could not find the team sync repo. Make sure this GitHub account has access to Mageester/axiom-workspace-sync, then try again.".to_string(),
                GithubAccessCategory::NoAccess => "GitHub access is needed so Axiom Workspace can read and write shared coordination state. Make sure this GitHub account has access to Mageester/axiom-workspace-sync, then try again.".to_string(),
                GithubAccessCategory::NetworkError => "Axiom could not reach GitHub. Check internet access, then try again.".to_string(),
                _ => "Axiom could not verify GitHub access. Make sure this GitHub account has access to Mageester/axiom-workspace-sync, then try again.".to_string(),
            };
            GithubAccessValidation {
                ok: false,
                category,
                message: user_message,
            }
        }
    }
}

#[tauri::command]
pub fn get_default_sync_path(app: tauri::AppHandle) -> Result<String, String> {
    app_sync_path(&app).map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn setup_sync_repo(
    app: tauri::AppHandle,
    sync_repo_url: String,
) -> Result<SyncRepoSetupResult, String> {
    let sync_path = app_sync_path(&app)?;
    let sync_path_text = sync_path.to_string_lossy().to_string();

    if sync_path.exists() {
        if let Ok(repo_path) = validate_repo_path(&sync_path_text, Some(sync_repo_url.clone())) {
            ensure_structure(&repo_path)?;
            return Ok(SyncRepoSetupResult {
                ok: true,
                sync_local_path: repo_path.to_string_lossy().to_string(),
                message: "Axiom team sync workspace is connected.".to_string(),
                recovered: false,
            });
        }

        let recovered_path = recovered_sync_path(&sync_path);
        clone_sync_repo(&sync_repo_url, &recovered_path)?;
        ensure_structure(&recovered_path)?;
        return Ok(SyncRepoSetupResult {
            ok: true,
            sync_local_path: recovered_path.to_string_lossy().to_string(),
            message: "An old sync folder was found but it was not valid. Axiom Workspace created a fresh sync folder safely.".to_string(),
            recovered: true,
        });
    }

    if let Some(parent) = sync_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create Axiom app data folder: {}", e))?;
    }

    clone_sync_repo(&sync_repo_url, &sync_path)?;

    ensure_structure(&sync_path)?;
    Ok(SyncRepoSetupResult {
        ok: true,
        sync_local_path: sync_path.to_string_lossy().to_string(),
        message: "Axiom team sync workspace is connected.".to_string(),
        recovered: false,
    })
}

#[tauri::command]
pub fn validate_sync_write_access(
    path: String,
    expected_repo_url: Option<String>,
    device_id: String,
) -> SyncRepoValidation {
    let repo_path = match validate_repo_path(&path, expected_repo_url) {
        Ok(repo_path) => repo_path,
        Err(message) => {
            return SyncRepoValidation {
                ok: false,
                message,
                path,
            }
        }
    };

    let result = ensure_structure(&repo_path)
        .and_then(|_| {
            let mut stats = GitCommandStats::default();
            pull_remote_updates(&repo_path, &mut stats)
        })
        .and_then(|_| write_access_check(&repo_path, &device_id))
        .and_then(|_| {
            commit_state(&repo_path, "sync: verify workspace write access")
                .map_err(|_| WRITE_ACCESS_ERROR.to_string())
        })
        .and_then(|_| {
            let mut stats = GitCommandStats::default();
            push_with_single_retry(
                &repo_path,
                "sync: verify workspace write access",
                &mut stats,
            )
            .map_err(|_| WRITE_ACCESS_ERROR.to_string())
        });

    match result {
        Ok(()) => SyncRepoValidation {
            ok: true,
            message: "GitHub upload access is ready.".to_string(),
            path: repo_path.to_string_lossy().to_string(),
        },
        Err(message) => SyncRepoValidation {
            ok: false,
            message,
            path: repo_path.to_string_lossy().to_string(),
        },
    }
}

#[tauri::command]
pub fn validate_sync_repo(path: String, expected_repo_url: Option<String>) -> SyncRepoValidation {
    match validate_repo_path(&path, expected_repo_url) {
        Ok(repo_path) => match ensure_structure(&repo_path) {
            Ok(()) => SyncRepoValidation {
                ok: true,
                message: "Axiom team sync workspace is ready.".to_string(),
                path: repo_path.to_string_lossy().to_string(),
            },
            Err(message) => SyncRepoValidation {
                ok: false,
                message,
                path,
            },
        },
        Err(message) => SyncRepoValidation {
            ok: false,
            message,
            path,
        },
    }
}

#[tauri::command]
pub fn ensure_sync_structure(path: String) -> Result<String, String> {
    let repo_path = validate_repo_path(&path, None)?;
    ensure_structure(&repo_path)?;
    Ok("Sync folders are ready.".to_string())
}

#[tauri::command]
pub fn sync_now(
    path: String,
    sync_repo_url: String,
    events: Vec<Value>,
    snapshot: Value,
) -> Result<SyncNowResult, String> {
    let _guard = SyncInFlightGuard::acquire()?;
    let started = SystemTime::now();
    let mut stats = GitCommandStats::default();
    let repo_path = validate_repo_path_with_stats(&path, Some(sync_repo_url), &mut stats)?;
    ensure_structure(&repo_path)?;

    for event in &events {
        write_event(&repo_path, event)?;
    }

    pull_remote_updates(&repo_path, &mut stats)?;

    let (shared_events, skipped) = read_events(&repo_path)?;
    if snapshot_has_meaningful_change(&repo_path, &snapshot) {
        write_snapshot(&repo_path, &snapshot)?;
    }

    if !commit_state_with_stats(&repo_path, "sync: update workspace state", &mut stats)? {
        let duration_ms = started.elapsed().unwrap_or_default().as_millis();
        return Ok(SyncNowResult {
            ok: true,
            message: if skipped > 0 {
                format!(
                    "Sync complete. Ignored {} unreadable event file{}.",
                    skipped,
                    if skipped == 1 { "" } else { "s" }
                )
            } else {
                "Sync complete. No new changes to upload.".to_string()
            },
            events: shared_events,
            skipped,
            committed: false,
            duration_ms,
            git_command_count: stats.count,
            last_command_error: stats.last_error,
        });
    }

    push_with_single_retry(&repo_path, "sync: update workspace state", &mut stats)?;
    let (latest_events, latest_skipped) = read_events(&repo_path)?;
    let duration_ms = started.elapsed().unwrap_or_default().as_millis();

    Ok(SyncNowResult {
        ok: true,
        message: if latest_skipped > 0 {
            format!(
                "Sync complete. Uploaded changes and ignored {} unreadable event file{}.",
                latest_skipped,
                if latest_skipped == 1 { "" } else { "s" }
            )
        } else {
            "Sync complete. Shared sessions and locks are up to date.".to_string()
        },
        events: latest_events,
        skipped: latest_skipped,
        committed: true,
        duration_ms,
        git_command_count: stats.count,
        last_command_error: stats.last_error,
    })
}
