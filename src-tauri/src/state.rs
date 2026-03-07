use crate::types::{default_presets, AppStateDto, ChatSession, ModelRecord, PersistedState};
use anyhow::Result;
use reqwest::Client;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Child,
    sync::Mutex,
};

pub struct ServerState {
    pub process: Mutex<Option<Child>>,
    pub status: Mutex<String>,
}

pub struct SharedState {
    pub file_path: PathBuf,
    pub app_state: Mutex<PersistedState>,
    pub downloads: Mutex<HashMap<String, crate::types::DownloadStatus>>,
    pub server: ServerState,
    pub client: Client,
}

impl SharedState {
    pub fn load(base_dir: &Path) -> Result<Self> {
        fs::create_dir_all(base_dir)?;
        let file_path = base_dir.join("app_state.json");
        let app_state = if file_path.exists() {
            let raw = fs::read_to_string(&file_path)?;
            match serde_json::from_str(&raw) {
                Ok(state) => state,
                Err(_) => {
                    let backup_path = base_dir.join("app_state.json.backup");
                    let _ = fs::rename(&file_path, &backup_path);
                    PersistedState::default_at(base_dir)
                }
            }
        } else {
            PersistedState::default_at(base_dir)
        };
        fs::create_dir_all(&app_state.runtime.download_dir)?;
        Ok(Self {
            file_path,
            app_state: Mutex::new(app_state),
            downloads: Mutex::new(HashMap::new()),
            server: ServerState {
                process: Mutex::new(None),
                status: Mutex::new("stopped".into()),
            },
            client: Client::new(),
        })
    }

    pub fn save(&self) -> Result<()> {
        let state = self.app_state.lock().unwrap().clone();
        fs::write(&self.file_path, serde_json::to_string_pretty(&state)?)?;
        Ok(())
    }
}

pub fn to_public_state(shared: &SharedState) -> AppStateDto {
    let state = shared.app_state.lock().unwrap().clone();
    let downloads = shared
        .downloads
        .lock()
        .unwrap()
        .values()
        .cloned()
        .collect::<Vec<_>>();
    AppStateDto {
        models: state.models,
        active_model_id: state.active_model_id,
        chats: state.chats,
        active_chat_id: state.active_chat_id,
        onboarding_completed: state.onboarding_completed,
        runtime: state.runtime,
        downloads,
        presets: default_presets(),
        is_server_running: shared.server.process.lock().unwrap().is_some(),
        server_status: shared.server.status.lock().unwrap().clone(),
    }
}

pub fn active_model(state: &PersistedState) -> Result<ModelRecord, String> {
    state
        .active_model_id
        .as_ref()
        .and_then(|id| state.models.iter().find(|item| &item.id == id))
        .cloned()
        .ok_or_else(|| "No active model selected".to_string())
}

pub fn active_chat_mut(state: &mut PersistedState) -> Result<&mut ChatSession, String> {
    let chat_id = state
        .active_chat_id
        .clone()
        .ok_or_else(|| "No active chat selected".to_string())?;
    state
        .chats
        .iter_mut()
        .find(|chat| chat.id == chat_id)
        .ok_or_else(|| "Active chat not found".to_string())
}

pub fn slug_title(source: &str, filename: &str) -> String {
    format!("{} / {}", source, filename)
}
