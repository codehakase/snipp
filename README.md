# Snipp

<p align="center">
  <img src="https://github.com/user-attachments/assets/58365e51-8d8f-44bd-a41a-ee094d547193" alt="ZenNotes app icon" width="160">
</p>

Snipp is a lightweight macOS screenshot tool for capturing, previewing, copying, saving, and annotating screenshots without interrupting your workflow.

Built with Tauri, Rust, React, TypeScript, and Fabric.js.

<img width="2624" height="1826" alt="Snipp screenshot capture and annotation interface" src="https://github.com/user-attachments/assets/01bdcba0-5157-4b33-9012-f11f28395855" />

## Features

- Capture a selected area with a configurable global shortcut
- Capture the full screen from the menu bar or settings window
- Preview each capture before saving it
- Copy, save, edit, delete, or drag captures into another application
- Annotate screenshots with rectangles, ellipses, arrows, lines, text, and redaction
- Undo and redo editor changes
- Add padding, backgrounds, gradients, and rounded corners
- Choose a custom save location
- Automatically copy captures or edited images to the clipboard
- Continue running from the macOS menu bar

## Installation

### Download a nightly build

> [!WARNING]
> Snipp does not currently have a stable release. The `tip` release is an automatically generated prerelease built from the latest commit on `main`.

Download the appropriate DMG from the [Snipp tip release](https://github.com/codehakase/snipp/releases/tag/tip):

- `aarch64` for Apple Silicon Macs
- `x64` for Intel Macs

Open the DMG and drag Snipp into your Applications folder.

The current builds are not notarized. If macOS blocks the application after installation, remove its quarantine attribute:

```bash
xattr -d com.apple.quarantine /Applications/Snipp.app
```

Only do this for a build downloaded from the official Snipp repository.

### Build from source

#### Prerequisites

- macOS
- Node.js 20.19+ or 22.12+
- npm
- Latest stable Rust toolchain
- Xcode Command Line Tools

Install the Xcode Command Line Tools if needed:

```bash
xcode-select --install
```

Clone the repository and install its dependencies:

```bash
git clone https://github.com/codehakase/snipp.git
cd snipp
npm ci
```

Run Snipp in development mode:

```bash
npm run tauri:dev
```

Create a production build:

```bash
npm run tauri:build
```

Build artifacts are written under `src-tauri/target/release/bundle/`.

## Usage

### Capture an area

1. Launch Snipp. It will continue running in the macOS menu bar.
2. Press `⌃⇧S` (`Ctrl+Shift+S`) by default.
3. Drag to select an area of the screen.
4. Use the preview to:
   - **Copy** the image to the clipboard
   - **Save** it to the configured folder
   - **Edit** it in the annotation editor
   - **Delete** it
   - Drag it directly into another application

The preview closes automatically after a few seconds if it is not used. A capture is not written permanently to disk until you choose **Save** or save it from the editor.

### Capture the full screen

Open the Snipp menu bar menu and choose **Capture Full Screen**, or open Snipp and use the corresponding quick action.

## Permissions

Snipp requires macOS **Screen Recording** permission to capture the screen.

On first use, allow Snipp under:

**System Settings → Privacy & Security → Screen Recording**

Restart Snipp if macOS asks you to do so.

## Development

Run the frontend checks and build:

```bash
npm test
npm run build
```

Run the Rust tests:

```bash
cd src-tauri
cargo test
```

## Reporting issues

- [Report a bug](https://github.com/codehakase/snipp/issues/new)
- [Request a feature](https://github.com/codehakase/snipp/issues/new)

## License

Snipp was created by Francis Sunday ([@codehakase](https://x.com/codehakase)) and is available under the [MIT License](LICENSE).
