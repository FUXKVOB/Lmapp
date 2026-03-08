import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logoUrl from "../assets/logo.png";
import { CatalogModal } from "./components/CatalogModal";
import { ProfileModal } from "./components/ProfileModal";
import { SettingsModal } from "./components/SettingsModal";
import { DEFAULT_STATE } from "./constants";
import { MODEL_CATALOG } from "./modelCatalog";
import type { AppState, CatalogModel, RuntimeSettings, SettingsSection, UpdateInfo, View } from "./types";
import { bytesLabel, compactRuntimeName, formatTime, speedLabel, validateRuntime } from "./utils/format";

function ChatGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 6.5h14v9H8.8L5 18.7V6.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 10h7M8.5 13h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ModelsGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4.5" y="5" width="15" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4.5" y="14" width="6.2" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.3" y="14" width="6.2" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SettingsGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 8.2a3.8 3.8 0 1 1 0 7.6a3.8 3.8 0 0 1 0-7.6Zm7 3.8l1.7 1l-1.6 2.8l-1.9-.4a7.7 7.7 0 0 1-1.4 1.4l.4 1.9l-2.8 1.6l-1-1.7a7.4 7.4 0 0 1-2 0l-1 1.7l-2.8-1.6l.4-1.9a7.7 7.7 0 0 1-1.4-1.4l-1.9.4L3.3 13l1.7-1a7.4 7.4 0 0 1 0-2l-1.7-1l1.6-2.8l1.9.4a7.7 7.7 0 0 1 1.4-1.4l-.4-1.9l2.8-1.6l1 1.7a7.4 7.4 0 0 1 2 0l1-1.7l2.8 1.6l-.4 1.9a7.7 7.7 0 0 1 1.4 1.4l1.9-.4l1.6 2.8l-1.7 1c.1.7.1 1.3 0 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function App() {
  const appWindow = getCurrentWindow();
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [view, setView] = useState<View>("chat");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [status, setStatus] = useState("Ready");
  const [prompt, setPrompt] = useState("");
  const [runtime, setRuntime] = useState<RuntimeSettings>(DEFAULT_STATE.runtime);
  const [chatFilter, setChatFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSpeeds, setDownloadSpeeds] = useState<Record<string, number>>({});
  const [downloadingLlama, setDownloadingLlama] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; tone: "info" | "success" | "error"; message: string }>>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const previousDownloadBytesRef = useRef<Record<string, number>>({});

  function pushToast(message: string, tone: "info" | "success" | "error" = "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }

  const activeChat = useMemo(
    () => state.chats.find((chat) => chat.id === state.active_chat_id) ?? null,
    [state.active_chat_id, state.chats]
  );

  const activeModel = useMemo(
    () => state.models.find((model) => model.id === state.active_model_id) ?? null,
    [state.active_model_id, state.models]
  );

  const downloadMap = useMemo(
    () => Object.fromEntries(state.downloads.map((item) => [item.model_id, item])),
    [state.downloads]
  );

  const totalDownloading = useMemo(
    () => state.downloads.filter((item) => item.status === "starting" || item.status === "downloading").length,
    [state.downloads]
  );

  const filteredChats = useMemo(() => {
    const query = chatFilter.trim().toLowerCase();
    if (!query) {
      return state.chats;
    }
    return state.chats.filter((chat) => chat.title.toLowerCase().includes(query));
  }, [chatFilter, state.chats]);

  const filteredModels = useMemo(() => {
    const query = modelFilter.trim().toLowerCase();
    if (!query) {
      return state.models;
    }
    return state.models.filter(
      (model) =>
        model.title.toLowerCase().includes(query) ||
        model.source.toLowerCase().includes(query) ||
        model.filename.toLowerCase().includes(query)
    );
  }, [modelFilter, state.models]);

  const catalogModels = useMemo(() => {
    const query = catalogFilter.trim().toLowerCase();
    return MODEL_CATALOG.filter((model) => {
      if (!query) {
        return true;
      }
      return [model.title, model.repoId, model.summary, model.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [catalogFilter]);

  const activeDownloadEntries = useMemo(
    () => state.downloads.filter((item) => item.status === "starting" || item.status === "downloading"),
    [state.downloads]
  );

  async function refreshState() {
    const next = await invoke<AppState>("get_app_state");
    setState(next);
    setRuntime(next.runtime);
    setAppReady(true);
  }

  useEffect(() => {
    refreshState().catch((error) => setStatus(String(error)));
  }, []);

  useEffect(() => {
    let mounted = true;
    appWindow.isMaximized().then((value) => {
      if (mounted) {
        setWindowMaximized(value);
      }
    });
    const unlistenPromise = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setWindowMaximized(maximized);
    });

    return () => {
      mounted = false;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [appWindow]);

  useEffect(() => {
    const unlistenNavigate = listen<string>("lmapp://navigate", async (event) => {
      if (event.payload === "chat") {
        setView("chat");
        setSettingsOpen(false);
      }
      if (event.payload === "models") {
        setView("models");
        setSettingsOpen(false);
      }
      if (event.payload === "settings") {
        setSettingsOpen(true);
      }
      await appWindow.show();
      await appWindow.unminimize();
      await appWindow.setFocus();
    });

    const unlistenAction = listen<string>("lmapp://action", async (event) => {
      if (event.payload === "new_chat") {
        await invoke("create_chat", { title: null });
        await refreshState();
        setView("chat");
      }
      if (event.payload === "refresh") {
        await refreshState();
      }
    });

    const unlistenOpenChat = listen<string>("lmapp://open-chat", async (event) => {
      await invoke("set_active_chat", { chatId: event.payload });
      await refreshState();
      setView("chat");
      setSettingsOpen(false);
      await appWindow.show();
      await appWindow.unminimize();
      await appWindow.setFocus();
    });

    const unlistenOpenModel = listen<string>("lmapp://open-model", async (event) => {
      await invoke("set_active_model", { modelId: event.payload });
      await refreshState();
      setView("models");
      setSettingsOpen(false);
      await appWindow.show();
      await appWindow.unminimize();
      await appWindow.setFocus();
    });

    return () => {
      void unlistenNavigate.then((fn) => fn());
      void unlistenAction.then((fn) => fn());
      void unlistenOpenChat.then((fn) => fn());
      void unlistenOpenModel.then((fn) => fn());
    };
  }, [appWindow]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChat?.messages.length, isGenerating]);

  useEffect(() => {
    const currentBytes: Record<string, number> = {};
    const nextSpeeds: Record<string, number> = {};

    state.downloads.forEach((item) => {
      currentBytes[item.model_id] = item.downloaded_bytes;
      const previousBytes = previousDownloadBytesRef.current[item.model_id] ?? item.downloaded_bytes;
      nextSpeeds[item.model_id] = Math.max(0, item.downloaded_bytes - previousBytes);
    });

    previousDownloadBytesRef.current = currentBytes;
    setDownloadSpeeds(nextSpeeds);
  }, [state.downloads]);

  useEffect(() => {
    if (activeDownloadEntries.length === 0) {
      previousDownloadBytesRef.current = {};
      setDownloadSpeeds({});
      return;
    }

    const timer = window.setInterval(() => {
      refreshState().catch(() => undefined);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeDownloadEntries.length]);

  async function withBusy<T>(label: string, run: () => Promise<T>) {
    setBusy(true);
    setStatus(label);
    try {
      const result = await run();
      await refreshState();
      setStatus("Ready");
      return result;
    } catch (error) {
      setStatus(String(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(target: "llama" | "python") {
    const file = await open({
      multiple: false,
      directory: false,
      title: target === "llama" ? "Select llama-server executable" : "Select Python executable"
    });
    if (typeof file !== "string") {
      return;
    }
    setRuntime((current) => ({
      ...current,
      llama_server_path: target === "llama" ? file : current.llama_server_path,
      vllm_python_path: target === "python" ? file : current.vllm_python_path
    }));
  }

  async function pickFolder() {
    const folder = await open({
      multiple: false,
      directory: true,
      title: "Select download folder"
    });
    if (typeof folder !== "string") {
      return;
    }
    setRuntime((current) => ({ ...current, download_dir: folder }));
  }

  async function pickAvatar() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/jpg,image/gif,image/webp";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        pushToast("Image is too large. Please choose a file smaller than 2 MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        setRuntime((current) => ({
          ...current,
          user_profile: { ...current.user_profile, avatar_url: dataUrl }
        }));
      };
      reader.onerror = () => pushToast("Failed to read image file.", "error");
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function saveRuntime() {
    const validationError = validateRuntime(runtime);
    if (validationError) {
      setStatus(validationError);
      pushToast(validationError, "error");
      return false;
    }

    await withBusy("Saving settings...", async () => {
      await invoke("update_runtime_settings", { runtime });
    });
    return true;
  }

  async function autoDownloadLlamaCpp() {
    setDownloadingLlama(true);
    try {
      setStatus("Fetching the latest llama.cpp release...");
      const path = await invoke<string>("download_llama_cpp");
      const nextRuntime = { ...runtime, llama_server_path: path };
      setRuntime(nextRuntime);
      await invoke("update_runtime_settings", { runtime: nextRuntime });
      await refreshState();
      setStatus("llama.cpp installed successfully.");
      pushToast(`llama.cpp installed successfully: ${path}`, "success");
    } catch (error) {
      const message = String(error);
      setStatus(message);
      pushToast(`Failed to download llama.cpp. ${message}`, "error");
    } finally {
      setDownloadingLlama(false);
    }
  }

  async function addCatalogModel(model: CatalogModel) {
    await withBusy("Adding model...", async () => {
      await invoke("add_hf_model", {
        repoId: model.repoId,
        filename: model.filename,
        title: model.title,
        runtimeHint: model.runtimeHint
      });
    });
  }

  async function addPreset(presetId: string) {
    await withBusy("Adding preset...", async () => {
      await invoke("add_model_from_preset", { presetId });
    });
  }

  async function downloadModel(modelId: string) {
    setStatus("Starting download...");
    try {
      await invoke("start_download_model", { modelId });
      await refreshState();
    } catch (error) {
      setStatus(String(error));
    }
  }

  async function startServer() {
    try {
      await withBusy(`Starting ${compactRuntimeName(runtime.runtime_kind)}...`, async () => {
        await invoke("start_model_server");
      });
    } catch (error) {
      if (String(error).includes("llama-server")) {
        pushToast("Configure the llama-server executable in Settings first.", "error");
      }
      throw error;
    }
  }

  async function stopServer() {
    await withBusy("Stopping runtime...", async () => {
      await invoke("stop_model_server");
    });
  }

  async function sendPrompt() {
    if (!prompt.trim()) {
      return;
    }

    const currentPrompt = prompt;
    setPrompt("");
    setIsGenerating(true);

    try {
      await invoke("chat_with_model", { prompt: currentPrompt });
      await refreshState();
      setStatus("Ready");
    } catch (error) {
      setStatus(String(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function createChat() {
    await withBusy("Creating chat...", async () => {
      await invoke("create_chat", { title: null });
    });
  }

  async function setChat(chatId: string) {
    await withBusy("Switching chat...", async () => {
      await invoke("set_active_chat", { chatId });
    });
  }

  async function removeChat(chatId: string) {
    await withBusy("Removing chat...", async () => {
      await invoke("delete_chat", { chatId });
    });
  }

  async function selectModel(modelId: string, targetView: View = view) {
    await invoke("set_active_model", { modelId });
    await refreshState();
    if (targetView !== view) {
      setView(targetView);
    }
  }

  async function minimizeWindow() {
    console.log("Minimize clicked");
    await appWindow.minimize();
  }

  async function toggleWindowMaximize() {
    console.log("Maximize clicked");
    await appWindow.toggleMaximize();
    setWindowMaximized(await appWindow.isMaximized());
  }

  async function closeWindow() {
    console.log("Close clicked");
    await appWindow.hide();
  }

  async function finishOnboarding() {
    await invoke("complete_onboarding");
    await refreshState();
    setOnboardingStep(0);
    pushToast("Workspace is ready. Add a model to get started.", "success");
  }

  async function checkUpdates() {
    setCheckingUpdates(true);
    try {
      const next = await invoke<UpdateInfo>("check_app_updates");
      setUpdateInfo(next);
      pushToast(
        next.update_available
          ? `Update available: ${next.latest_version}`
          : `LmApp ${next.current_version} is up to date.`,
        next.update_available ? "info" : "success"
      );
    } catch (error) {
      pushToast(String(error), "error");
    } finally {
      setCheckingUpdates(false);
    }
  }

  function handleTitlebarMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest("button")) {
      return;
    }
    void appWindow.startDragging();
  }

  function handleTitlebarDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }
    void toggleWindowMaximize();
  }

  const showStartupOverlay =
    !appReady ||
    downloadingLlama ||
    (busy &&
      ["Starting", "Stopping", "Saving", "Creating", "Switching"].some((prefix) =>
        status.startsWith(prefix)
      ));

  return (
    <>
      <div className="window-shell">
        <div className="titlebar" onDoubleClick={handleTitlebarDoubleClick} onMouseDown={handleTitlebarMouseDown}>
          <div className="titlebar-brand">
            <div className={`titlebar-brand-mark ${state.is_server_running ? "online" : ""}`}>
              <img src={logoUrl} alt="LmApp" />
            </div>
            <div className="titlebar-brand-copy">
              <strong>LmApp</strong>
              <span>Local Studio v0.1.0</span>
            </div>
          </div>
          <div className="titlebar-center">
            <span className={`runtime-chip compact ${state.is_server_running ? "online" : ""}`}>{state.server_status}</span>
          </div>
          <div className="titlebar-actions">
            <button className="window-control" onClick={minimizeWindow} type="button" title="Minimize">
              _
            </button>
            <button className="window-control" onClick={toggleWindowMaximize} type="button" title={windowMaximized ? "Restore" : "Maximize"}>
              {windowMaximized ? "[]" : "[ ]"}
            </button>
            <button className="window-control close" onClick={closeWindow} type="button" title="Hide to tray">
              X
            </button>
          </div>
        </div>

        <div className="desktop-shell">
          <aside className="icon-rail">
            <button className={`rail-icon ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")} type="button" title="Chat">
              <ChatGlyph />
            </button>
            <button className={`rail-icon ${view === "models" ? "active" : ""}`} onClick={() => setView("models")} type="button" title="Models">
              <ModelsGlyph />
            </button>
            <button className="rail-icon" onClick={() => setSettingsOpen(true)} type="button" title="Settings">
              <SettingsGlyph />
            </button>
            <div className="rail-spacer" />
            <div className={`rail-led ${state.is_server_running ? "online" : ""}`} />
          </aside>

          <aside className="left-pane">
            {view === "chat" ? (
              <>
                <div className="pane-header">
                  <div>
                    <p className="pane-label">Workspace</p>
                    <h2>Chats</h2>
                  </div>
                  <button className="subtle-button" disabled={busy} onClick={createChat} type="button">
                    New Chat
                  </button>
                </div>
                <input className="search-input" value={chatFilter} onChange={(event) => setChatFilter(event.target.value)} placeholder="Search chats" />
                <div className="hero-card">
                  <p className="pane-label">Active Model</p>
                  <h3>{activeModel?.title ?? "Model not selected"}</h3>
                  <p>{activeModel ? activeModel.source : "Open Models and choose one from the built-in catalog."}</p>
                  <button className="subtle-button" onClick={() => setView("models")} type="button">
                    Open Models
                  </button>
                </div>
                <div className="pane-list">
                  {filteredChats.map((chat) => (
                    <div className={`list-item ${chat.id === state.active_chat_id ? "active" : ""}`} key={chat.id}>
                      <button className="list-item-main" disabled={busy} onClick={() => setChat(chat.id)} type="button">
                        <strong>{chat.title}</strong>
                        <span>{chat.messages.length} messages</span>
                        <span>{formatTime(chat.updated_at)}</span>
                      </button>
                      <button className="mini-button danger" disabled={busy} onClick={() => removeChat(chat.id)} type="button">
                        X
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="pane-header">
                  <div>
                    <p className="pane-label">Library</p>
                    <h2>Models</h2>
                  </div>
                  <button onClick={() => setCatalogOpen(true)} type="button">
                    Browse HF
                  </button>
                </div>
                <input className="search-input" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} placeholder="Filter library" />
                <div className="hero-card">
                  <p className="pane-label">Downloads</p>
                  <h3>{totalDownloading > 0 ? `${totalDownloading} active` : "Idle"}</h3>
                  <p>{totalDownloading > 0 ? "Files are downloading in the background." : "Pick a model from the built-in Hugging Face catalog."}</p>
                  <button className="subtle-button" onClick={() => setCatalogOpen(true)} type="button">
                    Add Model
                  </button>
                </div>
                <div className="pane-list compact">
                  <p className="pane-label">Recommended</p>
                  {state.presets.map((preset) => (
                    <button className="preset-list-item" key={preset.id} onClick={() => addPreset(preset.id)} type="button" disabled={busy}>
                      <strong>{preset.title}</strong>
                      <span>{preset.summary}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>

          <section className="center-pane">
            <div className="center-header">
              <div>
                <p className="pane-label">{view === "chat" ? "Conversation" : "Model Hub"}</p>
                <h3>{view === "chat" ? activeChat?.title ?? "Select a chat" : "Installed Models"}</h3>
              </div>
              <div className="header-tools">
                <span className="runtime-chip">{compactRuntimeName(runtime.runtime_kind)}</span>
                <span className="runtime-chip">{activeModel?.title ?? "No active model"}</span>
              </div>
            </div>
            {view === "chat" ? (
              <div className="chat-layout">
                <div className="chat-topbar">
                  <div className="chat-summary">
                    <strong>{activeModel?.title ?? "No model selected"}</strong>
                    <span>
                      {state.is_server_running
                        ? `${activeModel?.filename || "Model"} loaded and ready`
                        : !runtime.llama_server_path && runtime.runtime_kind === "llama_cpp"
                          ? "Configure llama-server in Settings"
                          : activeModel?.downloaded
                            ? "Click Start to begin"
                            : "Download a model first"}
                    </span>
                  </div>
                  <div className="chat-topbar-actions">
                    <button disabled={busy || state.is_server_running || !activeModel?.downloaded} onClick={startServer} type="button">
                      Start
                    </button>
                    <button className="subtle-button" disabled={busy || !state.is_server_running} onClick={stopServer} type="button">
                      Stop
                    </button>
                  </div>
                </div>

                <div className="chat-scroll">
                  {(activeChat?.messages ?? []).length === 0 && !isGenerating ? (
                    <div className="empty-state">
                      <h3>Chat is ready</h3>
                      <p>Select a model, start the runtime, and send the first message.</p>
                    </div>
                  ) : (
                    <>
                      {(activeChat?.messages ?? []).map((message, index) => (
                        <article className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                          <div className="chat-meta">
                            <span>{message.role === "user" ? runtime.user_profile.username || "You" : activeModel?.title ?? "Assistant"}</span>
                            <span>{index + 1}</span>
                          </div>
                          <p>{message.content}</p>
                        </article>
                      ))}
                      {isGenerating ? (
                        <article className="chat-bubble assistant">
                          <div className="chat-meta">
                            <span>{activeModel?.title ?? "Assistant"}</span>
                            <span>...</span>
                          </div>
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </article>
                      ) : null}
                    </>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <div className="composer-wrap">
                  <div className="composer-status">
                    <span>{status}</span>
                    <span>{state.is_server_running ? "Online" : "Offline"}</span>
                    {!state.is_server_running && activeModel?.downloaded ? <span style={{ color: "var(--warning)" }}>Start the runtime to chat.</span> : null}
                    {!activeModel?.downloaded ? <span style={{ color: "var(--error)" }}>Download a model first.</span> : null}
                  </div>
                  <div className="composer-bar">
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendPrompt();
                        }
                      }}
                      placeholder={
                        isGenerating
                          ? "Waiting for response..."
                          : !state.is_server_running
                            ? "Start the runtime above to begin chatting..."
                            : "Write a message. Enter sends, Shift+Enter adds a new line."
                      }
                      rows={4}
                      disabled={busy || !state.is_server_running || isGenerating}
                    />
                    <div className="composer-actions">
                      <button className="subtle-button" onClick={() => setView("models")} type="button">
                        Models
                      </button>
                      <button disabled={busy || !state.is_server_running || !prompt.trim() || isGenerating} onClick={sendPrompt} type="button">
                        {isGenerating ? "Generating..." : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="models-layout">
                <div className="models-toolbar modern">
                  <div>
                    <p className="pane-label">Actions</p>
                    <h3>Installed library</h3>
                  </div>
                  <div className="header-tools">
                    <button onClick={() => setCatalogOpen(true)} type="button">
                      Browse Hugging Face
                    </button>
                    <button className="subtle-button" onClick={() => setSettingsOpen(true)} type="button">
                      Runtime Settings
                    </button>
                  </div>
                </div>
                {activeDownloadEntries.length > 0 ? (
                  <div className="download-dock">
                    {activeDownloadEntries.map((item) => {
                      const model = state.models.find((entry) => entry.id === item.model_id);
                      const percent = Math.round(item.progress * 100);
                      const speed = downloadSpeeds[item.model_id] || 0;
                      return (
                        <div className="download-card" key={item.model_id}>
                          <div className="download-card-header">
                            <strong>{model?.title ?? item.model_id}</strong>
                            <span className="download-percent">{percent}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="download-card-footer">
                            <span>{bytesLabel(item.downloaded_bytes)}</span>
                            {item.total_bytes ? <span className="download-separator">.</span> : null}
                            {item.total_bytes ? <span>{bytesLabel(item.total_bytes)}</span> : null}
                            {speed > 0 ? <span className="download-separator">.</span> : null}
                            {speed > 0 ? <span className="download-speed">{speedLabel(speed)}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="model-grid">
                  {filteredModels.length === 0 ? (
                    <div className="empty-state large">
                      <h3>Your library is empty</h3>
                      <p>Open the catalog and add a model from the built-in Hugging Face list.</p>
                      <button onClick={() => setCatalogOpen(true)} type="button">
                        Open Catalog
                      </button>
                    </div>
                  ) : (
                    filteredModels.map((model) => {
                      const progress = downloadMap[model.id];
                      const isActive = model.id === state.active_model_id;
                      return (
                        <article className={`model-card ${isActive ? "active" : ""}`} key={model.id}>
                          <div className="model-card-top">
                            <div>
                              <p className="pane-label">{compactRuntimeName(model.runtime_hint)}</p>
                              <h3>{model.title}</h3>
                            </div>
                            {isActive ? <span className="state-badge">Active</span> : null}
                          </div>
                          <p className="model-source">{model.source}</p>
                          <p className="model-file">{model.filename}</p>

                          {progress && progress.status !== "failed" ? (
                            <div className="progress-box">
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
                              </div>
                              <span>
                                {Math.round(progress.progress * 100)}% . {bytesLabel(progress.downloaded_bytes)}
                                {progress.total_bytes ? ` / ${bytesLabel(progress.total_bytes)}` : ""}
                              </span>
                            </div>
                          ) : (
                            <div className="model-state-row">
                              <span className={`state-badge ${model.downloaded ? "success" : "muted"}`}>
                                {model.downloaded ? "Downloaded" : "Not downloaded"}
                              </span>
                            </div>
                          )}

                          {progress?.status === "failed" ? (
                            <p className="model-file" style={{ color: "var(--error)" }}>
                              {progress.error ?? "Download failed."}
                            </p>
                          ) : null}

                          <div className="model-card-actions">
                            <button className="subtle-button" disabled={busy} onClick={() => selectModel(model.id)} type="button">
                              Use
                            </button>
                            <button
                              disabled={busy || model.downloaded || progress?.status === "downloading" || progress?.status === "starting"}
                              onClick={() => downloadModel(model.id)}
                              type="button"
                            >
                              {progress?.status === "failed" ? "Retry" : progress ? "Downloading..." : model.downloaded ? "Ready" : "Download"}
                            </button>
                            <button className="subtle-button" disabled={busy || !model.downloaded} onClick={() => selectModel(model.id, "chat")} type="button">
                              Chat
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="right-pane">
            {view === "chat" ? (
              <>
                <div className="inspector-card accent">
                  <p className="pane-label">Runtime</p>
                  <h3>{compactRuntimeName(runtime.runtime_kind)}</h3>
                  <div className="info-list">
                    <div>
                      <span>Endpoint</span>
                      <strong>{runtime.server_base_url}</strong>
                    </div>
                    <div>
                      <span>Server</span>
                      <strong>{state.server_status}</strong>
                    </div>
                    <div>
                      <span>Downloads</span>
                      <strong>{totalDownloading}</strong>
                    </div>
                  </div>
                </div>
                <div className="inspector-card">
                  <p className="pane-label">Session</p>
                  <h3>{activeChat?.title ?? "No chat"}</h3>
                  <div className="info-list">
                    <div>
                      <span>Messages</span>
                      <strong>{activeChat?.messages.length ?? 0}</strong>
                    </div>
                    <div>
                      <span>Model</span>
                      <strong>{activeModel?.filename ?? "None"}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{activeChat ? formatTime(activeChat.updated_at) : "-"}</strong>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="inspector-card accent">
                  <p className="pane-label">Selected</p>
                  <h3>{activeModel?.title ?? "No model selected"}</h3>
                  <div className="info-list">
                    <div>
                      <span>Runtime</span>
                      <strong>{activeModel ? compactRuntimeName(activeModel.runtime_hint) : "-"}</strong>
                    </div>
                    <div>
                      <span>Source</span>
                      <strong>{activeModel?.source ?? "-"}</strong>
                    </div>
                    <div>
                      <span>Path</span>
                      <strong>{activeModel?.local_path ?? "-"}</strong>
                    </div>
                  </div>
                </div>
                <div className="inspector-card">
                  <p className="pane-label">Quick flow</p>
                  <h3>Next steps</h3>
                  <div className="info-list">
                    <div>
                      <span>1</span>
                      <strong>Add a model from the catalog</strong>
                    </div>
                    <div>
                      <span>2</span>
                      <strong>Download it into your local library</strong>
                    </div>
                    <div>
                      <span>3</span>
                      <strong>Choose Use, then switch to Chat</strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {catalogOpen ? (
        <CatalogModal
          busy={busy}
          catalogFilter={catalogFilter}
          catalogModels={catalogModels}
          models={state.models}
          onAddCatalogModel={addCatalogModel}
          onClose={() => setCatalogOpen(false)}
          onFilterChange={setCatalogFilter}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          busy={busy}
          checkingUpdates={checkingUpdates}
          downloadingLlama={downloadingLlama}
          onAutoDownloadLlama={autoDownloadLlamaCpp}
          onCheckUpdates={checkUpdates}
          onClose={() => setSettingsOpen(false)}
          onEditProfile={() => setEditingProfile(true)}
          onPickFile={pickFile}
          onPickFolder={pickFolder}
          onRuntimeChange={setRuntime}
          onSave={async () => {
            await saveRuntime();
          }}
          onSectionChange={setSettingsSection}
          runtime={runtime}
          settingsSection={settingsSection}
          status={status}
          updateInfo={updateInfo}
        />
      ) : null}

      {editingProfile ? (
        <ProfileModal
          busy={busy}
          onClose={() => setEditingProfile(false)}
          onPickAvatar={pickAvatar}
          onRuntimeChange={setRuntime}
          onSave={async () => {
            await saveRuntime();
          }}
          runtime={runtime}
        />
      ) : null}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} key={toast.id}>
            <span className="toast-dot" />
            <p>{toast.message}</p>
          </div>
        ))}
      </div>

      {!state.onboarding_completed && appReady ? (
        <div className="app-splash onboarding-shell">
          <div className="app-splash-card onboarding-card">
            <div className="onboarding-progress">
              <span className={onboardingStep >= 0 ? "active" : ""} />
              <span className={onboardingStep >= 1 ? "active" : ""} />
              <span className={onboardingStep >= 2 ? "active" : ""} />
            </div>
            {onboardingStep === 0 ? (
              <>
                <div className="app-splash-mark">
                  <img src={logoUrl} alt="LmApp" />
                </div>
                <h2>Welcome to LmApp</h2>
                <p>Set up a local AI workspace with saved chats, downloadable models, and a built-in runtime controller.</p>
                <div className="onboarding-actions">
                  <button onClick={() => setOnboardingStep(1)} type="button">
                    Continue
                  </button>
                </div>
              </>
            ) : null}
            {onboardingStep === 1 ? (
              <>
                <h2>Choose your workflow</h2>
                <p>Use `llama.cpp` for CPU and GGUF models, or `vLLM` for larger GPU-oriented deployments.</p>
                <div className="onboarding-grid">
                  <button className="onboarding-option" onClick={() => setRuntime((current) => ({ ...current, runtime_kind: "llama_cpp" }))} type="button">
                    <strong>llama.cpp</strong>
                    <span>Best for local GGUF models and quick setup.</span>
                  </button>
                  <button className="onboarding-option" onClick={() => setRuntime((current) => ({ ...current, runtime_kind: "vllm" }))} type="button">
                    <strong>vLLM</strong>
                    <span>Best for transformer weights and heavier GPU runtimes.</span>
                  </button>
                </div>
                <div className="onboarding-actions">
                  <button className="subtle-button" onClick={() => setOnboardingStep(0)} type="button">
                    Back
                  </button>
                  <button onClick={() => setOnboardingStep(2)} type="button">
                    Next
                  </button>
                </div>
              </>
            ) : null}
            {onboardingStep === 2 ? (
              <>
                <h2>Suggested first steps</h2>
                <div className="onboarding-health">
                  <div className={`onboarding-health-card ${runtime.runtime_kind === "llama_cpp" ? (runtime.llama_server_path ? "ready" : "pending") : (runtime.vllm_python_path && runtime.vllm_model_path ? "ready" : "pending")}`}>
                    <strong>Runtime binary</strong>
                    <span>
                      {runtime.runtime_kind === "llama_cpp"
                        ? runtime.llama_server_path
                          ? "Ready"
                          : "llama.cpp not configured"
                        : runtime.vllm_python_path && runtime.vllm_model_path
                          ? "Ready"
                          : "vLLM paths missing"}
                    </span>
                  </div>
                  <div className={`onboarding-health-card ${runtime.download_dir.trim() ? "ready" : "pending"}`}>
                    <strong>Download directory</strong>
                    <span>{runtime.download_dir.trim() ? "Ready" : "Not configured"}</span>
                  </div>
                  <div className={`onboarding-health-card ${state.models.length > 0 ? "ready" : "pending"}`}>
                    <strong>Model library</strong>
                    <span>{state.models.length > 0 ? `${state.models.length} model(s) added` : "No models added yet"}</span>
                  </div>
                </div>
                <div className="onboarding-list">
                  <div>
                    <strong>1. Open Models</strong>
                    <span>Add a preset or browse the built-in Hugging Face catalog.</span>
                  </div>
                  <div>
                    <strong>2. Configure runtime</strong>
                    <span>Download `llama.cpp` automatically or point to your existing runtime binaries.</span>
                  </div>
                  <div>
                    <strong>3. Start chatting</strong>
                    <span>Pick a model, start the server, and your chats will persist locally.</span>
                  </div>
                </div>
                <div className="onboarding-actions">
                  <button className="subtle-button" onClick={() => setOnboardingStep(1)} type="button">
                    Back
                  </button>
                  <button
                    className="subtle-button"
                    onClick={async () => {
                      await finishOnboarding();
                    }}
                    type="button"
                  >
                    Finish later
                  </button>
                  <button
                    onClick={async () => {
                      if (await saveRuntime()) {
                        await finishOnboarding();
                      }
                    }}
                    type="button"
                  >
                    Enter Workspace
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {showStartupOverlay ? (
        <div className="app-splash">
          <div className="app-splash-card">
            <div className="app-splash-mark" />
            <h2>{!appReady ? "Preparing workspace" : status}</h2>
            <p>
              {!appReady
                ? "Restoring chats, models, and runtime settings."
                : downloadingLlama
                  ? "Downloading the latest llama.cpp build and wiring it into your runtime."
                  : "Working on the requested desktop action."}
            </p>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
