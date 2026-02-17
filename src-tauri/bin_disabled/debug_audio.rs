use cloak_lib::speaker::SpeakerInput;
use futures_util::StreamExt;
use std::time::Duration;

#[tokio::main]
async fn main() {
    println!("Starting debug_audio...");

    // 1. List devices (just to see logs/availability)
    println!("Requesting permissions...");
    // Initialize permission check (this is static/global usually, but let's just try to create input)

    // 2. Create SpeakerInput
    println!("Creating SpeakerInput...");
    let input = match SpeakerInput::new() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("Failed to create SpeakerInput: {}", e);
            return;
        }
    };

    println!("SpeakerInput created. Starting stream...");
    let mut stream = input.stream();
    println!("Stream started. Sample Rate: {}", stream.sample_rate());

    // 3. Consume stream
    let mut count = 0;
    let mut non_zero_total = 0;

    let now = std::time::Instant::now();

    while let Some(sample) = stream.next().await {
        if sample.abs() > 0.0001 {
            non_zero_total += 1;
        }

        count += 1;
        if count % 48000 == 0 {
           println!("Processed {} samples. Non-zero: {}", count, non_zero_total);
        }

        if now.elapsed() > Duration::from_secs(5) {
            println!("Ran for 5 seconds. Exiting.");
            break;
        }
    }

    println!("Finished. Total samples: {}, Non-zero: {}", count, non_zero_total);
}
