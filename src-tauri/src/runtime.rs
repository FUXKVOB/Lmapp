use crate::state::SharedState;
use crate::types::{GitHubRelease, ModelRecord, RuntimeSettings, UpdateInfo};
use anyhow::{Context, Result};
use reqwest::Client;
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::Duration,
};
use tauri::Manager;
use zip::ZipArchive;

pub fn spawn_llama(runtime: &RuntimeSettings, model: &ModelRecord) -> Result<Child, String> {
    let server_path = runtime
        .llama_server_path
        .clone()
        .ok_or_else(|| "Set the llama-server path in Settings".to_string())?;

    let port = runtime
        .server_base_url
        .rsplit(':')
        .next()
        .ok_or_else(|| "Invalid server URL".to_string())?;

    Command::new(server_path)
        .arg("-m")
        .arg(&model.local_path)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port)
        .arg("-c")
        .arg("4096")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())
}

pub fn spawn_vllm(runtime: &RuntimeSettings) -> Result<Child, String> {
    let python_path = runtime
        .vllm_python_path
        .clone()
        .ok_or_else(|| "Set the Python path for vLLM in Settings".to_string())?;
    let model_path = runtime
        .vllm_model_path
        .clone()
        .ok_or_else(|| "Set the model id or path for vLLM in Settings".to_string())?;

    let args = runtime
        .vllm_args
        .split_whitespace()
        .map(str::to_string)
        .collect::<Vec<_>>();

    Command::new(python_path)
        .arg("-m")
        .arg("vllm.entrypoints.openai.api_server")
        .arg("--model")
        .arg(model_path)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())
}

pub async fn wait_until_server_ready(client: &Client, base_url: &str) -> Result<(), String> {
    for _ in 0..40 {
        let probe = client.get(format!("{base_url}/v1/models")).send().await;
        match probe {
            Ok(response) if response.status().is_success() => return Ok(()),
            _ => tokio::time::sleep(Duration::from_millis(500)).await,
        }
    }
    Err("Runtime did not become ready in time".to_string())
}

pub fn app_dir(handle: &tauri::AppHandle) -> Result<PathBuf> {
    let base = handle
        .path()
        .app_data_dir()
        .context("Failed to resolve app data dir")?;
    Ok(base.join("lmapp"))
}

fn find_llama_server(dir: &Path) -> Option<PathBuf> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && path.file_name().and_then(|n| n.to_str()) == Some("llama-server.exe")
            {
                return Some(path);
            }
            if path.is_dir() {
                if let Some(found) = find_llama_server(&path) {
                    return Some(found);
                }
            }
        }
    }
    None
}

pub async fn download_llama_cpp_inner(
    shared: &SharedState,
    app_dir: &Path,
) -> Result<String, String> {
    let llama_dir = app_dir.join("llama_cpp");
    fs::create_dir_all(&llama_dir).map_err(|e| e.to_string())?;

    let server_path = llama_dir.join("llama-server.exe");
    if server_path.exists() {
        return Ok(server_path.to_string_lossy().to_string());
    }

    let releases: Vec<GitHubRelease> = shared
        .client
        .get("https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=10")
        .header("User-Agent", "LmApp")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {e}"))?;

    let mut download_url: Option<String> = None;
    for release in &releases {
        for asset in &release.assets {
            let name_lower = asset.name.to_lowercase();
            if name_lower.contains("win")
                && name_lower.ends_with(".zip")
                && (name_lower.contains("avx2")
                    || name_lower.contains("avx")
                    || name_lower.contains("x64"))
                && !name_lower.contains("cuda")
                && !name_lower.contains("vulkan")
                && !name_lower.contains("hip")
            {
                download_url = Some(asset.browser_download_url.clone());
                break;
            }
        }
        if download_url.is_some() {
            break;
        }
    }

    let download_url = download_url.ok_or_else(|| {
        "Windows build was not found in recent releases. Download llama.cpp manually from GitHub.".to_string()
    })?;

    let zip_path = llama_dir.join("llama.zip");
    let response = shared
        .client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Download failed: {e}"))?;

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&zip_path, &bytes).map_err(|e| e.to_string())?;

    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let outpath = llama_dir.join(file.name());
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    let _ = fs::remove_file(&zip_path);

    find_llama_server(&llama_dir)
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "llama-server.exe not found in the downloaded archive".to_string())
}

pub async fn check_for_updates(
    client: &Client,
    current_version: &str,
) -> Result<UpdateInfo, String> {
    let repo_url = "https://github.com/FUXKVOB/Lmapp".to_string();
    let release = client
        .get("https://api.github.com/repos/FUXKVOB/Lmapp/releases/latest")
        .header("User-Agent", "LmApp")
        .send()
        .await
        .map_err(|error| format!("Failed to check updates: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Failed to check updates: {error}"))?
        .json::<GitHubRelease>()
        .await
        .map_err(|error| format!("Failed to parse update response: {error}"))?;

    let latest = release.tag_name.trim_start_matches('v').to_string();
    let current = current_version.trim_start_matches('v').to_string();

    Ok(UpdateInfo {
        current_version: current.clone(),
        latest_version: Some(latest.clone()),
        update_available: latest != current,
        repo_url,
        release_url: release.html_url,
    })
}
