import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ScreenshotPreview } from '@/components/ScreenshotPreview'
import { useScreenshot } from '@/hooks/useScreenshot'
import { invoke } from '@/lib/tauri'
import '@/styles.css'

function PopupApp() {
  const {
    currentScreenshot,
    saveScreenshot,
    copyScreenshot,
    deleteScreenshot,
    openEditor,
    closePopup
  } = useScreenshot();

  const [dragFilePath, setDragFilePath] = useState<string | null>(null);

  useEffect(() => {
    console.log('PopupApp mounted, currentScreenshot:', currentScreenshot);
  }, [currentScreenshot]);

  useEffect(() => {
    if (!currentScreenshot) return;
    let cancelled = false;
    const prepare = async () => {
      try {
        const path = await invoke('prepare_drag_file', { timestamp: currentScreenshot.timestamp });
        if (cancelled) return;
        setDragFilePath(path);
      } catch (err) {
        console.error('Failed to prepare drag file:', err);
      }
    };
    prepare();
    return () => {
      cancelled = true;
      invoke('cleanup_drag_file', { timestamp: currentScreenshot.timestamp }).catch(() => {});
    };
  }, [currentScreenshot]);

  useEffect(() => {
    if (!currentScreenshot) return;
    const autoDismissTimer = setTimeout(() => {
      closePopup();
    }, 5000);
    const cancelTimer = () => clearTimeout(autoDismissTimer);
    document.addEventListener('pointerdown', cancelTimer, { once: true });
    return () => {
      clearTimeout(autoDismissTimer);
      document.removeEventListener('pointerdown', cancelTimer);
    };
  }, [currentScreenshot, closePopup]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closePopup]);

  const handleSave = async () => {
    await saveScreenshot();
    setTimeout(closePopup, 200);
  };

  const handleCopy = async () => {
    await copyScreenshot();
    setTimeout(closePopup, 200);
  };

  const handleDelete = async () => {
    await deleteScreenshot();
    setTimeout(closePopup, 200);
  };

  if (!currentScreenshot) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-transparent">
        <div className="text-muted-foreground">Loading screenshot...</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-transparent">
      <ScreenshotPreview
        imageUrl={`data:image/png;base64,${currentScreenshot.base64_image}`}
        dragFilePath={dragFilePath ?? undefined}
        onSave={handleSave}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onEdit={openEditor}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)