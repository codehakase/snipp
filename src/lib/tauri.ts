import type { TauriCommand, TauriEvent } from '@/types';

export const invoke = async <T extends keyof TauriCommand>(
  command: T,
  args?: Parameters<TauriCommand[T]>[0]
): Promise<ReturnType<TauriCommand[T]>> => {
  if (!window.__TAURI__?.core) {
    throw new Error('Tauri API not available');
  }
  return window.__TAURI__.core.invoke(command, args);
};

export const listen = async <T extends keyof TauriEvent>(
  event: T,
  handler: (payload: TauriEvent[T]) => void
): Promise<() => void> => {
  if (!window.__TAURI__?.event) {
    throw new Error('Tauri Event API not available');
  }
  return window.__TAURI__.event.listen(event, (event) => handler(event.payload));
};

export const emit = async <T extends keyof TauriEvent>(
  event: T,
  payload?: TauriEvent[T]
): Promise<void> => {
  if (!window.__TAURI__?.event) {
    throw new Error('Tauri Event API not available');
  }
  return window.__TAURI__.event.emit(event, payload);
};