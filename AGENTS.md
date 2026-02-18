# AGENTS.md

Project agent guidelines for Snipp (Rust + Tauri + React).

## Git
- Use `git commit -S -m` for all commits (fish alias: `gc`). Commits must be GPG-signed.
- Do NOT add co-author trailers, Amp thread IDs, or any agent metadata to commit messages.

## GitHub
- Always use the `gh` CLI to fetch issues, PRs, and other GitHub data (e.g. `gh issue view 7`). Do not scrape via `read_web_page`.

## General
- Prefer small, focused changes; keep diffs readable and reversible.
- Keep command names and event names consistent across Rust and TypeScript.
- Avoid hard-coded shortcuts, paths, and feature flags; read from config.
- Keep UI logs behind a debug flag; avoid console noise in production builds.
- Use ASCII-only content unless the file already uses Unicode.

## Rust
- Use `Result<T, E>` with clear error messages; avoid `unwrap` and `expect` outside tests.
- Favor `thiserror` or custom error enums for command failures and IO issues.
- Keep Tauri commands thin; move logic into helper modules for testability.
- Avoid blocking the async runtime; offload heavy work to threads.
- Keep macOS-only code behind `#[cfg(target_os = "macos")]`.
- For file IO, validate paths and create directories safely.

## Tauri
- Match every Rust command in `invoke_handler` with a TS definition and UI usage.
- When updating global shortcuts, unregister previous bindings before re-registering.
- Keep window creation centralized; enforce single-instance for popup/editor/preferences.
- Prefer Tauri APIs over shell commands when possible.
- Use the clipboard plugin or platform APIs for image data, not AppleScript when feasible.

## React/TypeScript
- Keep hooks side-effect free; isolate Tauri calls in hooks or services.
- Treat event payloads as typed data; validate or narrow before use.
- Ensure editor state updates are idempotent and resilient to out-of-order events.
- Avoid global listeners without cleanup; always unregister on unmount.

## Testing & QA
- Cover config schema migration with tests.
- Add manual verification steps for capture -> popup -> editor flows.
- Validate on Retina and external displays with different scale factors.
- Verify OCR output, clipboard results, and hotkey registration after preferences changes.

## Learnings

### Vite Environment Variables
- **Issue #20**: `process.env` is not available in Vite browser apps. The idomatic check is `import.meta.env.DEV`.
- When using `import.meta.env`, ensure `src/vite-env.d.ts` exists with `/// <reference types="vite/client" />` for proper TypeScript support.
