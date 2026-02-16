use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use reqwest::multipart::{Form, Part};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_machine_uid::MachineUidExt;

/// Returns true if running in dev mode (API_ACCESS_KEY set, no real backend).
fn is_dev_mode() -> bool {
    env::var("API_ACCESS_KEY")
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
}

fn get_app_endpoint() -> Result<String, String> {
    if let Ok(endpoint) = env::var("APP_ENDPOINT") {
        let trimmed = endpoint.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    if let Some(endpoint) = option_env!("APP_ENDPOINT") {
        let trimmed = endpoint.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    // Dev mode: API key set but no backend URL — return placeholder so callers don't error.
    // Commands that need a real server short-circuit and return defaults when is_dev_mode().
    if is_dev_mode() {
        return Ok("https://dev-placeholder.invalid".to_string());
    }

    Err("APP_ENDPOINT environment variable not set. Please ensure it's set during the build process.".to_string())
}

fn get_api_access_key() -> Result<String, String> {
    if let Ok(key) = env::var("API_ACCESS_KEY") {
        return Ok(key.trim().to_string());
    }

    match option_env!("API_ACCESS_KEY") {
        Some(key) => Ok(key.trim().to_string()),
        None => Err("API_ACCESS_KEY environment variable not set. Please ensure it's set during the build process.".to_string())
    }
}

// Secure storage functions
fn get_secure_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("secure_storage.json"))
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct SecureStorage {
    license_key: Option<String>,
    instance_id: Option<String>,
    selected_cloak_model: Option<String>,
}

pub async fn get_stored_credentials(
    app: &AppHandle,
) -> Result<(String, String, Option<Model>), String> {
    let storage_path = get_secure_storage_path(app)?;

    if !storage_path.exists() {
        return Err("No license found. Please activate your license first.".to_string());
    }

    let content = fs::read_to_string(&storage_path)
        .map_err(|e| format!("Failed to read storage file: {}", e))?;

    let storage: SecureStorage = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse storage file: {}", e))?;

    let license_key = storage
        .license_key
        .ok_or("License key not found".to_string())?;
    let instance_id = storage
        .instance_id
        .ok_or("Instance ID not found".to_string())?;

    let selected_model: Option<Model> = storage
        .selected_cloak_model
        .and_then(|json_str| serde_json::from_str(&json_str).ok());

    Ok((license_key, instance_id, selected_model))
}

// Audio API Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct AudioResponse {
    success: bool,
    transcription: Option<String>,
    error: Option<String>,
}

// Chat API Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    user_message: String,
    system_prompt: Option<String>,
    image_base64: Option<serde_json::Value>, // Can be string or array
    history: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    success: bool,
    message: Option<String>,
    error: Option<String>,
}

