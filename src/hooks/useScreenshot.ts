import { useCallback, useEffect, useMemo, useState } from 'react';
import { listen, invoke, emit } from '@/lib/tauri';
import { debugLog } from '@/lib/utils';
import type { ScreenshotData } from '@/types';

const newestFirst = (screenshots: ScreenshotData[]) =>
  [...screenshots].sort((a, b) => b.timestamp - a.timestamp);

export const useScreenshot = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // True while Save all / Clear all walks the shelf.
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Increments every time the native popup is shown, so the popup can restart
  // its auto-dismiss timer.
  const [showCount, setShowCount] = useState(0);

  const removeLocalScreenshot = useCallback((timestamp: number) => {
    setScreenshots((current) => current.filter((item) => item.timestamp !== timestamp));
  }, []);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    const track = (unlisten: () => void) => {
      if (disposed) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    };

    const setupListeners = async () => {
      try {
        debugLog('Setting up capture shelf listeners...');
        track(await listen('screenshot-data', (data) => {
          debugLog('Received screenshot-data event:', data);
          setScreenshots((current) =>
            newestFirst([data, ...current.filter((item) => item.timestamp !== data.timestamp)]),
          );
          setSelectedTimestamp(data.timestamp);
          setError(null);
          setShowCount((count) => count + 1);
        }));
        // The backend evicts the oldest capture when its cache is full.
        track(await listen('screenshot-evicted', (timestamp) => {
          debugLog('Received screenshot-evicted event:', timestamp);
          removeLocalScreenshot(timestamp);
        }));
        track(await listen('capture-shelf-shown', () => {
          setShowCount((count) => count + 1);
        }));
        if (!disposed) {
          await emit('popup-ready', {});
          debugLog('Emitted popup-ready signal');
        }
      } catch (listenerError) {
        console.error('Failed to setup capture shelf listeners:', listenerError);
        setError('Unable to listen for new captures');
      }
    };

    setupListeners();

    return () => {
      disposed = true;
      unlisteners.splice(0).forEach((unlisten) => unlisten());
    };
  }, [removeLocalScreenshot]);

  useEffect(() => {
    if (screenshots.length === 0) {
      setSelectedTimestamp(null);
      return;
    }

    if (!screenshots.some((item) => item.timestamp === selectedTimestamp)) {
      setSelectedTimestamp(screenshots[0].timestamp);
    }
  }, [screenshots, selectedTimestamp]);

  const currentScreenshot = useMemo(
    () =>
      screenshots.find((item) => item.timestamp === selectedTimestamp) ??
      screenshots[0] ??
      null,
    [screenshots, selectedTimestamp],
  );

  // Save, copy, and delete each finish a capture: the backend drops it from
  // its cache, so it leaves the shelf too.
  const finishScreenshot = async (
    command: 'save_to_disk' | 'copy_to_clipboard' | 'delete_from_memory',
    failureVerb: string,
    screenshot = currentScreenshot,
  ) => {
    if (!screenshot) return;
    setIsLoading(true);
    setError(null);
    try {
      await invoke(command, { timestamp: screenshot.timestamp });
      removeLocalScreenshot(screenshot.timestamp);
    } catch (actionError) {
      console.error(`Failed to ${failureVerb} screenshot:`, actionError);
      setError(`Could not ${failureVerb} ${screenshot.filename}`);
    } finally {
      setIsLoading(false);
    }
  };

  const finishAllScreenshots = async (
    command: 'save_to_disk' | 'delete_from_memory',
    failureVerb: string,
  ) => {
    if (screenshots.length === 0) return;
    setIsLoading(true);
    setIsBatchRunning(true);
    setError(null);
    let failures = 0;
    try {
      for (const screenshot of screenshots) {
        try {
          await invoke(command, { timestamp: screenshot.timestamp });
          removeLocalScreenshot(screenshot.timestamp);
        } catch (actionError) {
          console.error(`Failed to process ${screenshot.filename}:`, actionError);
          failures += 1;
        }
      }
    } finally {
      if (failures > 0) {
        setError(`${failures} capture${failures === 1 ? '' : 's'} could not be ${failureVerb}`);
      }
      setIsBatchRunning(false);
      setIsLoading(false);
    }
  };

  const saveScreenshot = () => finishScreenshot('save_to_disk', 'save');
  const copyScreenshot = () => finishScreenshot('copy_to_clipboard', 'copy');
  const deleteScreenshot = () => finishScreenshot('delete_from_memory', 'delete');
  const saveAllScreenshots = () => finishAllScreenshots('save_to_disk', 'saved');
  const clearAllScreenshots = () => finishAllScreenshots('delete_from_memory', 'cleared');
  const clearError = useCallback(() => setError(null), []);

  const closePopup = useCallback(async () => {
    try {
      await invoke('close_popup_window');
    } catch (closeError) {
      console.error('Failed to close popup:', closeError);
      setError('Unable to hide the capture shelf');
    }
  }, []);

  // The popup hides itself once the shelf is empty; other captures stay visible.
  const openEditor = async (screenshot = currentScreenshot) => {
    if (!screenshot) return;
    setIsLoading(true);
    setError(null);
    try {
      await invoke('open_editor_window', { timestamp: screenshot.timestamp });
      await invoke('delete_from_memory', { timestamp: screenshot.timestamp });
      removeLocalScreenshot(screenshot.timestamp);
    } catch (editorError) {
      console.error('Failed to open editor:', editorError);
      setError(`Could not edit ${screenshot.filename}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testScreenshot = async () => {
    setIsLoading(true);
    try {
      await invoke('capture_screenshot');
    } catch (error) {
      console.error('Failed to test screenshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    screenshots,
    currentScreenshot,
    selectedTimestamp,
    isLoading,
    isBatchRunning,
    error,
    showCount,
    selectScreenshot: setSelectedTimestamp,
    saveScreenshot,
    saveAllScreenshots,
    copyScreenshot,
    deleteScreenshot,
    clearAllScreenshots,
    clearError,
    closePopup,
    openEditor,
    testScreenshot,
  };
};
