# Disabled debug binaries

These binaries were moved out of `src/bin/` so they are not built or bundled with the app. They depend on older or unstable `cidre` APIs and were causing the Tauri bundle step to fail (it tried to copy binaries that no longer exist after we set `autobins = false`).

To restore them for local debugging: move the `.rs` files back to `src/bin/`, fix the API usage for the current `cidre` version, and add explicit `[[bin]]` entries in `Cargo.toml` (or remove `autobins = false` and fix the code so they compile).