// Model API Structs
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Model {
    provider: String,
    name: String,
    id: String,
    model: String,
    description: String,
    modality: String,
    #[serde(rename = "isAvailable")]
    is_available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelsResponse {
    models: Vec<Model>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPromptResponse {
    prompt_name: String,
    system_prompt: String,
}

// Cloak Prompts API
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloakPrompt {
    title: String,
    prompt: String,
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "modelName")]
    model_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloakPromptsResponse {
    prompts: Vec<CloakPrompt>,
    total: i32,
    #[serde(rename = "last_updated")]
    last_updated: Option<String>,
}

// API Response Configuration Structs
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponseConfig {
    url: String,
    user_token: String,
    model: String,
    body: String,
    customer_id: Option<i64>,
    customer_email: Option<String>,
    customer_name: Option<String>,
    license_key: String,
    instance_id: String,
    #[serde(rename = "user_audio")]
    user_audio: Option<UserAudioConfig>,
    errors: Option<Vec<ApiConfigError>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiConfigError {
    includes: String,
    error: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAudioHeader {
    key: String,
    value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAudioConfig {
    url: String,
    #[serde(rename = "fallback_url")]
    fallback_url: Option<String>,
    model: String,
    #[serde(rename = "fallback_model")]
    fallback_model: Option<String>,
    #[serde(rename = "user_token")]
    user_token: String,
    #[serde(rename = "fallback_user_token")]
    fallback_user_token: Option<String>,
    headers: Option<Vec<UserAudioHeader>>,
}

// Helper to get API config with local fallback if Cloak API fails or in dev mode
async fn get_api_config_with_fallback(
    app: &AppHandle,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ApiResponseConfig, String> {
    match fetch_api_response_config(app, provider.clone(), model.clone()).await {
        Ok(config) => Ok(config),
        Err(e) => {
            let api_access_key = get_api_access_key().unwrap_or_default();
            let default_model = model.unwrap_or_else(|| "gpt-4o".to_string());

            if is_dev_mode() {
                let provider_ref = provider.as_deref().unwrap_or("OpenAI");
                if provider_ref == "Google" {
                    if let Ok(key) = env::var("GOOGLE_API_KEY").or_else(|_| option_env!("GOOGLE_API_KEY").map(String::from).ok_or(())) {
                        let key = key.trim().to_string();
                        if !key.is_empty() {
                            let chat_model = if default_model.starts_with("models/") {
                                default_model.trim_start_matches("models/").to_string()
                            } else {
                                default_model
                            };
                            return Ok(ApiResponseConfig {
                                url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions".to_string(),
                                user_token: key.clone(),
                                model: chat_model,
                                body: "".to_string(),
                                customer_id: None,
                                customer_email: None,
                                customer_name: None,
                                license_key: "".to_string(),
                                instance_id: "".to_string(),
                                user_audio: None,
                                errors: None,
                            });
                        }
                    }
                } else if provider_ref == "Anthropic" {
                    if let Ok(key) = env::var("ANTHROPIC_API_KEY").or_else(|_| option_env!("ANTHROPIC_API_KEY").map(String::from).ok_or(())) {
                        let key = key.trim().to_string();
                        if !key.is_empty() {
                            return Ok(ApiResponseConfig {
                                url: "https://api.anthropic.com/v1/messages".to_string(),
                                user_token: key,
                                model: default_model,
                                body: r#"{"max_tokens":8192}"#.to_string(),
                                customer_id: None,
                                customer_email: None,
                                customer_name: None,
                                license_key: "".to_string(),
                                instance_id: "".to_string(),
                                user_audio: None,
                                errors: None,
                            });
                        }
                    }
                }
                // OpenAI (or fallback)
                let token = env::var("OPENAI_API_KEY")
                    .ok()
                    .or_else(|| option_env!("OPENAI_API_KEY").map(String::from))
                    .and_then(|k| {
                        let t = k.trim();
                        if t.is_empty() { None } else { Some(t.to_string()) }
                    })
                    .or_else(|| {
                        if api_access_key.starts_with("sk-") {
                            Some(api_access_key.clone())
                        } else {
                            None
                        }
                    });
                if let Some(user_token) = token {
                    println!("Dev mode: using local OpenAI config for AI response.");
                    return Ok(ApiResponseConfig {
                        url: "https://api.openai.com/v1/chat/completions".to_string(),
                        user_token: user_token.clone(),
                        model: default_model,
                        body: "".to_string(),
                        customer_id: None,
                        customer_email: None,
                        customer_name: None,
                        license_key: "".to_string(),
                        instance_id: "".to_string(),
                        user_audio: Some(UserAudioConfig {
                            url: "https://api.openai.com/v1/audio/transcriptions".to_string(),
                            fallback_url: None,
                            model: "whisper-1".to_string(),
                            fallback_model: None,
                            user_token,
                            fallback_user_token: None,
                            headers: None,
                        }),
                        errors: None,
                    });
                }
            } else {
                if api_access_key.starts_with("sk-") {
                    println!("Local .env fallback triggered for AI response.");
                    return Ok(ApiResponseConfig {
                        url: "https://api.openai.com/v1/chat/completions".to_string(),
                        user_token: api_access_key.clone(),
                        model: default_model,
                        body: "".to_string(),
                        customer_id: None,
                        customer_email: None,
                        customer_name: None,
                        license_key: "".to_string(),
                        instance_id: "".to_string(),
                        user_audio: Some(UserAudioConfig {
                            url: "https://api.openai.com/v1/audio/transcriptions".to_string(),
                            fallback_url: None,
                            model: "whisper-1".to_string(),
                            fallback_model: None,
                            user_token: api_access_key,
                            fallback_user_token: None,
                            headers: None,
                        }),
                        errors: None,
                    });
                }
            }

            Err(format!("Cloak API unavailable and no local key found: {}", e))
        }
    }
}

// Audio API Command
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_base64: String,
) -> Result<AudioResponse, String> {
    let (provider, model) = if is_dev_mode() {
        (None, None)
    } else {
        let (_, _, selected_model) = get_stored_credentials(&app).await?;
        (
            selected_model.as_ref().map(|m| m.provider.clone()),
            selected_model.as_ref().map(|m| m.model.clone()),
        )
    };

    let api_config = get_api_config_with_fallback(&app, provider.clone(), model.clone()).await?;

    let user_audio_config = api_config.user_audio.as_ref().ok_or_else(|| {
        "Audio transcription is not configured for this workspace.".to_string()
    })?;

    let audio_bytes = decode_audio_base64(&audio_base64)?;
    let client = reqwest::Client::new();
    let error_provider = provider.clone();
    let error_model = model.clone();
    match perform_user_audio_transcription(
        &client,
        &user_audio_config.url,
        &user_audio_config.user_token,
        &user_audio_config.model,
        user_audio_config.headers.as_ref(),
        &audio_bytes,
    )
    .await
    {
        Ok(transcription) => Ok(AudioResponse {
            success: true,
            transcription: Some(transcription),
            error: None,
        }),
        Err(primary_error) => {
            let fallback_error_message = if let (Some(fallback_url), Some(fallback_token)) = (
                user_audio_config.fallback_url.as_ref(),
                user_audio_config.fallback_user_token.as_ref(),
            ) {
                let fallback_model = user_audio_config
                    .fallback_model
                    .as_ref()
                    .unwrap_or(&user_audio_config.model);

                match perform_user_audio_transcription(
                    &client,
                    fallback_url,
                    fallback_token,
                    fallback_model,
                    user_audio_config.headers.as_ref(),
                    &audio_bytes,
                )
                .await
                {
                    Ok(transcription) => {
                        return Ok(AudioResponse {
                            success: true,
                            transcription: Some(transcription),
                            error: None,
                        });
                    }
                    Err(fallback_error) => Some(fallback_error),
                }
            } else {
                Some("fallback not configured".to_string())
            };

            tracing::warn!(
                primary_error = %primary_error,
                fallback_error = %fallback_error_message
                    .as_deref()
                    .unwrap_or("not attempted"),
                "Audio transcription failed for all configured endpoints"
            );
            tauri::async_runtime::spawn({
                let app = app.clone();
                let error_msg = if let Some(fallback_err) = fallback_error_message {
                    format!("Primary: {} | Fallback: {}", primary_error, fallback_err)
                } else {
                    primary_error.clone()
                };
                async move {
                    report_api_error(
                        app,
                        error_msg,
                        "/api/transcribe".to_string(),
                        error_model,
                        error_provider,
                    )
                    .await;
                }
            });
            Err("Transcription failed. Please try again.".to_string())
        }
    }
}

// Helper function to fetch API response configuration
async fn fetch_api_response_config(
    app: &AppHandle,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ApiResponseConfig, String> {
    if is_dev_mode() {
        return Err("dev mode: use local config".to_string());
    }

    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;
    let machine_id: String = app.machine_uid().get_machine_uid().unwrap().id.unwrap();

    // Get stored credentials
    let (license_key, instance_id, _) = get_stored_credentials(app).await?;

    // Make HTTP request to response endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/response", app_endpoint);

    let mut request = client
        .get(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance", &instance_id)
        .header("machine_id", &machine_id);

    // Add optional headers
    if let Some(p) = provider {
        request = request.header("provider", p);
    }
    if let Some(m) = model {
        request = request.header("model", m);
    }

    let response = request.send().await.map_err(|e| {
        let error_msg = format!("{}", e);
        if error_msg.contains("url (") {
            let parts: Vec<&str> = error_msg.split(" for url (").collect();
            if parts.len() > 1 {
                format!("Failed to fetch API config: {}", parts[0])
            } else {
                format!("Failed to fetch API config: {}", error_msg)
            }
        } else {
            format!("Failed to fetch API config: {}", error_msg)
        }
    })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }
    let api_config: ApiResponseConfig = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API config response: {}", e))?;
    Ok(api_config)
}

fn map_api_error_message(error_rules: &[ApiConfigError], sources: &[String]) -> String {
    for source in sources {
        for rule in error_rules {
            if !rule.includes.is_empty() && source.contains(&rule.includes) {
                return rule.error.clone();
            }
        }
    }

    if let Some(default_rule) = error_rules
        .iter()
        .find(|rule| rule.includes.trim().is_empty())
    {
        return default_rule.error.clone();
    }

    error_rules
        .first()
        .map(|rule| rule.error.clone())
        .unwrap_or_else(|| {
            "Something went wrong. Please try switching to a different model or contact support."
                .to_string()
        })
}

fn decode_audio_base64(audio_base64: &str) -> Result<Vec<u8>, String> {
    let trimmed = audio_base64.trim();
    let base64_str = if let Some(idx) = trimmed.find(',') {
        &trimmed[idx + 1..]
    } else {
        trimmed
    };

    general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| format!("Failed to decode audio data: {}", e))
}

async fn perform_user_audio_transcription(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    model: &str,
    headers: Option<&Vec<UserAudioHeader>>,
    audio_bytes: &[u8],
) -> Result<String, String> {
    let audio_part = Part::bytes(audio_bytes.to_vec())
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to prepare audio payload: {}", e))?;

    let mut form = Form::new()
        .part("file", audio_part)
        .text("model", model.to_string());

    if let Some(extra_headers) = headers {
        for header in extra_headers {
            let key = header.key.trim();
            if key.is_empty() {
                continue;
            }

            form = form.text(key.to_string(), header.value.clone());
        }
    }

    let response = client
        .post(url)
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Transcription request failed to send: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read transcription error response".to_string());
        return Err(format!(
            "Transcription request returned {} with body: {}",
            status, error_text
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read transcription response: {}", e))?;

    if body_text.trim().is_empty() {
        return Err("Transcription response was empty".to_string());
    }

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body_text) {
        if let Some(text) = json.get("text").and_then(|value| value.as_str()) {
            return Ok(text.to_string());
        }

        if let Some(text) = json
            .get("transcription")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("result").and_then(|value| value.as_str()))
        {
            return Ok(text.to_string());
        }

        return Ok(json.to_string());
    }

    Ok(body_text)
}

#[tauri::command]
pub async fn chat_stream_response(
    app: AppHandle,
    user_message: String,
    system_prompt: Option<String>,
    image_base64: Option<serde_json::Value>,
    history: Option<String>,
) -> Result<String, String> {
    let (_, _, selected_model) = get_stored_credentials(&app).await.unwrap_or((
        String::new(),
        String::new(),
        None,
    ));
    let (provider, model) = selected_model.as_ref().map_or((None, None), |m| {
        (Some(m.provider.clone()), Some(m.model.clone()))
    });

    // Fetch API configuration with fallback
    let api_config = get_api_config_with_fallback(&app, provider.clone(), model.clone()).await?;

    // Parse the body from API config to merge with our request
    let mut extra_body: serde_json::Value = if !api_config.body.is_empty() {
        serde_json::from_str(&api_config.body).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Build messages array in OpenAI format
    let mut messages: Vec<serde_json::Value> = Vec::new();

    // Add system message if provided
    if let Some(sys_prompt) = system_prompt {
        messages.push(serde_json::json!({
            "role": "system",
            "content": sys_prompt
        }));
    }

    // Add history if provided
    if let Some(history_str) = history {
        if let Ok(history_messages) = serde_json::from_str::<Vec<serde_json::Value>>(&history_str) {
            messages.extend(history_messages);
        }
    }

    // Build user message content
    let mut user_content: Vec<serde_json::Value> = Vec::new();

    // Add text content
    user_content.push(serde_json::json!({
        "type": "text",
        "text": user_message
    }));

    // Add image content if provided
    if let Some(image_data) = image_base64 {
        if image_data.is_string() {
            // Single image
            user_content.push(serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": format!("data:image/jpeg;base64,{}", image_data.as_str().unwrap())
                }
            }));
        } else if image_data.is_array() {
            // Multiple images
            if let Some(images) = image_data.as_array() {
                for image in images {
                    if let Some(img_str) = image.as_str() {
                        user_content.push(serde_json::json!({
                            "type": "image_url",
                            "image_url": {
                                "url": format!("data:image/jpeg;base64,{}", img_str)
                            }
                        }));
                    }
                }
            }
        }
    }

    // Add user message
    messages.push(serde_json::json!({
        "role": "user",
        "content": user_content
    }));

    let is_anthropic = provider.as_deref() == Some("Anthropic");
    let request_body: serde_json::Value = if is_anthropic {
        // Anthropic: system is top-level; messages have content as array of blocks (text, image with base64)
        let system_text = messages
            .iter()
            .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("system"))
            .and_then(|m| m.get("content").and_then(|c| c.as_str()))
            .unwrap_or("")
            .to_string();
        let anthropic_messages: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.get("role").and_then(|r| r.as_str()) != Some("system"))
            .map(|m| {
                let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
                let content = m.get("content").cloned().unwrap_or(serde_json::json!([]));
                let blocks: Vec<serde_json::Value> = if let Some(arr) = content.as_array() {
                    arr.iter()
                        .map(|block| {
                            if block.get("type").and_then(|t| t.as_str()) == Some("image_url") {
                                let url = block
                                    .get("image_url")
                                    .and_then(|u| u.get("url"))
                                    .and_then(|u| u.as_str())
                                    .unwrap_or("");
                                let base64 = url.strip_prefix("data:image/jpeg;base64,").or_else(|| url.strip_prefix("data:image/png;base64,")).unwrap_or(url);
                                serde_json::json!({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/jpeg",
                                        "data": base64
                                    }
                                })
                            } else {
                                serde_json::json!({
                                    "type": "text",
                                    "text": block.get("text").and_then(|t| t.as_str()).unwrap_or("")
                                })
                            }
                        })
                        .collect()
                } else if let Some(s) = content.as_str() {
                    vec![serde_json::json!({ "type": "text", "text": s })]
                } else {
                    vec![]
                };
                serde_json::json!({ "role": role, "content": blocks })
            })
            .collect();
        let max_tokens = extra_body.get("max_tokens").cloned().unwrap_or(serde_json::json!(8192));
        serde_json::json!({
            "model": api_config.model,
            "max_tokens": max_tokens,
            "system": system_text,
            "messages": anthropic_messages,
            "stream": true
        })
    } else {
        let mut body = serde_json::json!({
            "model": api_config.model,
            "messages": messages,
            "stream": true
        });
        if let Some(extra_obj) = extra_body.as_object_mut() {
            if let Some(req_obj) = body.as_object_mut() {
                for (key, value) in extra_obj.iter() {
                    req_obj.insert(key.clone(), value.clone());
                }
            }
        }
        body
    };

    let error_rules = api_config.errors.clone().unwrap_or_default();
    let client = reqwest::Client::new();
    let mut req_builder = client
        .post(&api_config.url)
        .header("Content-Type", "application/json")
        .json(&request_body);
    if is_anthropic {
        req_builder = req_builder.header("x-api-key", api_config.user_token.clone());
        req_builder = req_builder.header("anthropic-version", "2023-06-01");
    } else {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", api_config.user_token));
    }
    let response = match req_builder
        .send()
        .await
    {
        Ok(resp) => resp,
        Err(e) => {
            let mut sources = vec![e.to_string()];
            if let Ok(url) = Url::parse(&api_config.url) {
                sources.push(url.to_string());
            }
            let final_message = map_api_error_message(&error_rules, &sources);
            tauri::async_runtime::spawn({
                let app = app.clone();
                let provider = provider.clone();
                let model = model.clone();
                let error_msg = e.to_string();
                async move {
                    report_api_error(app, error_msg, "/api/chat".to_string(), model, provider)
                        .await;
                }
            });
            return Err(final_message);
        }
    };

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        let mut sources = vec![error_text.clone(), status.to_string()];

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                sources.push(error_msg.to_string());
            }
            if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                sources.push(message.to_string());
            }
        }

        let final_message = map_api_error_message(&error_rules, &sources);
        tauri::async_runtime::spawn({
            let app = app.clone();
            let provider = provider.clone();
            let model = model.clone();
            let error_msg = format!("{}: {}", status, error_text);
            async move {
                report_api_error(app, error_msg, "/api/chat".to_string(), model, provider).await;
            }
        });
        return Err(final_message);
    }

    // Handle streaming response
    let mut stream = response.bytes_stream();
    let mut full_response = String::new();
    let mut buffer = String::new();
    let mut usage: Option<serde_json::Value> = None;
    let mut stream_started = false;

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                let chunk_str = String::from_utf8_lossy(&bytes);
                buffer.push_str(&chunk_str);

                // Process complete lines
                let lines: Vec<&str> = buffer.split('\n').collect();
                let incomplete_line = lines.last().unwrap_or(&"").to_string();

                for line in &lines[..lines.len() - 1] {
                    // Process all but the last (potentially incomplete) line
                    let trimmed_line = line.trim();

                    if trimmed_line.starts_with("data: ") {
                        let json_str = trimmed_line.strip_prefix("data: ").unwrap_or("");

                        if json_str == "[DONE]" {
                            break;
                        }

                        if !json_str.is_empty() {
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str)
                            {
                                if is_anthropic {
                                    if parsed.get("type").and_then(|t| t.as_str()) == Some("content_block_delta") {
                                        if let Some(delta) = parsed.get("delta") {
                                            if let Some(content) = delta.get("text").and_then(|c| c.as_str()) {
                                                full_response.push_str(content);
                                                let _ = app.emit("chat_stream_chunk", content);
                                                stream_started = true;
                                            }
                                        }
                                    }
                                } else {
                                    if usage.is_none() {
                                        if let Some(collected) = parsed.get("usage") {
                                            if !collected.is_null() {
                                                usage = Some(collected.clone());
                                            }
                                        }
                                    }
                                    if let Some(choices) =
                                        parsed.get("choices").and_then(|c| c.as_array())
                                    {
                                        if let Some(first_choice) = choices.first() {
                                            if let Some(delta) = first_choice.get("delta") {
                                                if let Some(content) =
                                                    delta.get("content").and_then(|c| c.as_str())
                                                {
                                                    full_response.push_str(content);
                                                    let _ = app.emit("chat_stream_chunk", content);
                                                    stream_started = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Update buffer with incomplete line
                buffer = incomplete_line;
            }
            Err(e) => {
                let sources = vec![e.to_string()];
                let final_message = map_api_error_message(&error_rules, &sources);
                tauri::async_runtime::spawn({
                    let app = app.clone();
                    let provider = provider.clone();
                    let model = model.clone();
                    let error_msg = e.to_string();
                    async move {
                        report_api_error(app, error_msg, "/api/chat".to_string(), model, provider)
                            .await;
                    }
                });
                return Err(final_message);
            }
        }
    }

    // Emit completion event
    let _ = app.emit("chat_stream_complete", &full_response);

    if stream_started && !full_response.is_empty() {
        tauri::async_runtime::spawn({
            let activity_app = app.clone();
            let activity_model = api_config.model.clone();
            let activity_app_version = app.package_info().version.to_string();
            let captured_metrics = usage.clone();
            async move {
                let _ = user_activity(
                    activity_app,
                    captured_metrics,
                    activity_model,
                    activity_app_version,
                )
                .await;
            }
        });
    }

    Ok(full_response)
}

async fn user_activity(
    app: AppHandle,
    activity_metrics: Option<serde_json::Value>,
    configured_model: String,
    app_version: String,
) -> Result<(), String> {
    let app_endpoint = match get_app_endpoint() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    let api_access_key = match get_api_access_key() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    let (license_key, instance_id, stored_model) = match get_stored_credentials(&app).await {
        Ok(values) => values,
        Err(_) => return Ok(()),
    };

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_else(String::new),
        Err(_) => String::new(),
    };

    if machine_id.is_empty() {
        return Ok(());
    }

    let ai_model = stored_model
        .as_ref()
        .map(|model| model.model.clone())
        .unwrap_or(configured_model);

    let mut payload = serde_json::json!({
        "license": license_key,
        "instance": instance_id,
        "machine_id": machine_id,
        "app_version": app_version,
        "ai_model": ai_model,
    });

    if let Some(metrics) = activity_metrics {
        if let Some(obj) = payload.as_object_mut() {
            const METRIC_FIELD_BYTES: [u8; 5] = [117, 115, 97, 103, 101];
            if let Ok(field) = std::str::from_utf8(&METRIC_FIELD_BYTES) {
                obj.insert(field.to_string(), metrics);
            }
        }
    }

    let activity_url = format!("{}/api/activity", app_endpoint.trim_end_matches('/'));
    let client = reqwest::Client::new();

    let _ = client
        .post(&activity_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await;

    Ok(())
}

async fn report_api_error(
    app: AppHandle,
    error_message: String,
    endpoint: String,
    model: Option<String>,
    provider: Option<String>,
) {
    let app_endpoint = match get_app_endpoint() {
        Ok(value) => value,
        Err(_) => return,
    };

    let api_access_key = match get_api_access_key() {
        Ok(value) => value,
        Err(_) => return,
    };

    let (license_key, instance_id, stored_model) = match get_stored_credentials(&app).await {
        Ok(values) => values,
        Err(_) => return,
    };

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_default(),
        Err(_) => return,
    };

    if machine_id.is_empty() {
        return;
    }

    let app_version = app.package_info().version.to_string();

    let final_model = model
        .or_else(|| stored_model.as_ref().map(|m| m.model.clone()))
        .unwrap_or_default();

    let final_provider = provider
        .or_else(|| stored_model.as_ref().map(|m| m.provider.clone()))
        .unwrap_or_default();

    let payload = serde_json::json!({
        "machine_id": machine_id,
        "error_message": error_message,
        "app_version": app_version,
        "instance": instance_id,
        "license_key": license_key,
        "endpoint": endpoint,
        "model": final_model,
        "provider": final_provider
    });

    let error_url = format!("{}/api/error", app_endpoint.trim_end_matches('/'));
    let client = reqwest::Client::new();

    tracing::debug!("Reporting API error: {:?}", payload);

    if let Err(e) = client
        .post(&error_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
    {
        tracing::warn!("Failed to report API error: {}", e);
    }
}

// Dev-mode: fetch models from provider APIs (OpenAI, Google, Anthropic)
// All listed chat models are treated as supporting text+image so the UI does not show "text only" for every model.
fn openai_modality(_id: &str) -> &'static str {
    "text,image"
}

async fn fetch_openai_models() -> Result<Vec<Model>, String> {
    let key = env::var("OPENAI_API_KEY")
        .ok()
        .or_else(|| option_env!("OPENAI_API_KEY").map(String::from))
        .filter(|k| !k.trim().is_empty());
    let key = match key {
        Some(k) => k,
        None => return Ok(vec![]),
    };
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", key.trim()))
        .send()
        .await
        .map_err(|e| format!("OpenAI models request failed: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI models API error ({}): {}", status, text));
    }
    let json: serde_json::Value = response.json().await.map_err(|e| format!("OpenAI models parse error: {}", e))?;
    let empty: Vec<serde_json::Value> = vec![];
    let data = json.get("data").and_then(|d| d.as_array()).unwrap_or(&empty);
    let models: Vec<Model> = data
        .iter()
        .filter_map(|m| {
            let id = m.get("id")?.as_str()?;
            let id = id.to_string();
            if id.starts_with("gpt-") || id.starts_with("o1") || id.starts_with("o3") || id.starts_with("o4") || id.starts_with("chatgpt-") {
                let modality = openai_modality(&id).to_string();
                Some(Model {
                    provider: "OpenAI".to_string(),
                    name: id.clone(),
                    id: id.clone(),
                    model: id.clone(),
                    description: format!("OpenAI {}", id),
                    modality,
                    is_available: true,
                })
            } else {
                None
            }
        })
        .collect();
    Ok(models)
}

#[derive(Debug, Deserialize)]
struct GoogleModelsResponse {
    #[serde(default)]
    models: Vec<GoogleModelEntry>,
}

#[derive(Debug, Deserialize)]
struct GoogleModelEntry {
    name: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "supportedGenerationMethods")]
    supported_generation_methods: Option<Vec<String>>,
}

