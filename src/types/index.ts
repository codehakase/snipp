export interface ScreenshotData {
  base64_image: string;
  timestamp: number;
}

export interface EditorData {
  base64_image: string;
  timestamp: number;
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
  capture_screenshot: () => Promise<void>;
  open_preferences: () => Promise<void>;
  save_edited_screenshot: (args: { base64Image: string; timestamp: number }) => Promise<string>;
  copy_edited_screenshot: (args: { base64Image: string; timestamp: number }) => Promise<void>;
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
