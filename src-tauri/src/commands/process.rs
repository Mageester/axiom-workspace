use serde::Serialize;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcessErrorKind {
    NotFound,
    TimedOut,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessError {
    pub program: String,
    pub args: Vec<String>,
    pub message: String,
    pub kind: ProcessErrorKind,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ProcessOutput {
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u128,
}

impl ProcessError {
    pub fn user_message(&self) -> String {
        self.message.clone()
    }
}

pub fn run_command(
    program: &str,
    args: &[&str],
    cwd: Option<&Path>,
    timeout: Duration,
) -> Result<ProcessOutput, ProcessError> {
    let started = Instant::now();
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(path) = cwd {
        command.current_dir(path);
    }

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command.spawn().map_err(|error| {
        let kind = if error.kind() == std::io::ErrorKind::NotFound {
            ProcessErrorKind::NotFound
        } else {
            ProcessErrorKind::Failed
        };
        let message = if matches!(kind, ProcessErrorKind::NotFound) {
            format!("{} is not installed or not found on PATH", program)
        } else {
            format!("Failed to run {}: {}", program, error)
        };
        ProcessError {
            program: program.to_string(),
            args: args.iter().map(|arg| arg.to_string()).collect(),
            message,
            kind,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms: started.elapsed().as_millis(),
        }
    })?;

    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child.wait_with_output().map_err(|error| ProcessError {
                    program: program.to_string(),
                    args: args.iter().map(|arg| arg.to_string()).collect(),
                    message: format!("Failed to read {} output: {}", program, error),
                    kind: ProcessErrorKind::Failed,
                    stdout: String::new(),
                    stderr: String::new(),
                    duration_ms: started.elapsed().as_millis(),
                })?;
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let duration_ms = started.elapsed().as_millis();

                if output.status.success() {
                    return Ok(ProcessOutput {
                        stdout,
                        stderr,
                        duration_ms,
                    });
                }

                let message = if stderr.is_empty() {
                    stdout.clone()
                } else {
                    stderr.clone()
                };
                return Err(ProcessError {
                    program: program.to_string(),
                    args: args.iter().map(|arg| arg.to_string()).collect(),
                    message,
                    kind: ProcessErrorKind::Failed,
                    stdout,
                    stderr,
                    duration_ms,
                });
            }
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let duration_ms = started.elapsed().as_millis();
                    return Err(ProcessError {
                        program: program.to_string(),
                        args: args.iter().map(|arg| arg.to_string()).collect(),
                        message: format!(
                            "{} timed out after {} seconds",
                            program,
                            timeout.as_secs()
                        ),
                        kind: ProcessErrorKind::TimedOut,
                        stdout: String::new(),
                        stderr: String::new(),
                        duration_ms,
                    });
                }
                thread::sleep(Duration::from_millis(25));
            }
            Err(error) => {
                return Err(ProcessError {
                    program: program.to_string(),
                    args: args.iter().map(|arg| arg.to_string()).collect(),
                    message: format!("Failed to wait for {}: {}", program, error),
                    kind: ProcessErrorKind::Failed,
                    stdout: String::new(),
                    stderr: String::new(),
                    duration_ms: started.elapsed().as_millis(),
                });
            }
        }
    }
}
