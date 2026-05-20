use serde::Serialize;
use std::env;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemIdentity {
    pub user_name: String,
    pub host_name: String,
}

fn capitalize(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let mut chars = trimmed.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn read_username() -> String {
    if let Ok(value) = env::var("USERNAME") {
        if !value.trim().is_empty() {
            return capitalize(&value);
        }
    }
    if let Ok(value) = env::var("USER") {
        if !value.trim().is_empty() {
            return capitalize(&value);
        }
    }
    String::new()
}

fn read_hostname() -> String {
    if let Ok(value) = env::var("COMPUTERNAME") {
        if !value.trim().is_empty() {
            return value;
        }
    }
    if let Ok(value) = env::var("HOSTNAME") {
        if !value.trim().is_empty() {
            return value;
        }
    }
    if let Ok(output) = std::process::Command::new("hostname").output() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stdout.is_empty() {
            return stdout;
        }
    }
    "Axiom Device".to_string()
}

#[tauri::command]
pub fn get_system_identity() -> SystemIdentity {
    SystemIdentity {
        user_name: read_username(),
        host_name: read_hostname(),
    }
}
