import { useState, useEffect } from 'react';
import { listen, invoke, emit } from '@/lib/tauri';
import { debugLog } from '@/lib/utils';
import type { ScreenshotData } from '@/types';

export const useScreenshot = () => {
  const [currentScreenshot, setCurrentScreenshot] = useState<ScreenshotData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const setupListener = async () => {
      try {
        debugLog('Setting up screenshot-data listener...');
        const unlisten = await listen('screenshot-data', (data) => {
          debugLog('Received screenshot-data event:', data);
          setCurrentScreenshot(data);
        });
        debugLog('Screenshot listener setup successfully');
        await emit('popup-ready', {});
        debugLog('Emitted popup-ready signal');
        return unlisten;
      } catch (error) {
        console.error('Failed to setup screenshot listener:', error);
      }
    };

    let unlisten: (() => void) | undefined;
    setupListener().then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const saveScreenshot = async () => {
    if (!currentScreenshot) return;
    setIsLoading(true);
    try {
      await invoke('save_to_disk', { timestamp: currentScreenshot.timestamp });
    } catch (error) {
      console.error('Failed to save screenshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyScreenshot = async () => {
    if (!currentScreenshot) return;
    setIsLoading(true);
    try {
      await invoke('copy_to_clipboard', { timestamp: currentScreenshot.timestamp });
    } catch (error) {
      console.error('Failed to copy screenshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteScreenshot = async () => {
    if (!currentScreenshot) return;
    setIsLoading(true);
    try {
      await invoke('delete_from_memory', { timestamp: currentScreenshot.timestamp });
      setCurrentScreenshot(null);
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closePopup = async () => {
    try {
      await invoke('close_popup_window');
    } catch (error) {
      console.error('Failed to close popup:', error);
    }
  };

  const openEditor = async () => {
    if (!currentScreenshot) return;
    setIsLoading(true);
    try {
      await invoke('open_editor_window', { timestamp: currentScreenshot.timestamp });
      await invoke('close_popup_window');
    } catch (error) {
      console.error('Failed to open editor:', error);
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
    currentScreenshot,
    isLoading,
    saveScreenshot,
    copyScreenshot,
    deleteScreenshot,
    closePopup,
    openEditor,
    testScreenshot,
  };
};
