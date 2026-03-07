import type { RuntimeKind, RuntimeSettings, SettingsSection, UpdateInfo } from "../types";
import { compactRuntimeName } from "../utils/format";

type SettingsModalProps = {
  busy: boolean;
  downloadingLlama: boolean;
  runtime: RuntimeSettings;
  settingsSection: SettingsSection;
  status: string;
  updateInfo: UpdateInfo | null;
  checkingUpdates: boolean;
  onClose: () => void;
  onSectionChange: (section: SettingsSection) => void;
  onEditProfile: () => void;
  onRuntimeChange: (runtime: RuntimeSettings) => void;
  onPickFile: (target: "llama" | "python") => Promise<void> | void;
  onPickFolder: () => Promise<void> | void;
  onSave: () => Promise<void>;
  onAutoDownloadLlama: () => Promise<void>;
  onCheckUpdates: () => Promise<void>;
};

export function SettingsModal({
  busy,
  downloadingLlama,
  runtime,
  settingsSection,
  status,
  updateInfo,
  checkingUpdates,
  onClose,
  onSectionChange,
  onEditProfile,
  onRuntimeChange,
  onPickFile,
  onPickFolder,
  onSave,
  onAutoDownloadLlama,
  onCheckUpdates
}: SettingsModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
        <aside className="settings-sidebar">
          <div>
            <p className="pane-label">Settings</p>
            <h3>Configuration</h3>
          </div>
          <div className="settings-nav">
            {(["general", "runtime", "downloads", "about"] as const).map((item) => (
              <button
                key={item}
                className={`settings-nav-item ${settingsSection === item ? "active" : ""}`}
                onClick={() => onSectionChange(item)}
                type="button"
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <div className="settings-user" onClick={onEditProfile} style={{ cursor: "pointer" }} title="Edit profile">
            {runtime.user_profile.avatar_url ? (
              <img src={runtime.user_profile.avatar_url} alt="Avatar" className="user-badge" style={{ objectFit: "cover" }} />
            ) : (
              <div className="user-badge" />
            )}
            <div>
              <strong>{runtime.user_profile.username}</strong>
              <span>desktop runtime</span>
            </div>
          </div>
        </aside>

        <section className="settings-content">
          <div className="settings-top">
            <h3>
              {settingsSection === "general" && "General Settings"}
              {settingsSection === "runtime" && "Runtime Configuration"}
              {settingsSection === "downloads" && "Download Settings"}
            </h3>
            <button className="mini-button" onClick={onClose} type="button">
              X
            </button>
          </div>

          {settingsSection === "general" ? (
            <div className="settings-panels">
              <div className="settings-card">
                <h4>Application</h4>
                <div className="info-list">
                  <div>
                    <span>Status</span>
                    <strong>{status}</strong>
                  </div>
                  <div>
                    <span>Backend</span>
                    <strong>{compactRuntimeName(runtime.runtime_kind)}</strong>
                  </div>
                  <div>
                    <span>Current URL</span>
                    <strong>{runtime.server_base_url}</strong>
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h4>System Prompt</h4>
                <label>
                  Instructions for the AI model
                  <textarea
                    value={runtime.system_prompt ?? ""}
                    onChange={(event) => onRuntimeChange({ ...runtime, system_prompt: event.target.value })}
                    placeholder="You are a helpful AI assistant..."
                    rows={6}
                    style={{ minHeight: "120px" }}
                  />
                </label>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  Define tone, language, and persistent rules for the assistant.
                </p>
              </div>
            </div>
          ) : null}

          {settingsSection === "runtime" ? (
            <div className="settings-panels">
              <div className="settings-card">
                <h4>Runtime</h4>
                <label>
                  Backend
                  <select
                    value={runtime.runtime_kind}
                    onChange={(event) => onRuntimeChange({ ...runtime, runtime_kind: event.target.value as RuntimeKind })}
                  >
                    <option value="llama_cpp">llama.cpp</option>
                    <option value="vllm">vLLM</option>
                  </select>
                </label>
                <label>
                  OpenAI-compatible URL
                  <input value={runtime.server_base_url} onChange={(event) => onRuntimeChange({ ...runtime, server_base_url: event.target.value })} />
                </label>
                <label>
                  Hugging Face token
                  <input
                    value={runtime.huggingface_token ?? ""}
                    onChange={(event) => onRuntimeChange({ ...runtime, huggingface_token: event.target.value })}
                    placeholder="Optional token"
                  />
                </label>
              </div>
              <div className="settings-card">
                <h4>llama.cpp</h4>
                <label>
                  llama-server executable
                  <div className="input-row">
                    <input
                      value={runtime.llama_server_path ?? ""}
                      onChange={(event) => onRuntimeChange({ ...runtime, llama_server_path: event.target.value })}
                    />
                    <button className="subtle-button" onClick={() => onPickFile("llama")} type="button">
                      Browse
                    </button>
                  </div>
                </label>
                {!runtime.llama_server_path && !downloadingLlama ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "16px",
                      background: "var(--accent-soft)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--accent)"
                    }}
                  >
                    <p style={{ fontSize: "14px", marginBottom: "4px", color: "var(--text-primary)", fontWeight: 500 }}>Quick Setup</p>
                    <p style={{ fontSize: "13px", marginBottom: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                      Download the latest official Windows build of llama.cpp automatically.
                    </p>
                    <button disabled={busy} onClick={onAutoDownloadLlama} type="button">
                      Download llama.cpp
                    </button>
                  </div>
                ) : null}
                {downloadingLlama ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "16px",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>Downloading llama.cpp...</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>{status}</p>
                  </div>
                ) : null}
              </div>
              <div className="settings-card">
                <h4>vLLM</h4>
                <label>
                  Python executable
                  <div className="input-row">
                    <input
                      value={runtime.vllm_python_path ?? ""}
                      onChange={(event) => onRuntimeChange({ ...runtime, vllm_python_path: event.target.value })}
                    />
                    <button className="subtle-button" onClick={() => onPickFile("python")} type="button">
                      Browse
                    </button>
                  </div>
                </label>
                <label>
                  Model id/path
                  <input value={runtime.vllm_model_path ?? ""} onChange={(event) => onRuntimeChange({ ...runtime, vllm_model_path: event.target.value })} />
                </label>
                <label>
                  Extra args
                  <input value={runtime.vllm_args} onChange={(event) => onRuntimeChange({ ...runtime, vllm_args: event.target.value })} />
                </label>
              </div>
            </div>
          ) : null}

          {settingsSection === "downloads" ? (
            <div className="settings-panels">
              <div className="settings-card">
                <h4>Download Directory</h4>
                <label>
                  Folder
                  <div className="input-row">
                    <input value={runtime.download_dir} onChange={(event) => onRuntimeChange({ ...runtime, download_dir: event.target.value })} />
                    <button className="subtle-button" onClick={onPickFolder} type="button">
                      Browse
                    </button>
                  </div>
                </label>
              </div>
            </div>
          ) : null}

          {settingsSection === "about" ? (
            <div className="settings-panels">
              <div className="settings-card">
                <h4>About LmApp</h4>
                <div className="info-list">
                  <div>
                    <span>Version</span>
                    <strong>{updateInfo?.current_version ?? "0.1.0"}</strong>
                  </div>
                  <div>
                    <span>Repository</span>
                    <strong>
                      <a href={updateInfo?.repo_url ?? "https://github.com/FUXKVOB/Lmapp"} target="_blank" rel="noreferrer">
                        github.com/FUXKVOB/Lmapp
                      </a>
                    </strong>
                  </div>
                  <div>
                    <span>Developer</span>
                    <strong>
                      <a href="https://t.me/rxzsu" target="_blank" rel="noreferrer">
                        @rxzsu on Telegram
                      </a>
                    </strong>
                  </div>
                </div>
              </div>
              <div className="settings-card">
                <h4>Updates</h4>
                <div className="info-list">
                  <div>
                    <span>Status</span>
                    <strong>
                      {checkingUpdates
                        ? "Checking..."
                        : updateInfo?.latest_version
                          ? updateInfo.update_available
                            ? `Update available: ${updateInfo.latest_version}`
                            : `Up to date: ${updateInfo.current_version}`
                          : "Not checked yet"}
                    </strong>
                  </div>
                  {updateInfo?.update_available ? (
                    <div>
                      <span>Release</span>
                      <strong>
                        <a href={updateInfo.release_url} target="_blank" rel="noreferrer">
                          Open latest release
                        </a>
                      </strong>
                    </div>
                  ) : null}
                </div>
                <div className="settings-footer" style={{ padding: 0, borderTop: "none", justifyContent: "flex-start" }}>
                  <button disabled={busy || checkingUpdates} onClick={onCheckUpdates} type="button">
                    {checkingUpdates ? "Checking..." : "Check for Updates"}
                  </button>
                </div>
              </div>
              <div className="settings-card">
                <h4>Release Notes 0.1.0</h4>
                <div className="release-notes">
                  <div>
                    <strong>Desktop shell</strong>
                    <span>Frameless window, native-like titlebar controls, tray integration, glassmorphism, and hide-to-tray behavior.</span>
                  </div>
                  <div>
                    <strong>Workspace</strong>
                    <span>Persistent chats, model library management, onboarding flow, runtime setup guidance, and deep-link style navigation.</span>
                  </div>
                  <div>
                    <strong>Runtime tools</strong>
                    <span>llama.cpp auto-download, runtime status visibility, tray start/stop actions, and GitHub-based app update checks.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="settings-footer">
            <button className="subtle-button" onClick={onClose} type="button">
              Close
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                await onSave();
                onClose();
              }}
              type="button"
            >
              Save Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
