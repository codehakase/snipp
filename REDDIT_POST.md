# /rust Subreddit Post

## [ANN] Snipp - A minimal screenshot tool built with Tauri and Rust

I've been working on a small project over the past few weeks that scratches a personal itch: a lightweight screenshot capture tool for macOS that actually stays out of your way.

**Snipp** is a global hotkey screenshot utility built with Tauri (on the Rust side) and a minimal frontend. The idea is straightforward—press `⌘⇧S` from anywhere, drag to select your region, and the screenshot is automatically saved to your Desktop with a clean timestamped filename. No dialogs, no "save as" prompts, no friction.

### Why I built this

I realized I was constantly switching between default macOS Screenshot, third-party apps, and clipboard management. What I wanted was something that just *worked*—capture an image with a hotkey, and it's done. The global hotkey functionality was the trickier part here; it requires tapping into macOS's accessibility APIs, which Tauri handles pretty cleanly.

### What's in the box

- **Global hotkey registration** - Works from anywhere, even if the app isn't in focus
- **Interactive selection** - Uses macOS native screencapture for the selection UI
- **Automatic saving** - Timestamps are generated on capture, files go straight to Desktop
- **Toast notifications** - You get feedback when a screenshot is saved
- **Background operation** - Runs without consuming resources or getting in the way

### Current state

The project is open source (MIT licensed) and on [GitHub](https://github.com/codehakase/snipp). It's in early stages, and I'm looking for people willing to test it out and provide feedback—especially around edge cases, permission handling, and general usability.

If you're interested in contributing, there's definitely room. The Rust side is fairly clean, and the frontend is minimal enough that anyone familiar with web dev can jump in.

You can grab the latest binary from the [releases page](https://github.com/codehakase/snipp/releases/tag/tip), or build from source if you prefer (just needs Node.js, Rust, and macOS 10.15+).

I'd be curious to hear what you think, and if anyone runs into issues or has ideas for improvements, I'm listening.

---

[GitHub](https://github.com/codehakase/snipp) | [MIT License](https://github.com/codehakase/snipp/blob/main/LICENSE)

---

## Image Suggestions

For a /rust post, you have a few solid directions:

1. **Clean product demo** - A simple screenshot showing the app UI with the hotkey overlay and selection interface. Dark background, clear typography highlighting `⌘⇧S`. This is what you already have in the README.

2. **Before/after workflow** - Left side shows the complexity of existing tools (multiple apps, dialogs, clipboard chaos), right side shows Snipp's simplicity. This visual tells the story of why it exists.

3. **Technical architecture diagram** - Shows Tauri in the middle, Rust backend on one side, frontend on the other, with arrows pointing to macOS APIs (accessibility, screencapture). This appeals to the /rust crowd who cares about the implementation.

4. **Minimalist flat design** - A single icon or illustration that represents "capture → save → done" in 3 clean steps. Very design-forward but technical-feeling.

**Recommendation**: Go with option 2 (before/after workflow) or a clean, minimal version of your existing demo. The /rust audience appreciates seeing what the tool actually does, and they're less impressed by abstract technical diagrams. They want to understand the user problem first, then they'll care about your Rust implementation.
