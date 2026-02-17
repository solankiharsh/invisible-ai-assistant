# Creating release artifacts and publishing a release

The GitHub **Releases** page stays empty until you build the app and either upload files to a release or host them elsewhere (e.g. Cloudflare R2). This guide covers building the installers and optionally creating a GitHub Release.

---

## Prerequisites

- **Node.js** (v18+)
- **Rust** — install from [rustup.rs](https://rustup.rs): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **macOS:** To build the DMG, run the build on macOS. Install Xcode Command Line Tools if needed: `xcode-select --install`
- **Windows:** Build EXE/MSI on Windows with [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
- **Linux:** Build .deb / .rpm / AppImage on Linux with the usual dev packages (e.g. `libwebkit2gtk`, `libgtk-3-dev`, etc. — see [Tauri docs](https://v2.tauri.app/start/prerequisites/)).

---

## Build artifacts

From the repo root:

```bash
npm install
npm run tauri build
```

This compiles the frontend (`npm run build`), then the Rust app, and produces installers for the current OS. Output is under `src-tauri/target/release/bundle/`.

### Where to find the files

Version is read from `package.json` / `src-tauri/Cargo.toml` (e.g. **0.1.9**). Paths:

| Platform   | Path                                                                 | Example filenames |
|-----------|----------------------------------------------------------------------|-------------------|
| **macOS** | `src-tauri/target/release/bundle/dmg/`                               | `Cloak_0.1.9_aarch64.dmg`, `Cloak_0.1.9_x64.dmg` |
| **Windows** | `src-tauri/target/release/bundle/msi/`, `.../nsis/`                | `Cloak_0.1.9_x64_en-US.msi`, `Cloak_0.1.9_x64-setup.exe` |
| **Linux**   | `src-tauri/target/release/bundle/`                                 | `.deb`, `.AppImage`, `.rpm` |

- **Apple Silicon (M1/M2/M3):** use the `_aarch64.dmg` file.
- **Intel Mac:** use the `_x64.dmg` file.

---

## Create a GitHub Release (so the Releases page shows something)

1. **Tag the commit** you want to release (e.g. current `main`):
   ```bash
   git tag v0.1.9
   git push origin v0.1.9
   ```
   Or create the tag on GitHub when creating the release.

2. On GitHub: open the repo → **Releases** → **“Create a new release”**.

3. **Choose a tag:** e.g. `v0.1.9` (create from current branch if it doesn’t exist).

4. **Release title:** e.g. `Cloak 0.1.9`.

5. **Description:** add release notes (what’s new, install instructions).

6. **Attach binaries:** under “Assets”, drag and drop or upload:
   - `Cloak_0.1.9_aarch64.dmg`
   - `Cloak_0.1.9_x64.dmg`
   - (and Windows/Linux installers if you built them).

7. Click **Publish release**.

After that, the Releases page will list the release and the download links, e.g.:
`https://github.com/solankiharsh/invisible-ai-assistant/releases/download/v0.1.9/Cloak_0.1.9_aarch64.dmg`

---

## Hosting elsewhere (e.g. Cloudflare R2)

If you host installers on your own (e.g. R2) and link from your website (e.g. tokenoverflow `/cloak` page), see:

**tokenoverflow:** [docs/CLOAK_DOWNLOADS_CLOUDFLARE.md](https://github.com/solankiharsh/tokenoverflow/blob/main/docs/CLOAK_DOWNLOADS_CLOUDFLARE.md) — step-by-step for building, uploading to R2, and configuring the Cloak download page.

You can use both: GitHub Releases for visibility and R2 (or similar) for the main download links on your site.
