export type RuntimeKind = "llama_cpp" | "vllm";
export type View = "chat" | "models";
export type SettingsSection = "general" | "runtime" | "downloads" | "about";

export type UpdateInfo = {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  repo_url: string;
  release_url: string;
};

export type ModelRecord = {
  id: string;
  title: string;
  source: string;
  filename: string;
  local_path: string;
  downloaded: boolean;
  runtime_hint: RuntimeKind;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSession = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
};

export type DownloadStatus = {
  model_id: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number | null;
  status: string;
  error?: string | null;
};

export type ModelPreset = {
  id: string;
  title: string;
  repo_id: string;
  filename: string;
  runtime_hint: RuntimeKind;
  summary: string;
};

export type UserProfile = {
  username: string;
  avatar_url: string | null;
};

export type RuntimeSettings = {
  runtime_kind: RuntimeKind;
  server_base_url: string;
  llama_server_path: string | null;
  vllm_python_path: string | null;
  vllm_model_path: string | null;
  vllm_args: string;
  huggingface_token: string | null;
  download_dir: string;
  system_prompt: string | null;
  user_profile: UserProfile;
};

export type AppState = {
  models: ModelRecord[];
  active_model_id: string | null;
  chats: ChatSession[];
  active_chat_id: string | null;
  onboarding_completed: boolean;
  runtime: RuntimeSettings;
  downloads: DownloadStatus[];
  presets: ModelPreset[];
  is_server_running: boolean;
  server_status: string;
};

export type CatalogModel = {
  id: string;
  title: string;
  repoId: string;
  filename: string;
  runtimeHint: RuntimeKind;
  summary: string;
  tags: string[];
  size: string;
};
