use cidre::{sc, cm, dispatch, ns, objc};
use std::sync::Arc;

struct AudioDelegate;

impl sc::StreamOutput for AudioDelegate {
    extern "C" fn stream_did_output_sample_buffer(
        &mut self,
        _stream: &sc::Stream,
        _sample_buffer: &cm::SampleBuffer,
        _of_type: sc::OutputType,
    ) {
    }
}

#[tokio::main]
async fn main() {
    let content = sc::ShareableContent::current().await.unwrap();
    let display = content.displays().first().unwrap();
    let filter = sc::ContentFilter::with_display_excluding_windows(display, &ns::Array::new());
    
    let mut config = sc::StreamCfg::new();
    config.set_captures_audio(true);
    
    // Check if Stream::new exists and its signature
    // let stream = sc::Stream::new(&filter, &config, &AudioDelegate); 
    // Usually stream new takes delegate? Or sets later?
    // cidre stream usually takes delegate in init or via method.
    
    println!("SCK Syntax check done");
}
