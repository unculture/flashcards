# Plan: self-updating

Status: planned 16 October 2026, not started. Do this in a session where James is present, because step 2 needs him.

## Goal

When a new release is on GitHub, the app offers "Update now". It downloads the new version, checks its signature, installs it, and restarts, without her finding the installer or clicking through Windows warnings.

No server is needed. Everything comes from GitHub Releases.

## How it works

Tauri's official updater plugin (`tauri-plugin-updater`) reads a small file, `latest.json`, from a fixed URL. Each release uploads one, so this URL always points at the newest:

```
https://github.com/unculture/flashcards/releases/latest/download/latest.json
```

`latest.json` lists the version and, for each platform, a download URL and a signature:

```json
{
  "version": "0.4.0",
  "notes": "See the release page.",
  "pub_date": "2026-10-20T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/unculture/flashcards/releases/download/v0.4.0/Flashcards_0.4.0_x64-setup.exe",
      "signature": "<contents of Flashcards_0.4.0_x64-setup.exe.sig>"
    },
    "darwin-aarch64": {
      "url": "https://github.com/unculture/flashcards/releases/download/v0.4.0/Flashcards_0.4.0_aarch64.app.tar.gz",
      "signature": "<contents of the .app.tar.gz.sig>"
    }
  }
}
```

The app holds a public key and refuses any download not signed with the matching private key. This update-signing key has nothing to do with Windows or Apple code signing. It is free and needs no certificate.

## Steps

### 1. Make the update-signing key (Claude can do this)

```sh
npx tauri signer generate -w ~/.tauri/flashcards-updater.key
```

- It asks for a password. Use a strong one.
- It writes the private key to `~/.tauri/flashcards-updater.key` and the public key to `~/.tauri/flashcards-updater.key.pub`.
- **Never commit the private key.** Keep the key file and its password in James's password manager.
- **If the key is lost, installed apps can no longer update.** They would each need one manual install of a build with a new key.

### 2. Add two GitHub secrets (James does this)

The `gh` CLI token on this Mac is invalid, so do this on the website. Go to <https://github.com/unculture/flashcards/settings/secrets/actions> and choose **New repository secret** twice:

| Name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The whole contents of `~/.tauri/flashcards-updater.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password from step 1 |

(Or run `gh auth login` first, then `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/flashcards-updater.key`.)

### 3. Add the plugins

- Rust: `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` in `src-tauri/Cargo.toml`. Register both in `src-tauri/src/lib.rs`. The process plugin is for restarting.
- npm: `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`.
- Capabilities (`src-tauri/capabilities/default.json`): add `"updater:default"` and `"process:allow-restart"`.

### 4. Configure `src-tauri/tauri.conf.json`

```json
"bundle": {
  "createUpdaterArtifacts": true,
  ...
},
"plugins": {
  "updater": {
    "pubkey": "<contents of ~/.tauri/flashcards-updater.key.pub>",
    "endpoints": ["https://github.com/unculture/flashcards/releases/latest/download/latest.json"],
    "windows": { "installMode": "passive" }
  }
}
```

`passive` shows a small progress window during the Windows install, with no questions.

### 5. Change the release workflow (`.github/workflows/release.yml`)

- **Build step:** pass the two secrets as environment variables `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to `npx tauri build`. With `createUpdaterArtifacts`, the build writes `.sig` files next to the installers.
- **Mac build:** the updater uses `bundle/macos/Flashcards.app.tar.gz` and its `.sig`, not the dmg.
  - Check that `--bundles dmg` produces them. If it doesn't, use `--bundles app,dmg`.
  - Rename the archive to `Flashcards_<version>_aarch64.app.tar.gz` so the name is unique on the release.
- **Windows build:** the updater uses the NSIS `-setup.exe` itself, plus `-setup.exe.sig`.
- **Upload:** add the `.sig` files and the `.app.tar.gz` to the build artifacts.
- **Release job:** before publishing, run a small script, for example `scripts/latest-json.mjs`. It reads the `.sig` files and writes `latest.json` with the URLs as in the example above. Upload `latest.json` with the installers.
- **Alternative:** switch to `tauri-apps/tauri-action`, which builds and writes `latest.json` itself. The current workflow is simple and works, so the small script is the smaller change.

### 6. Change the app

- **Replace the check.** `src/update.ts` and `src-tauri/src/update.rs` call the GitHub API today. Use `check()` from `@tauri-apps/plugin-updater` instead. Remove `update.rs`, `check_for_update`, and the version-comparison tests. Keep `open_release_url` for a "What's new" link if wanted.
- **Banner** (`src/components/UpdateBanner.vue`): "A new version is ready" with **Update now** and **Not now**.
  - **Update now** calls `update.downloadAndInstall(progress)`, shows a progress bar, then calls `relaunch()` from `@tauri-apps/plugin-process`. On Windows the installer closes the app itself.
  - Before installing, make sure the library has been saved. `library.ts` saves on a timer, so flush any pending save first.
  - On failure, show "The update didn't work. You can download it from the website instead." with the old download link as a fallback.
- **Keep it calm.** Check at startup and once a day, show only on the home screen, and never interrupt practice or card making. Skip the check in dev builds (`import.meta.env.DEV`), as now.

### 7. Test before releasing

- Build a local copy with version `0.0.1`. Point the updater at a local `latest.json` with a runtime override, `app.updater_builder().endpoints(...)` in Rust, read from an environment variable as `FLASHCARDS_UPDATE_URL` is today. Serve it with `python3 -m http.server`.
- Check that a download with a bad signature is refused.
- On Windows, test on her laptop. Install the release by hand, then publish a test release such as `0.4.1` and watch it update. Mark test releases as pre-releases if they must not reach her yet. The `latest/download` URL skips pre-releases, so for a pre-release test use the versioned URL in the override.

### 8. Release

- Release 0.4.0 with `scripts/release.sh 0.4.0`.
- Installed copies of 0.3.0 show their existing banner, which links to the new installer. She installs 0.4.0 by hand this one time.
- From 0.4.0 on, updates install themselves.

## Caveats

- **Mac: microphone permission after each update.** The Mac build is ad-hoc signed (`signingIdentity: "-"`), so every build has a different signature. macOS ties the microphone permission to the signature, so it may ask again after each update. The fix is a stable self-signed certificate (task 9, waiting for James), or later a paid Apple Developer ID. Windows has no such problem.
- **Mac: no Gatekeeper prompt expected.** Files the app downloads itself aren't quarantined, so the updated app opens without the "Open Anyway" step.
- **Windows: SmartScreen.** It usually doesn't warn about an installer the app downloads itself, because there is no Mark of the Web. If it does, the existing "More info › Run anyway" note applies.
- **The website** reads assets ending in `.exe` and `.dmg`. The new `.sig`, `.tar.gz` and `.json` files don't match those, so the download buttons need no change.
