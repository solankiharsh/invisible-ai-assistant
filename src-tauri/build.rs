fn main() {
    dotenv::dotenv().ok();

    if let Ok(payment_endpoint) = std::env::var("PAYMENT_ENDPOINT") {
        println!("cargo:rustc-env=PAYMENT_ENDPOINT={}", payment_endpoint);
    }

    if let Ok(api_access_key) = std::env::var("API_ACCESS_KEY") {
        println!("cargo:rustc-env=API_ACCESS_KEY={}", api_access_key);
    }

    if let Ok(dev_admin_key) = std::env::var("CLOAK_DEV_ADMIN_KEY") {
        println!("cargo:rustc-env=CLOAK_DEV_ADMIN_KEY={}", dev_admin_key);
    }

    if let Ok(app_endpoint) = std::env::var("APP_ENDPOINT") {
        println!("cargo:rustc-env=APP_ENDPOINT={}", app_endpoint);
    }

    if let Ok(posthog_api_key) = std::env::var("POSTHOG_API_KEY") {
        println!("cargo:rustc-env=POSTHOG_API_KEY={}", posthog_api_key);
    }

    if let Ok(google_key) = std::env::var("GOOGLE_API_KEY") {
        println!("cargo:rustc-env=GOOGLE_API_KEY={}", google_key);
    }

    if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
        println!("cargo:rustc-env=ANTHROPIC_API_KEY={}", anthropic_key);
    }

    println!("cargo:rustc-link-lib=framework=CoreGraphics");
    tauri_build::build()
}
