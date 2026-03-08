import type { AppState } from "./types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful local AI assistant. Reply in the same language as the user. Be concise, friendly, and practical.";

export const DEFAULT_STATE: AppState = {
  models: [],
  active_model_id: null,
  chats: [],
  active_chat_id: null,
  onboarding_completed: false,
  runtime: {
    runtime_kind: "llama_cpp",
    server_base_url: "http://127.0.0.1:8080",
    llama_server_path: null,
    vllm_python_path: null,
    vllm_model_path: null,
    vllm_args: "--host 127.0.0.1 --port 8080",
    huggingface_token: null,
    download_dir: "",
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    user_profile: {
      username: "local user",
      avatar_url: null
    }
  },
  downloads: [],
  logs: [],
  presets: [],
  is_server_running: false,
  server_status: "stopped"
};
