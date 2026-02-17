use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthResult {
    pub code: String,
    pub redirect_uri: String,
}

fn simple_percent_encode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{:02X}", b),
        })
        .collect()
}

fn parse_query_param(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let mut parts = pair.splitn(2, '=');
        let k = parts.next()?;
        let v = parts.next()?;
        if k == key {
            Some(v.replace('+', " "))
        } else {
            None
        }
    })
}

#[tauri::command]
pub async fn google_oauth_start(
    _app: AppHandle,
    client_id: String,
    scopes: String,
) -> Result<OAuthResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind local server: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{}", port);
    let state = uuid::Uuid::new_v4().to_string();

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        &client_id,
        simple_percent_encode(&redirect_uri),
        simple_percent_encode(&scopes),
        &state
    );

    // Open browser
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&auth_url)
            .spawn()
            .ok();
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &auth_url])
            .spawn()
            .ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&auth_url)
            .spawn()
            .ok();
    }

    // Wait for the OAuth callback with a 2-minute timeout
    let (mut stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "OAuth timed out. Please try again.".to_string())?
    .map_err(|e| format!("Failed to accept connection: {}", e))?;

    let mut buf = vec![0u8; 8192];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read request: {}", e))?;

    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    // Parse the first line: GET /?code=xxx&state=yyy HTTP/1.1
    let first_line = request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");

    let query = path.splitn(2, '?').nth(1).unwrap_or("");

    // Check for errors
    if let Some(error) = parse_query_param(query, "error") {
        let html = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
            <html><head><style>body{{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}}.c{{text-align:center}}</style></head>\
            <body><div class='c'><h2>Authorization Failed</h2><p>{}</p><p>You can close this tab.</p></div></body></html>",
            error
        );
        stream.write_all(html.as_bytes()).await.ok();
        stream.shutdown().await.ok();
        return Err(format!("OAuth error: {}", error));
    }

    let code = parse_query_param(query, "code")
        .ok_or_else(|| "No authorization code received".to_string())?;

    // Send a success page
    let html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n\
        <html><head><style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}.c{text-align:center}h2{color:#22c55e}</style></head>\
        <body><div class='c'><h2>Connected!</h2><p>Google Calendar connected successfully.</p><p>You can close this tab and return to Cloak.</p></div></body></html>";

    stream.write_all(html.as_bytes()).await.ok();
    stream.shutdown().await.ok();

    Ok(OAuthResult {
        code,
        redirect_uri,
    })
}
