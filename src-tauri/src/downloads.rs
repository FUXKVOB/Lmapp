use crate::state::SharedState;
use crate::types::DownloadStatus;
use futures_util::StreamExt;
use std::{fs, path::Path};

fn set_download_status(shared: &SharedState, model_id: &str, status: DownloadStatus) {
    shared
        .downloads
        .lock()
        .unwrap()
        .insert(model_id.to_string(), status);
}

pub async fn download_model_inner(shared: &SharedState, model_id: String) -> Result<(), String> {
    let model = {
        let app_state = shared.app_state.lock().unwrap();
        app_state
            .models
            .iter()
            .find(|item| item.id == model_id)
            .cloned()
            .ok_or_else(|| "Model not found".to_string())?
    };

    set_download_status(
        shared,
        &model_id,
        DownloadStatus {
            model_id: model_id.clone(),
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: None,
            status: "starting".into(),
            error: None,
        },
    );

    let result = async {
        let url = format!(
            "https://huggingface.co/{}/resolve/main/{}?download=true",
            model.source, model.filename
        );

        let mut request = shared.client.get(url);
        let token = {
            let app_state = shared.app_state.lock().unwrap();
            app_state.runtime.huggingface_token.clone()
        };
        if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?;

        let total_bytes = response.content_length();
        if let Some(parent) = Path::new(&model.local_path).parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let mut file = tokio::fs::File::create(&model.local_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut stream = response.bytes_stream();
        let mut downloaded_bytes = 0u64;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| error.to_string())?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|error| error.to_string())?;
            downloaded_bytes += chunk.len() as u64;

            let progress = total_bytes
                .map(|total| downloaded_bytes as f64 / total as f64)
                .unwrap_or(0.0);

            set_download_status(
                shared,
                &model_id,
                DownloadStatus {
                    model_id: model_id.clone(),
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    status: "downloading".into(),
                    error: None,
                },
            );
        }

        tokio::io::AsyncWriteExt::flush(&mut file)
            .await
            .map_err(|error| error.to_string())?;

        {
            let mut app_state = shared.app_state.lock().unwrap();
            if let Some(existing) = app_state.models.iter_mut().find(|item| item.id == model_id) {
                existing.downloaded = true;
            }
        }

        shared.downloads.lock().unwrap().remove(&model_id);
        shared.save().map_err(|error| error.to_string())
    }
    .await;

    if let Err(error) = &result {
        set_download_status(
            shared,
            &model_id,
            DownloadStatus {
                model_id: model_id.clone(),
                progress: 0.0,
                downloaded_bytes: 0,
                total_bytes: None,
                status: "failed".into(),
                error: Some(error.clone()),
            },
        );
    }

    result
}
