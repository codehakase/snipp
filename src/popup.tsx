import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ChevronDown, ChevronUp, Layers3 } from 'lucide-react'
import { ScreenshotPreview } from '@/components/ScreenshotPreview'
import { useScreenshot } from '@/hooks/useScreenshot'
import { invoke } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import type { ScreenshotData } from '@/types'
import '@/styles.css'

const AUTO_DISMISS_MS = 5000

const getImageUrl = (screenshot: ScreenshotData) =>
  `data:image/png;base64,${screenshot.base64_image}`

function PopupApp() {
  const {
    screenshots,
    currentScreenshot,
    selectedTimestamp,
    isLoading,
    isBatchRunning,
    error,
    showCount,
    selectScreenshot,
    saveScreenshot,
    saveAllScreenshots,
    copyScreenshot,
    deleteScreenshot,
    clearAllScreenshots,
    clearError,
    openEditor,
    closePopup,
  } = useScreenshot();

  const [dragFilePath, setDragFilePath] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const hadScreenshotsRef = useRef(false);
  const isShelfOpen = isExpanded && screenshots.length > 1;

  useEffect(() => {
    if (screenshots.length > 0) {
      hadScreenshotsRef.current = true;
      return;
    }

    if (hadScreenshotsRef.current) {
      hadScreenshotsRef.current = false;
      closePopup();
    }
  }, [screenshots.length, closePopup]);

  // Skip drag files during Save all / Clear all: each capture is selected only
  // briefly before it leaves the shelf.
  useEffect(() => {
    if (!currentScreenshot || isBatchRunning) {
      setDragFilePath(null);
      return;
    }

    let cancelled = false;
    let filePrepared = false;
    const prepare = async () => {
      try {
        const path = await invoke('prepare_drag_file', { timestamp: currentScreenshot.timestamp });
        if (cancelled) {
          invoke('cleanup_drag_file', { timestamp: currentScreenshot.timestamp }).catch(() => {});
          return;
        }
        filePrepared = true;
        setDragFilePath(path);
      } catch (prepareError) {
        console.error('Failed to prepare drag file:', prepareError);
      }
    };
    prepare();
    return () => {
      cancelled = true;
      if (filePrepared) {
        invoke('cleanup_drag_file', { timestamp: currentScreenshot.timestamp }).catch(() => {});
      }
    };
  }, [currentScreenshot, isBatchRunning]);

  // Each time the popup is shown, hide it after a quiet period unless the
  // user clicks it. Pending captures stay on the shelf while hidden.
  useEffect(() => {
    if (showCount === 0) return;
    const autoDismissTimer = setTimeout(closePopup, AUTO_DISMISS_MS);
    const cancelTimer = () => clearTimeout(autoDismissTimer);
    document.addEventListener('pointerdown', cancelTimer, { once: true });
    return () => {
      clearTimeout(autoDismissTimer);
      document.removeEventListener('pointerdown', cancelTimer);
    };
  }, [showCount, closePopup]);

  useEffect(() => {
    if (screenshots.length <= 1) setIsExpanded(false);
  }, [screenshots.length]);

  // The window has a fixed height with no room for the error banner above an
  // open shelf, so collapse the shelf to show the error.
  useEffect(() => {
    if (error) setIsExpanded(false);
  }, [error]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closePopup]);

  const selectedIndex = useMemo(
    () => screenshots.findIndex((item) => item.timestamp === selectedTimestamp),
    [screenshots, selectedTimestamp],
  );

  const toggleShelf = () => {
    if (!isExpanded) clearError();
    setIsExpanded((expanded) => !expanded);
  };

  if (!currentScreenshot) {
    return null;
  }

  return (
    <main className="fixed bottom-3 left-3 flex w-[316px] flex-col items-start gap-2 bg-transparent">
      {error && !isShelfOpen && (
        <div
          className="w-full rounded-xl border border-red-300/70 bg-red-50/95 px-3 py-2 text-xs font-medium text-red-700 shadow-lg backdrop-blur"
          role="alert"
        >
          {error}
        </div>
      )}

      {isShelfOpen && (
        <section
          data-testid="capture-shelf"
          className="w-full rounded-2xl border border-white/50 bg-white/90 p-2.5 shadow-2xl backdrop-blur-xl"
          aria-label="Capture shelf"
        >
          <div className="mb-2 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Layers3 size={14} className="text-neutral-700" />
              <span className="text-xs font-semibold text-neutral-800">Capture shelf</span>
              <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {screenshots.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Collapse capture shelf"
            >
              <ChevronDown size={15} />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Pending captures">
            {screenshots.map((screenshot, index) => {
              const isSelected = screenshot.timestamp === selectedTimestamp;
              return (
                <button
                  key={screenshot.timestamp}
                  type="button"
                  onClick={() => selectScreenshot(screenshot.timestamp)}
                  className={cn(
                    'group relative h-14 w-[76px] shrink-0 overflow-hidden rounded-lg border-2 bg-neutral-100 transition',
                    isSelected
                      ? 'border-orange-500 shadow-md'
                      : 'border-transparent opacity-75 hover:opacity-100',
                  )}
                  aria-label={`Select capture ${index + 1}: ${screenshot.filename}`}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <span
                    className="block h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url("${getImageUrl(screenshot)}")` }}
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2">
            <span className="max-w-[132px] truncate text-[10px] text-neutral-500">
              {selectedIndex + 1} of {screenshots.length}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={clearAllScreenshots}
                disabled={isLoading}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={saveAllScreenshots}
                disabled={isLoading}
                className="rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                Save all
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="relative h-[170px] w-[194px]">
        {screenshots.length > 2 && (
          <div className="absolute bottom-0 left-4 h-[154px] w-[176px] rotate-2 rounded-2xl border border-white/80 bg-neutral-300 shadow-lg" />
        )}
        {screenshots.length > 1 && (
          <div className="absolute bottom-1 left-2 h-[158px] w-[176px] -rotate-1 rounded-2xl border border-white/80 bg-neutral-200 shadow-xl" />
        )}
        <ScreenshotPreview
          className="absolute bottom-2 left-0 z-20"
          imageUrl={getImageUrl(currentScreenshot)}
          dragFilePath={dragFilePath ?? undefined}
          onSave={() => saveScreenshot()}
          onCopy={() => copyScreenshot()}
          onDelete={() => deleteScreenshot()}
          onEdit={() => openEditor()}
          isLoading={isLoading}
        />

        {screenshots.length > 1 && (
          <button
            type="button"
            onClick={toggleShelf}
            className="absolute left-[184px] top-2 z-30 flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full border-2 border-white bg-neutral-900 px-2 text-xs font-bold text-white shadow-xl transition hover:scale-105 hover:bg-orange-600"
            aria-label={isExpanded ? 'Collapse capture shelf' : `Show ${screenshots.length} captures`}
            aria-expanded={isExpanded}
          >
            {screenshots.length}
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        )}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)
