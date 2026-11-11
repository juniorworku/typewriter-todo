# Typewriter To-Do

A standalone pixel typewriter task/study tracker with warm paper and dark CRT themes, optional keystroke/carriage sounds, timestamped tasks, and direct two-way Markdown sync.

## Writing and studying

- Type a task or study block and press Enter. Include `#study`, `#reading`, or any other tag in the text.
- Tab / Shift+Tab changes indentation for the next line (up to five levels). Creation time is recorded on submission.
- Click a checkbox, or focus it and press Space/Enter, to complete/reopen a task. Completion adds `[completed:: ...]`; reopening removes that field and retains creation time.
- **EDIT** changes task text while retaining creation and completion fields. Enter saves; Cancel/Escape leaves the note unchanged.
- Ctrl/Cmd+Enter focuses the new-task line. ArrowUp from an empty entry focuses the last task; ArrowUp/Down moves among task checkboxes. Escape returns to the toolbar when writing. Ctrl/Cmd+R refreshes from the vault.
- The active entry/checkbox scrolls into focus. Tab still navigates controls outside the entry; the settings modal keeps keyboard focus inside it while open.
- **KEYS: ON/OFF** toggles local mechanical/chiptune feedback; **CRT MODE / PAPER MODE** changes theme. Preferences persist separately from the vault contents.

Default file: `Study & Tasks/Study-Plan.md` (a pinned study plan):

```markdown
- [ ] Review transformer architecture notes [created:: 2026-11-11 09:15]
  - [x] Sketch attention mechanism [created:: 2026-11-11 09:20] [completed:: 2026-11-11 10:40]
```

The app reads existing task lists and preserves unrelated headings/prose and fenced Markdown examples. It refreshes every **2.5 seconds**, on window focus, and manually. App additions append; edits and checkbox changes compare the original task line, preserve the other lines, recheck the file, and commit through an atomic rename. Stale rows produce a conflict message; refresh and retry. Direct edits/deletions in Obsidian are reflected on refresh.

This is local file sync, not a distributed merge protocol. Avoid simultaneous edits during the small check/rename window: external writers cannot share an atomic transaction with the app. Task rows written externally without a creation field retain their existing metadata; new tasks created in the app always receive one. The app does not change dates or create a new study file at midnight.

The workflow is `.github/workflows/build-mac-typewriter.yml`. Vite's development port is **5174**, so both independent apps can run side by side.

Tests cover nested Markdown tasks, timestamps and edits, stale-edit conflicts, fenced examples, serialization, paths, and config persistence. The Electron smoke test verifies task creation/completion/editing, automatic external refresh, both themes, persisted preferences, and keyboard navigation.

## Linux setup

Requires Node.js **22.12+** (24 LTS recommended) and a graphical Linux desktop. On Ubuntu/Debian, Electron commonly needs `libgtk-3-0`, `libnss3`, `libgbm1`, `libatk-bridge2.0-0`, and `libasound2t64` (`libasound2` on older releases).

From this project directory:

```bash
npm ci
./run-linux.sh
```

For hot reload: `npm run dev`. The launcher checks Node's version, builds, and opens the desktop app. Electron downloads its development runtime on first use. Run as your normal desktop user with the sandbox enabled.

## Obsidian connection

Open **SETUP [+] → CHOOSE FOLDER...**, select the existing vault, adjust the relative subfolder if needed, and click **SAVE SETTINGS**. Canceling the settings window leaves the configuration unchanged. The directory picker is native; Markdown files are written directly, with no Obsidian plugin or cloud service. The application keeps its own config under Electron's per-user `userData/config.json` directory.

The bridge rejects `..`, absolute subfolders, escaping directory symlinks, and symlink notes. IPC is restricted to the app's main frame, Node integration is disabled in the renderer, context isolation and the sandbox are enabled, and only local app assets load.

## Check and package

```bash
npm run lint
npm test
npm run build
npm run package:linux
```

`lint` runs strict TypeScript and backend syntax checks. `test` runs four focused tests using temporary directories. The Linux package command produces an AppImage under `release/`; some distributions require FUSE to open AppImages. `./run-linux.sh` runs without an AppImage.

Optional Linux desktop smoke test (requires Xvfb or a desktop display):

```bash
npm install --no-save --package-lock=false playwright
xvfb-run -a node tests/electron-smoke.cjs
```

The test uses a temporary app profile and vault. It stubs only the native directory dialog's selection; the rest of the flow uses the actual renderer, IPC, and disk writes. In a restricted CI container that cannot support Chromium's sandbox, set `PIXEL_TEST_NO_SANDBOX=1` for this test only. Optional `PIXEL_SCREENSHOT_DIR=/absolute/output/directory` saves screenshots.

## macOS installers

The GitHub Actions workflow runs on every push and on manual dispatch using `macos-latest`. Each run tests and builds separate **arm64 (Apple Silicon)** and **x64 (Intel)** packages and uploads an architecture-specific artifact named `typewriter-todo-mac-arm64` or `typewriter-todo-mac-x64`. Each artifact contains a `.dmg` installer and a `.zip` containing the `.app` bundle. Download either artifact from the successful run's **Artifacts** section.

These packages are **unsigned and not notarized** by default. To install, open the matching DMG and drag **Typewriter To-Do.app** to **Applications**, or unzip the ZIP and move the app to Applications. On first launch, macOS may block the app because it was downloaded from the internet and is not signed. If you trust the download, Control-click the app and choose **Open**, then confirm **Open**; alternatively, after the first blocked launch, open **System Settings → Privacy & Security** and choose **Open Anyway** for Typewriter To-Do. Do not disable Gatekeeper globally.

Optional distribution signing/notarization requires an Apple Developer ID certificate and credentials configured as GitHub Actions secrets (for example `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`), plus enabling the corresponding signing configuration in the workflow. No Apple credentials are stored in this repository. macOS packaging runs remotely; development on Linux uses no Swift, Xcode, or macOS-only APIs.

## Assets and independence

The VT323 pixel font is bundled locally, including its SIL Open Font License in `src/assets/OFL.txt` and `public/VT323-OFL.txt` (copied into the built app). Source: [Google Fonts VT323](https://github.com/google/fonts/tree/main/ofl/vt323). Graphics and sounds are generated locally from code; no remote assets are requested. Reduced-motion preferences disable animation.

This is a self-contained Electron + React + TypeScript project, with its own package lock, app identity, settings, preload API, filesystem bridge, assets, tests, and workflow. It imports nothing from the other productivity app.

## Verification

Verified locally on Linux: strict type/syntax checks, production build, all four focused tests, and a real Electron/Xvfb smoke test with zero renderer errors. Smoke testing covered bundled-font loading, settings persistence through the folder-picker bridge, and Markdown writes. macOS workflows are configured but have not run remotely in this session.

The locked electron-builder packaging toolchain has six moderate dependency advisories from the dependency audit. Review `npm audit` when updating packaging dependencies.
