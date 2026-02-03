export interface ScreenshotData {
  base64_image: string;
  filename: string;
  timestamp: number;
  file_path: string | null;
}

export interface EditorData {
  base64_image: string;
  filename?: string;
  timestamp: number;
  file_path?: string | null;
}

export interface AppConfig {
  default_save_location: string;
  capture_hotkey: string;
  preferences_hotkey: string;
  auto_copy_after_capture: boolean;
  auto_copy_after_edit: boolean;
}

export interface TauriCommand {
  save_to_disk: (args: { timestamp: number }) => Promise<string>;
  copy_to_clipboard: (args: { timestamp: number }) => Promise<void>;
  delete_from_memory: (args: { timestamp: number }) => Promise<void>;
  close_popup_window: () => Promise<void>;
  close_editor_window: () => Promise<void>;
  open_editor_window: (args: { timestamp: number }) => Promise<void>;
  hide_window: () => Promise<void>;
  show_window: () => Promise<void>;
  capture_screenshot: () => Promise<ScreenshotData>;
  capture_full_screen: () => Promise<ScreenshotData>;
  open_preferences: () => Promise<void>;
  open_preferences_window: () => Promise<void>;
  close_preferences_window: () => Promise<void>;
  get_config: () => Promise<AppConfig>;
  update_config: (args: { newConfig: AppConfig }) => Promise<void>;
  choose_save_location: () => Promise<string | null>;
  save_edited_screenshot: (args: { base64Image: string; timestamp: number }) => Promise<string>;
  copy_edited_screenshot: (args: { base64Image: string; timestamp: number }) => Promise<void>;
  get_recent_screenshots: () => Promise<Array<Record<string, unknown>>>;
  copy_screenshot_from_path: (args: { filePath: string }) => Promise<void>;
  open_in_finder: (args: { filePath: string }) => Promise<void>;
  delete_screenshot: (args: { filePath: string }) => Promise<void>;
  close_recent_window: () => Promise<void>;
}

export interface TauriEvent {
  'screenshot-data': ScreenshotData;
  'editor-data': EditorData;
  'screenshot-saved': { path: string };
  'screenshot-copied': {};
  'screenshot-deleted': {};
}

declare global {
  interface Window {
    __TAURI__: {
      core: {
        invoke: <T extends keyof TauriCommand>(
          command: T,
          args?: Parameters<TauriCommand[T]>[0]
        ) => ReturnType<TauriCommand[T]>;
      };
      event: {
        listen: <T extends keyof TauriEvent>(
          event: T,
          handler: (event: { payload: TauriEvent[T] }) => void
        ) => Promise<() => void>;
      };
    };
  }
}
