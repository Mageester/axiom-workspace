use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectOpenAction {
    Code,
    Folder,
    Terminal,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectActionResponse {
    ok: bool,
}

fn spawn_hidden(command: &mut Command) -> Result<(), String> {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command.spawn().map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_project_action(
    action: ProjectOpenAction,
    path: String,
) -> Result<ProjectActionResponse, String> {
    let project_path = Path::new(&path);
    if !project_path.exists() {
        return Err("Project is not installed on this device.".to_string());
    }

    match action {
        ProjectOpenAction::Code => {
            let mut command = Command::new("code");
            command.arg("-n").arg(project_path);
            spawn_hidden(&mut command)?;
        }
        ProjectOpenAction::Folder => {
            #[cfg(windows)]
            {
                let mut command = Command::new("explorer");
                command.arg(project_path);
                spawn_hidden(&mut command)?;
            }
            #[cfg(target_os = "macos")]
            {
                let mut command = Command::new("open");
                command.arg(project_path);
                spawn_hidden(&mut command)?;
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                let mut command = Command::new("xdg-open");
                command.arg(project_path);
                spawn_hidden(&mut command)?;
            }
        }
        ProjectOpenAction::Terminal => {
            #[cfg(windows)]
            {
                let mut command = Command::new("wt");
                command.arg("-d").arg(project_path);
                if spawn_hidden(&mut command).is_err() {
                    let mut fallback = Command::new("powershell");
                    fallback
                        .arg("-NoExit")
                        .arg("-Command")
                        .arg("Set-Location -LiteralPath $args[0]")
                        .arg(project_path);
                    spawn_hidden(&mut fallback)?;
                }
            }
            #[cfg(target_os = "macos")]
            {
                let mut command = Command::new("open");
                command.arg("-a").arg("Terminal").arg(project_path);
                spawn_hidden(&mut command)?;
            }
            #[cfg(all(unix, not(target_os = "macos")))]
            {
                let mut command = Command::new("x-terminal-emulator");
                command.arg("--working-directory").arg(project_path);
                spawn_hidden(&mut command)?;
            }
        }
    }

    Ok(ProjectActionResponse { ok: true })
}
