# Snipp

A minimal, elegant screenshot capture tool for macOS, built with Tauri and Rust.
Snipp lets you capture screenshots effortlessly with global hotkeys, saving them directly to your Desktop with clean, timestamped filenames.

<img width="2624" height="1826" alt="Snipp 26-02-05 at 18 26 19" src="https://github.com/user-attachments/assets/01bdcba0-5157-4b33-9012-f11f28395855" />

## Installation

### Download

Download the latest build from the [releases page](https://github.com/codehakase/snipp/releases/tag/tip).

### Build from Source

#### Prerequisites

- macOS 10.15+ 
- Node.js 16+ and npm
- Rust (latest stable)

#### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/codehakase/snipp.git
cd snipp
npm install
```

Build and run in development mode:

```bash
npm run tauri:dev
```

For production build:

```bash
npm run tauri:build
```

## Usage

1. Launch Snipp
2. Press `⌘⇧S` (Cmd+Shift+S) anywhere on your system
3. Drag to select the area you want to capture
4. Release to save the screenshot

Screenshots are automatically saved to your Desktop as `snipp-<timestamp>.png`.

## Features

- **Global Hotkeys**: Capture screenshots from anywhere without focusing the app
- **Interactive Selection**: Uses macOS native screencapture for precise area selection
- **Auto-Save**: Instant saving with timestamped filenames
- **Toast Notifications**: Clean feedback on successful captures
- **Background Operation**: Works seamlessly while other apps are active

## Permissions

Snipp requires the following macOS permissions:

- **Screen Recording**: To capture screenshots
- **Accessibility**: To register global shortcuts

## Acknowledgements
Created by Francis Sunday ([@codehakase](https://x.com/codehakase)). Licensed under the [MIT license](https://github.com/codehakase/snipp/blob/main/LICENSE).