async fn fetch_google_models() -> Result<Vec<Model>, String> {
    let key = env::var("GOOGLE_API_KEY")
        .ok()
        .or_else(|| option_env!("GOOGLE_API_KEY").map(String::from))
        .filter(|k| !k.trim().is_empty());
    let key = match key {
        Some(k) => k,
        None => return Ok(vec![]),
    };
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key.trim());
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Google models request failed: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Google models API error ({}): {}", status, text));
    }
    let body: GoogleModelsResponse = response.json().await.map_err(|e| format!("Google models parse error: {}", e))?;
    let models: Vec<Model> = body
        .models
        .into_iter()
        .filter_map(|m| {
            let name = m.name?;
            if !name.starts_with("models/") {
                return None;
            }
            let model_id = name.trim_start_matches("models/").to_string();
            let methods = m.supported_generation_methods.unwrap_or_default();
            if !methods.iter().any(|s| s == "generateContent") {
                return None;
            }
            let display = m.display_name.unwrap_or_else(|| model_id.clone());
            let modality = if model_id.contains("gemini-2") || model_id.contains("gemini-1.5") {
                "text,image"
            } else {
                "text,image"
            };
            Some(Model {
                provider: "Google".to_string(),
                name: display,
                id: model_id.clone(),
                model: model_id.clone(),
                description: format!("Google {}", model_id),
                modality: modality.to_string(),
                is_available: true,
            })
        })
        .collect();
    Ok(models)
}

