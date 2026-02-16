use cidre::{core_audio as ca, arc, av};

fn main() {
    // Probe for constructors
    let _ = ca::TapDesc::new(todo!(), todo!(), todo!(), todo!(), todo!(), todo!());
    // let _ = ca::TapDesc::with_format();

    // Attempt to access tap options
    let tap_desc = ca::TapDesc::with_stereo_global_tap_excluding_processes(&cidre::ns::Array::new());
    let tap = tap_desc.create_process_tap().unwrap();
    // Probe methods
    let _ = tap.start(todo!());
    let _ = tap.enable(todo!());
    let _ = tap.set_enabled(todo!());
}
