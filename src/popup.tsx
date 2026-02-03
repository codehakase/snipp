import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ScreenshotPreview } from '@/components/ScreenshotPreview'
import { useScreenshot } from '@/hooks/useScreenshot'
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

  useEffect(() => {
    console.log('PopupApp mounted, currentScreenshot:', currentScreenshot);
  }, [currentScreenshot]);

  useEffect(() => {
    if (!currentScreenshot) return;
    const autoDismissTimer = setTimeout(() => {
      closePopup();
    }, 5000);
    return () => clearTimeout(autoDismissTimer);
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

  const imageUrl = `data:image/png;base64,${currentScreenshot.base64_image}`;

  return (
    <div className="w-full h-full bg-transparent p-2">
      <ScreenshotPreview
        imageUrl={imageUrl}
        onSave={handleSave}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onEdit={openEditor}
        onClose={closePopup}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)