fn anthropic_models() -> Vec<Model> {
    let list: Vec<(&str, &str)> = vec![
        ("claude-sonnet-4-20250514", "Claude Sonnet 4"),
        ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet"),
        ("claude-3-5-haiku-20241022", "Claude 3.5 Haiku"),
        ("claude-3-opus-20240229", "Claude 3 Opus"),
        ("claude-3-sonnet-20240229", "Claude 3 Sonnet"),
        ("claude-3-haiku-20240307", "Claude 3 Haiku"),
    ];
    list.into_iter()
        .map(|(id, name)| Model {
            provider: "Anthropic".to_string(),
            name: name.to_string(),
            id: id.to_string(),
            model: id.to_string(),
            description: format!("Anthropic {}", name),
            modality: "text,image".to_string(),
            is_available: true,
        })
        .collect()
}

async fn fetch_dev_mode_models() -> Result<Vec<Model>, String> {
    let mut all = Vec::new();
    if let Ok(openai) = fetch_openai_models().await {
        all.extend(openai);
    }
    if let Ok(google) = fetch_google_models().await {
        all.extend(google);
    }
    if env::var("ANTHROPIC_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false)
        || option_env!("ANTHROPIC_API_KEY").map(|s| !s.trim().is_empty()).unwrap_or(false)
    {
        all.extend(anthropic_models());
    }
    if all.is_empty() {
        all.push(Model {
            provider: "OpenAI".to_string(),
            name: "GPT-4o".to_string(),
            id: "gpt-4o".to_string(),
            model: "gpt-4o".to_string(),
            description: "Dev default model".to_string(),
            modality: "text,image".to_string(),
            is_available: true,
        });
    }
    Ok(all)
}

// Models API Command
#[tauri::command]
pub async fn fetch_models(app: AppHandle) -> Result<Vec<Model>, String> {
    if is_dev_mode() {
        return fetch_dev_mode_models().await;
    }

    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;

    let (license_key, instance_id) = match get_stored_credentials(&app).await {
        Ok((lk, id, _)) => (lk, id),
        Err(_) => ("".to_string(), "".to_string()),
    };
    let machine_id = app
        .machine_uid()
        .get_machine_uid()
        .ok()
        .and_then(|uid| uid.id)
        .unwrap_or_else(|| "".to_string());
    let app_version = app.package_info().version.to_string();

    // Make HTTP request to models endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/models", app_endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance", &instance_id)
        .header("machine_id", &machine_id)
        .header("app_version", &app_version)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                // Remove the URL part from the error message
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to make models request: {}", parts[0])
                } else {
                    format!("Failed to make models request: {}", error_msg)
                }
            } else {
                format!("Failed to make models request: {}", error_msg)
            }
        })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    let models_response: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {}", e))?;

    Ok(models_response.models)
}

