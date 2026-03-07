#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod downloads;
mod runtime;
mod state;
mod types;

use anyhow::anyhow;
use serde_json::{json, Value};
use std::{fs, path::Path};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::{Manager, State};

use crate::downloads::download_model_inner;
use crate::runtime::{
    app_dir, check_for_updates, download_llama_cpp_inner, spawn_llama, spawn_vllm,
    wait_until_server_ready,
};
use crate::state::{active_chat_mut, active_model, slug_title, to_public_state, SharedState};
use crate::types::{
    default_presets, now_ts, AppStateDto, ChatMessage, RuntimeKind, RuntimeSettings, UpdateInfo,
};

#[tauri::command]
fn get_app_state(state: State<'_, SharedState>) -> Result<AppStateDto, String> {
    Ok(to_public_state(&state))
}

#[tauri::command]
fn add_hf_model(
    state: State<'_, SharedState>,
    repo_id: String,
    filename: String,
    title: Option<String>,
    runtime_hint: Option<RuntimeKind>,
) -> Result<(), String> {
    let mut app_state = state.app_state.lock().unwrap();
    let id = format!("{}:{}", repo_id, filename);
    if app_state.models.iter().any(|model| model.id == id) {
        return Ok(());
    }
    let safe_name = filename.replace(['/', '\\', ':'], "_");
    let local_path = Path::new(&app_state.runtime.download_dir)
        .join(safe_name)
        .to_string_lossy()
        .to_string();
    app_state.models.push(crate::types::ModelRecord {
        id: id.clone(),
        title: title.unwrap_or_else(|| slug_title(&repo_id, &filename)),
        source: repo_id,
        filename,
        local_path,
        downloaded: false,
        runtime_hint: runtime_hint.unwrap_or(RuntimeKind::LlamaCpp),
    });
    if app_state.active_model_id.is_none() {
        app_state.active_model_id = Some(id);
    }
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn add_model_from_preset(state: State<'_, SharedState>, preset_id: String) -> Result<(), String> {
    let preset = default_presets()
        .into_iter()
        .find(|item| item.id == preset_id)
        .ok_or_else(|| "Preset not found".to_string())?;
    add_hf_model(
        state,
        preset.repo_id,
        preset.filename,
        Some(preset.title),
        Some(preset.runtime_hint),
    )
}

#[tauri::command]
fn set_active_model(state: State<'_, SharedState>, model_id: String) -> Result<(), String> {
    let mut app_state = state.app_state.lock().unwrap();
    if app_state.models.iter().any(|item| item.id == model_id) {
        app_state.active_model_id = Some(model_id);
    }
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn update_runtime_settings(
    state: State<'_, SharedState>,
    runtime: RuntimeSettings,
) -> Result<(), String> {
    if runtime.server_base_url.trim().is_empty() {
        return Err("Server URL is required".to_string());
    }
    fs::create_dir_all(&runtime.download_dir).map_err(|error| error.to_string())?;
    let mut app_state = state.app_state.lock().unwrap();
    app_state.runtime = runtime;
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn create_chat(state: State<'_, SharedState>, title: Option<String>) -> Result<(), String> {
    let now = now_ts();
    let unique_id = format!("chat-{now}-{}", uuid::Uuid::new_v4().simple());
    let chat = crate::types::ChatSession {
        id: unique_id.clone(),
        title: title.unwrap_or_else(|| "New chat".into()),
        created_at: now,
        updated_at: now,
        messages: Vec::new(),
    };
    let mut app_state = state.app_state.lock().unwrap();
    app_state.active_chat_id = Some(unique_id);
    app_state.chats.insert(0, chat);
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_active_chat(state: State<'_, SharedState>, chat_id: String) -> Result<(), String> {
    let mut app_state = state.app_state.lock().unwrap();
    if app_state.chats.iter().any(|chat| chat.id == chat_id) {
        app_state.active_chat_id = Some(chat_id);
    }
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_chat(state: State<'_, SharedState>, chat_id: String) -> Result<(), String> {
    let mut app_state = state.app_state.lock().unwrap();
    app_state.chats.retain(|chat| chat.id != chat_id);
    if app_state.chats.is_empty() {
        drop(app_state);
        create_chat(state, Some("New chat".into()))?;
        return Ok(());
    }
    if app_state.active_chat_id.as_deref() == Some(chat_id.as_str()) {
        app_state.active_chat_id = app_state.chats.first().map(|chat| chat.id.clone());
    }
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
fn complete_onboarding(state: State<'_, SharedState>) -> Result<(), String> {
    let mut app_state = state.app_state.lock().unwrap();
    app_state.onboarding_completed = true;
    drop(app_state);
    state.save().map_err(|error| error.to_string())
}

#[tauri::command]
async fn start_download_model(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    {
        let state = app.state::<SharedState>();
        let downloads = state.downloads.lock().unwrap();
        if downloads
            .get(&model_id)
            .map(|item| item.status == "starting" || item.status == "downloading")
            .unwrap_or(false)
        {
            return Ok(());
        }
    }

    tauri::async_runtime::spawn(async move {
        let state = app.state::<SharedState>();
        let _ = download_model_inner(&state, model_id).await;
    });
    Ok(())
}

#[tauri::command]
async fn start_model_server(state: State<'_, SharedState>) -> Result<(), String> {
    start_model_server_inner(&state).await
}

async fn start_model_server_inner(state: &SharedState) -> Result<(), String> {
    if state.server.process.lock().unwrap().is_some() {
        return Ok(());
    }

    let app_state = state.app_state.lock().unwrap().clone();
    let child = match app_state.runtime.runtime_kind {
        RuntimeKind::LlamaCpp => {
            let model = active_model(&app_state)?;
            if !model.downloaded {
                return Err("Selected model is not downloaded".to_string());
            }
            spawn_llama(&app_state.runtime, &model)?
        }
        RuntimeKind::Vllm => spawn_vllm(&app_state.runtime)?,
    };

    *state.server.process.lock().unwrap() = Some(child);
    *state.server.status.lock().unwrap() = "loading".into();

    match wait_until_server_ready(&state.client, &app_state.runtime.server_base_url).await {
        Ok(_) => {
            *state.server.status.lock().unwrap() = "ready".into();
            Ok(())
        }
        Err(error) => {
            if let Some(mut child) = state.server.process.lock().unwrap().take() {
                let _ = child.kill();
            }
            *state.server.status.lock().unwrap() = format!("error: {error}");
            Err(error)
        }
    }
}

#[tauri::command]
fn stop_model_server(state: State<'_, SharedState>) -> Result<(), String> {
    stop_model_server_inner(&state)
}

fn stop_model_server_inner(state: &SharedState) -> Result<(), String> {
    if let Some(mut child) = state.server.process.lock().unwrap().take() {
        child.kill().map_err(|error| error.to_string())?;
    }
    *state.server.status.lock().unwrap() = "stopped".into();
    Ok(())
}

#[tauri::command]
async fn chat_with_model(state: State<'_, SharedState>, prompt: String) -> Result<String, String> {
    let runtime = {
        let mut app_state = state.app_state.lock().unwrap();
        let chat = active_chat_mut(&mut app_state)?;
        chat.messages.push(ChatMessage {
            role: "user".into(),
            content: prompt.clone(),
        });
        chat.updated_at = now_ts();
        if chat.title == "New chat" && !prompt.trim().is_empty() {
            chat.title = prompt.chars().take(32).collect();
        }
        app_state.runtime.clone()
    };
    state.save().map_err(|error| error.to_string())?;

    let messages = {
        let app_state = state.app_state.lock().unwrap();
        let chat_id = app_state
            .active_chat_id
            .clone()
            .ok_or_else(|| "No active chat selected".to_string())?;
        let chat_messages = app_state
            .chats
            .iter()
            .find(|chat| chat.id == chat_id)
            .map(|chat| chat.messages.clone())
            .ok_or_else(|| "Chat not found".to_string())?;
        let system_prompt = app_state
            .runtime
            .system_prompt
            .clone()
            .unwrap_or_else(|| crate::types::DEFAULT_SYSTEM_PROMPT.into());
        let mut all_messages = vec![ChatMessage {
            role: "system".into(),
            content: system_prompt,
        }];
        all_messages.extend(chat_messages);
        all_messages
    };

    let response = state
        .client
        .post(format!("{}/v1/chat/completions", runtime.server_base_url))
        .json(&json!({
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 512
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;

    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    let answer = body["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "Malformed model response".to_string())?;

    let mut app_state = state.app_state.lock().unwrap();
    let chat = active_chat_mut(&mut app_state)?;
    chat.messages.push(ChatMessage {
        role: "assistant".into(),
        content: answer.clone(),
    });
    chat.updated_at = now_ts();
    drop(app_state);
    state.save().map_err(|error| error.to_string())?;
    Ok(answer)
}

#[tauri::command]
async fn download_llama_cpp(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_dir(&app).map_err(|e| e.to_string())?;
    let state = app.state::<SharedState>();
    download_llama_cpp_inner(&state, &app_dir).await
}

#[tauri::command]
async fn check_app_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let state = app.state::<SharedState>();
    let version = app.package_info().version.to_string();
    check_for_updates(&state.client, &version).await
}

fn main() {
    let menu = |app: &tauri::App| -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
        let new_chat = MenuItemBuilder::with_id("new_chat", "New Chat")
            .accelerator("CmdOrCtrl+N")
            .build(app)?;
        let chat = MenuItemBuilder::with_id("open_chat", "Chat").build(app)?;
        let models = MenuItemBuilder::with_id("open_models", "Models").build(app)?;
        let current_chat =
            MenuItemBuilder::with_id("open_current_chat", "Open Current Chat").build(app)?;
        let current_model =
            MenuItemBuilder::with_id("open_current_model", "Open Current Model").build(app)?;
        let settings = MenuItemBuilder::with_id("open_settings", "Settings")
            .accelerator("CmdOrCtrl+,")
            .build(app)?;
        let quit = MenuItemBuilder::with_id("quit", "Quit")
            .accelerator("Alt+F4")
            .build(app)?;

        let app_menu = SubmenuBuilder::new(app, "LmApp")
            .item(&new_chat)
            .item(&chat)
            .item(&models)
            .item(&current_chat)
            .item(&current_model)
            .item(&settings)
            .separator()
            .item(&quit)
            .build()?;

        let minimize = MenuItemBuilder::with_id("minimize", "Minimize").build(app)?;
        let maximize = MenuItemBuilder::with_id("maximize", "Toggle Maximize").build(app)?;
        let window_menu = SubmenuBuilder::new(app, "Window")
            .item(&minimize)
            .item(&maximize)
            .build()?;

        MenuBuilder::new(app)
            .item(&app_menu)
            .item(&window_menu)
            .build()
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            let app_dir = app_dir(app.handle())?;
            let state = SharedState::load(&app_dir).map_err(|error| anyhow!("{error}"))?;
            app.manage(state);
            app.set_menu(menu(app)?)?;

            let tray_menu = MenuBuilder::new(app)
                .text("show", "Show")
                .text("hide", "Hide")
                .separator()
                .text("tray_chat", "Open Chat")
                .text("tray_models", "Open Models")
                .text("tray_current_chat", "Open Current Chat")
                .text("tray_current_model", "Open Current Model")
                .text("tray_settings", "Open Settings")
                .text("tray_new_chat", "New Chat")
                .separator()
                .text("tray_start_runtime", "Start Runtime")
                .text("tray_stop_runtime", "Stop Runtime")
                .separator()
                .text("quit", "Quit")
                .build()?;

            TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .ok_or_else(|| anyhow!("default window icon is missing"))?,
                )
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "tray_chat" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = app.emit("lmapp://navigate", "chat");
                        }
                    }
                    "tray_models" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = app.emit("lmapp://navigate", "models");
                        }
                    }
                    "tray_settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = app.emit("lmapp://navigate", "settings");
                        }
                    }
                    "tray_current_chat" => {
                        let state = app.state::<SharedState>();
                        let chat_id = {
                            let app_state = state.app_state.lock().unwrap();
                            app_state.active_chat_id.clone()
                        };
                        if let Some(chat_id) = chat_id {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = app.emit("lmapp://open-chat", chat_id);
                            }
                        }
                    }
                    "tray_current_model" => {
                        let state = app.state::<SharedState>();
                        let model_id = {
                            let app_state = state.app_state.lock().unwrap();
                            app_state.active_model_id.clone()
                        };
                        if let Some(model_id) = model_id {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = app.emit("lmapp://open-model", model_id);
                            }
                        }
                    }
                    "tray_new_chat" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = app.emit("lmapp://action", "new_chat");
                        }
                    }
                    "tray_start_runtime" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<SharedState>();
                            let _ = start_model_server_inner(&state).await;
                            let _ = app_handle.emit("lmapp://action", "refresh");
                        });
                    }
                    "tray_stop_runtime" => {
                        let state = app.state::<SharedState>();
                        let _ = stop_model_server_inner(&state);
                        let _ = app.emit("lmapp://action", "refresh");
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let visible = window.is_visible().unwrap_or(true);
                            if visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "new_chat" => {
                let _ = app.emit("lmapp://action", "new_chat");
            }
            "open_chat" => {
                let _ = app.emit("lmapp://navigate", "chat");
            }
            "open_models" => {
                let _ = app.emit("lmapp://navigate", "models");
            }
            "open_current_chat" => {
                let state = app.state::<SharedState>();
                let chat_id = {
                    let app_state = state.app_state.lock().unwrap();
                    app_state.active_chat_id.clone()
                };
                if let Some(chat_id) = chat_id {
                    let _ = app.emit("lmapp://open-chat", chat_id);
                }
            }
            "open_current_model" => {
                let state = app.state::<SharedState>();
                let model_id = {
                    let app_state = state.app_state.lock().unwrap();
                    app_state.active_model_id.clone()
                };
                if let Some(model_id) = model_id {
                    let _ = app.emit("lmapp://open-model", model_id);
                }
            }
            "open_settings" => {
                let _ = app.emit("lmapp://navigate", "settings");
            }
            "minimize" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
            "maximize" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_maximized().unwrap_or(false) {
                        let _ = window.unmaximize();
                    } else {
                        let _ = window.maximize();
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            add_hf_model,
            add_model_from_preset,
            set_active_model,
            update_runtime_settings,
            create_chat,
            set_active_chat,
            delete_chat,
            start_download_model,
            start_model_server,
            stop_model_server,
            chat_with_model,
            download_llama_cpp,
            complete_onboarding,
            check_app_updates
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
