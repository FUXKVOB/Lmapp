use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const DEFAULT_SYSTEM_PROMPT: &str =
    "You are a helpful local AI assistant. Reply in the same language as the user. Be concise, friendly, and practical.";

#[derive(Debug, Deserialize)]
pub struct GitHubRelease {
    pub html_url: String,
    pub tag_name: String,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeKind {
    LlamaCpp,
    Vllm,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelPreset {
    pub id: String,
    pub title: String,
    pub repo_id: String,
    pub filename: String,
    pub runtime_hint: RuntimeKind,
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelRecord {
    pub id: String,
    pub title: String,
    pub source: String,
    pub filename: String,
    pub local_path: String,
    pub downloaded: bool,
    pub runtime_hint: RuntimeKind,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadStatus {
    pub model_id: String,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub status: String,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: u64,
    pub level: String,
    pub scope: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimeSettings {
    pub runtime_kind: RuntimeKind,
    pub server_base_url: String,
    pub llama_server_path: Option<String>,
    pub vllm_python_path: Option<String>,
    pub vllm_model_path: Option<String>,
    pub vllm_args: String,
    pub huggingface_token: Option<String>,
    pub download_dir: String,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default = "default_user_profile")]
    pub user_profile: UserProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersistedState {
    pub models: Vec<ModelRecord>,
    pub active_model_id: Option<String>,
    pub chats: Vec<ChatSession>,
    pub active_chat_id: Option<String>,
    #[serde(default)]
    pub onboarding_completed: bool,
    pub runtime: RuntimeSettings,
}

#[derive(Debug, Serialize, Clone)]
pub struct AppStateDto {
    pub models: Vec<ModelRecord>,
    pub active_model_id: Option<String>,
    pub chats: Vec<ChatSession>,
    pub active_chat_id: Option<String>,
    pub onboarding_completed: bool,
    pub runtime: RuntimeSettings,
    pub downloads: Vec<DownloadStatus>,
    pub logs: Vec<LogEntry>,
    pub presets: Vec<ModelPreset>,
    pub is_server_running: bool,
    pub server_status: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub update_available: bool,
    pub repo_url: String,
    pub release_url: String,
}

pub fn default_user_profile() -> UserProfile {
    UserProfile {
        username: "local user".into(),
        avatar_url: None,
    }
}

pub fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn default_presets() -> Vec<ModelPreset> {
    vec![
        ModelPreset {
            id: "llama32-3b-q4".into(),
            title: "Llama 3.2 3B Q4".into(),
            repo_id: "bartowski/Llama-3.2-3B-Instruct-GGUF".into(),
            filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf".into(),
            runtime_hint: RuntimeKind::LlamaCpp,
            summary: "Fast local GGUF preset for laptop and desktop CPUs.".into(),
        },
        ModelPreset {
            id: "qwen25-7b-q4".into(),
            title: "Qwen 2.5 7B Q4".into(),
            repo_id: "bartowski/Qwen2.5-7B-Instruct-GGUF".into(),
            filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf".into(),
            runtime_hint: RuntimeKind::LlamaCpp,
            summary: "Balanced instruction model with stronger reasoning than small 3B presets."
                .into(),
        },
        ModelPreset {
            id: "vllm-qwen32b".into(),
            title: "vLLM Qwen 32B".into(),
            repo_id: "Qwen/Qwen2.5-32B-Instruct".into(),
            filename: "Use Hugging Face model id in vLLM settings".into(),
            runtime_hint: RuntimeKind::Vllm,
            summary: "Preset target for GPU-heavy vLLM deployment with transformers weights."
                .into(),
        },
    ]
}

impl RuntimeSettings {
    pub fn default_at(base_dir: &Path) -> Self {
        let download_dir = base_dir.join("models");
        Self {
            runtime_kind: RuntimeKind::LlamaCpp,
            server_base_url: "http://127.0.0.1:8080".into(),
            llama_server_path: None,
            vllm_python_path: None,
            vllm_model_path: None,
            vllm_args: "--host 127.0.0.1 --port 8080".into(),
            huggingface_token: None,
            download_dir: download_dir.to_string_lossy().to_string(),
            system_prompt: Some(DEFAULT_SYSTEM_PROMPT.into()),
            user_profile: default_user_profile(),
        }
    }
}

impl PersistedState {
    pub fn default_at(base_dir: &Path) -> Self {
        let chat = ChatSession {
            id: format!("chat-{}", now_ts()),
            title: "Welcome".into(),
            created_at: now_ts(),
            updated_at: now_ts(),
            messages: vec![ChatMessage {
                role: "assistant".into(),
                content: "Add or download a model, start the runtime, and conversation history will be saved automatically.".into(),
            }],
        };
        Self {
            models: Vec::new(),
            active_model_id: None,
            chats: vec![chat.clone()],
            active_chat_id: Some(chat.id),
            onboarding_completed: false,
            runtime: RuntimeSettings::default_at(base_dir),
        }
    }
}
