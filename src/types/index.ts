export interface ScreenshotData {
  base64_image: string;
  timestamp: string;
}

export interface TauriCommand {
  save_to_disk: (args: { timestamp: string }) => Promise<void>;
  copy_to_clipboard: (args: { timestamp: string }) => Promise<void>;
  delete_from_memory: (args: { timestamp: string }) => Promise<void>;
  close_popup_window: () => Promise<void>;
  hide_window: () => Promise<void>;
  show_window: () => Promise<void>;
  capture_screenshot: () => Promise<void>;
  open_preferences: () => Promise<void>;
}

export interface TauriEvent {
  'screenshot-data': ScreenshotData;
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
