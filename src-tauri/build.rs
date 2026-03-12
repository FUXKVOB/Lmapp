fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "get_app_state",
                "add_hf_model",
                "add_model_from_preset",
                "set_active_model",
                "update_runtime_settings",
                "create_chat",
                "set_active_chat",
                "delete_chat",
                "start_download_model",
                "start_model_server",
                "stop_model_server",
                "chat_with_model",
                "download_llama_cpp",
                "complete_onboarding",
                "check_app_updates",
                "search_hf_models",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
