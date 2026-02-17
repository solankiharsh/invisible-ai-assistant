# Cloak: Build All Artifacts and Upload to Supabase

This guide covers building every installer type (macOS, Windows, Linux) and uploading them to **Supabase Storage** so you can host download links (e.g. on your tokenoverflow `/cloak` page).

---

## Artifacts to generate

| Platform | Format | Build on | Output path / example |
|----------|--------|----------|------------------------|
| **macOS** | Apple Silicon (M1/M2/M3) | macOS | `src-tauri/target/release/bundle/dmg/Cloak_0.1.9_aarch64.dmg` |
| **macOS** | Intel | macOS | `src-tauri/target/release/bundle/dmg/Cloak_0.1.9_x64.dmg` |
| **Windows** | EXE installer | Windows | `src-tauri/target/release/bundle/nsis/Cloak_0.1.9_x64-setup.exe` |
| **Windows** | MSI installer | Windows | `src-tauri/target/release/bundle/msi/Cloak_0.1.9_x64_en-US.msi` |
| **Linux** | DEB | Linux | `src-tauri/target/release/bundle/deb/...` |
| **Linux** | RPM | Linux | `src-tauri/target/release/bundle/rpm/...` |
| **Linux** | AppImage | Linux | `src-tauri/target/release/bundle/appimage/...` |

Tauri only produces installers for the **current OS**. To get all of the above you must build on each OS (or use CI: e.g. GitHub Actions with `macos-latest`, `windows-latest`, `ubuntu-latest`).

---

## 1. Build on macOS (Apple Silicon + Intel)

From repo root:

```bash
# One arch (current machine arch by default)
make build

# Apple Silicon DMG only
make build-macos-arm64

# Intel DMG only
make build-macos-x64

# Both macOS DMGs
make build-macos-all
```

You need the Rust targets installed (the Makefile runs `rustup target add ...` when needed). Output is under `src-tauri/target/release/bundle/dmg/`.

---

## 2. Build on Windows (EXE + MSI)

On a Windows machine with [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and Node + Rust:

```bash
npm install
npm run tauri build
```

Look in:

- `src-tauri\target\release\bundle\nsis\` → `.exe` installer  
- `src-tauri\target\release\bundle\msi\` → `.msi` installer  

---

## 3. Build on Linux (DEB, RPM, AppImage)

On Linux with Tauri [prerequisites](https://v2.tauri.app/start/prerequisites/) (e.g. `libwebkit2gtk`, `libgtk-3-dev`):

```bash
npm install
npm run tauri build
```

Artifacts appear under `src-tauri/target/release/bundle/` (e.g. `deb/`, `rpm/`, `appimage/`).

---

## 4. Supabase Storage setup

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Storage**.
2. Create a bucket, e.g. `cloak-releases`.
3. Make it **Public** if you want direct download URLs (e.g. for your download page).  
   Or keep it private and use signed URLs.
4. (Optional) Add a policy so the service role (or your backend) can upload; the upload script uses **SUPABASE_SERVICE_ROLE_KEY** for uploads.

---

## 5. Upload artifacts to Supabase

Install the upload script dependency (once):

```bash
npm install
```

Set these env vars (or put them in `.env` and load with `source .env` / `dotenv`):

- **SUPABASE_URL** – e.g. `https://xxxx.supabase.co`
- **SUPABASE_SERVICE_ROLE_KEY** – from Supabase → Settings → API (use **service role** for uploads; required to create the bucket if it doesn’t exist)
- **SUPABASE_BUCKET** – (optional) bucket name, default: `cloak-releases`

The publishable (anon) key cannot create buckets; use the service role key for the upload so the script can create `cloak-releases` and upload in one go.

Then run the upload (after building at least one artifact):

```bash
# With env in shell
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
make upload-supabase

# Or with .env (if you load it first)
source .env   # or: set -a && source .env && set +a
make upload-supabase
```

Or call the script directly:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-cloak-to-supabase.mjs
```

The script:

- Scans `src-tauri/target/release/bundle/` for `.dmg`, `.msi`, `.exe`, `.deb`, `.rpm`, `.AppImage`
- Uploads each to `{bucket}/v{version}/{filename}` (e.g. `cloak-releases/v0.1.9/Cloak_0.1.9_aarch64.dmg`)
- Uses `upsert: true` so re-uploading overwrites
- Prints public URLs at the end (if the bucket is public)

**Override version folder:**

```bash
CLOAK_VERSION=0.1.9 make upload-supabase
```

---

## 6. Public download URLs (if bucket is public)

Base URL pattern:

```
https://<PROJECT_REF>.supabase.co/storage/v1/object/public/<BUCKET>/v<VERSION>/<FILENAME>
```

Example:

- `https://xxxx.supabase.co/storage/v1/object/public/cloak-releases/v0.1.9/Cloak_0.1.9_aarch64.dmg`
- `https://xxxx.supabase.co/storage/v1/object/public/cloak-releases/v0.1.9/Cloak_0.1.9_x64-setup.exe`

Use these in your tokenoverflow (or other) download page for each platform/format.

---

## 7. Optional: CI to build and upload

Use GitHub Actions (or similar) with three jobs (macOS, Windows, Linux). Each job runs `npm run tauri build`, uploads the bundle directory as artifacts, then a final job downloads all artifacts and runs `node scripts/upload-cloak-to-supabase.mjs` with your Supabase env as secrets. That way every tag/release produces all installers and uploads them to Supabase in one go.

---

## Quick reference

| Goal | Command |
|------|--------|
| Build current OS only | `make build` |
| Build both macOS DMGs | `make build-macos-all` |
| Upload to Supabase | `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... make upload-supabase` |
