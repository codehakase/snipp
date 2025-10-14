import { useState, useEffect } from 'react';
import { listen, invoke } from '@/lib/tauri';
import type { ScreenshotData } from '@/types';

export const useScreenshot = () => {
  const [currentScreenshot, setCurrentScreenshot] = useState<ScreenshotData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const setupListener = async () => {
      try {
        console.log('Setting up screenshot-data listener...');
        const unlisten = await listen('screenshot-data', (data) => {
          console.log('Received screenshot-data event:', data);
          setCurrentScreenshot(data);
        });
        console.log('Screenshot listener setup successfully');
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
    testScreenshot,
  };
};