// Fetch Cloak Prompts API
#[tauri::command]
pub async fn fetch_prompts() -> Result<CloakPromptsResponse, String> {
    if is_dev_mode() {
        return Ok(CloakPromptsResponse {
            prompts: vec![],
            total: 0,
            last_updated: None,
        });
    }

    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;

    let client = reqwest::Client::new();
    let url = format!("{}/api/prompts", app_endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to make prompts request: {}", parts[0])
                } else {
                    format!("Failed to make prompts request: {}", error_msg)
                }
            } else {
                format!("Failed to make prompts request: {}", error_msg)
            }
        })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    let prompts_response: CloakPromptsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse prompts response: {}", e))?;

    Ok(prompts_response)
}

// Create System Prompt API Command
#[tauri::command]
pub async fn create_system_prompt(
    app: AppHandle,
    user_prompt: String,
) -> Result<SystemPromptResponse, String> {
    if is_dev_mode() {
        return Err("Creating system prompts on the server is not available in development. Use local prompts instead.".to_string());
    }

    // Get environment variables
    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;
    let (license_key, instance_id, _) = get_stored_credentials(&app).await?;
    let machine_id: String = app.machine_uid().get_machine_uid().unwrap().id.unwrap();
    let app_version: String = app.package_info().version.to_string();
    // Make HTTP request to models endpoint
    let client = reqwest::Client::new();
    let url = format!("{}/api/prompt", app_endpoint);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance", &instance_id)
        .header("machine_id", &machine_id)
        .header("app_version", &app_version)
        .json(&serde_json::json!({
            "user_prompt": user_prompt
        }))
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                // Remove the URL part from the error message
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to make models request: {}", parts[0])
                } else {
                    format!("Failed to make models request: {}", error_msg)
                }
            } else {
                format!("Failed to make models request: {}", error_msg)
            }
        })?;

    // Check if the response is successful
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        // Try to parse error as JSON to get a more specific error message
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("Server error ({}): {}", status, error_msg));
            } else if let Some(message) = error_json.get("message").and_then(|m| m.as_str()) {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    let system_prompt_response: SystemPromptResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse system prompt response: {}", e))?;

    Ok(system_prompt_response)
}

// Helper command to check if license is available
#[tauri::command]
pub async fn check_license_status(app: AppHandle) -> Result<bool, String> {
    match get_stored_credentials(&app).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn get_env_config() -> Result<serde_json::Value, String> {
    let api_access_key = get_api_access_key().unwrap_or_default();
    let app_endpoint = get_app_endpoint().unwrap_or_default();
    let has_openai = env::var("OPENAI_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false)
        || option_env!("OPENAI_API_KEY").map(|s| !s.trim().is_empty()).unwrap_or(false);
    let has_google = env::var("GOOGLE_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false)
        || option_env!("GOOGLE_API_KEY").map(|s| !s.trim().is_empty()).unwrap_or(false);
    let has_anthropic = env::var("ANTHROPIC_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false)
        || option_env!("ANTHROPIC_API_KEY").map(|s| !s.trim().is_empty()).unwrap_or(false);
    Ok(serde_json::json!({
        "api_access_key": api_access_key,
        "app_endpoint": app_endpoint,
        "has_openai_key": has_openai,
        "has_google_key": has_google,
        "has_anthropic_key": has_anthropic,
    }))
}

#[allow(dead_code)]
#[tauri::command]
pub async fn get_activity(app: AppHandle) -> Result<serde_json::Value, String> {
    if is_dev_mode() {
        return Ok(serde_json::json!([]));
    }

    let app_endpoint = get_app_endpoint()?;
    let api_access_key = get_api_access_key()?;

    let (license_key, instance_id, _) = get_stored_credentials(&app).await?;

    let machine_id = match app.machine_uid().get_machine_uid() {
        Ok(id) => id.id.unwrap_or_default(),
        Err(_) => String::new(),
    };

    if machine_id.is_empty() {
        return Err("Machine identifier unavailable".to_string());
    }

    let app_version = app.package_info().version.to_string();

    let client = reqwest::Client::new();
    let activity_url = format!("{}/api/activity", app_endpoint.trim_end_matches('/'));

    let response = client
        .get(&activity_url)
        .header("Authorization", format!("Bearer {}", api_access_key))
        .header("license_key", &license_key)
        .header("instance_name", &instance_id)
        .header("machine_id", machine_id)
        .header("app_version", app_version)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("{}", e);
            if error_msg.contains("url (") {
                let parts: Vec<&str> = error_msg.split(" for url (").collect();
                if parts.len() > 1 {
                    format!("Failed to request activity: {}", parts[0])
                } else {
                    format!("Failed to request activity: {}", error_msg)
                }
            } else {
                format!("Failed to request activity: {}", error_msg)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown server error".to_string());

        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_text) {
            if let Some(message) = error_json
                .get("message")
                .and_then(|m| m.as_str())
                .or_else(|| error_json.get("error").and_then(|m| m.as_str()))
            {
                return Err(format!("Server error ({}): {}", status, message));
            }
        }

        return Err(format!("Server error ({}): {}", status, error_text));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse activity response: {}", e))
}
