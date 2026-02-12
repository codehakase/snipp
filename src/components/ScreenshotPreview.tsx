import { useState, useCallback, useRef } from 'react';
import { Save, Copy, Trash2, X, Pencil } from 'lucide-react';
import { cn, debugLog } from '@/lib/utils';
import { useScreenshot } from '@/hooks/useScreenshot';
import { startDrag } from '@crabnebula/tauri-plugin-drag';

interface ScreenshotPreviewProps {
  imageUrl: string;
  dragFilePath?: string;
  onSave?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  className?: string;
}

export function ScreenshotPreview({
  imageUrl,
  dragFilePath,
  onSave,
  onCopy,
  onDelete,
  onEdit,
  onClose,
  className
}: ScreenshotPreviewProps) {
  const [showActions, setShowActions] = useState(false);
  const { isLoading } = useScreenshot();

  const DRAG_THRESHOLD = 5;
  const dragStateRef = useRef<{ startX: number; startY: number; pending: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !dragFilePath) return;
    if ((e.target as HTMLElement).closest('button')) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, pending: true };
  }, [dragFilePath]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state?.pending || !dragFilePath) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragStateRef.current = null;
      startDrag({ item: [dragFilePath], icon: dragFilePath }).catch((err) => {
        debugLog('Native drag failed:', err);
      });
    }
  }, [dragFilePath]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <div 
      className={cn(
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
        className
      )}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="relative w-[300px] rounded-lg overflow-hidden shadow-2xl group"
        style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Close preview"
          title="Close (Esc)"
        >
          <X size={12} className="text-white" />
        </button>

        <div className={cn(
          "relative select-none",
          dragFilePath ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}>
          <div
            className="w-full aspect-video bg-center bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url("${imageUrl}")`,
              WebkitUserDrag: 'none',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties}
            role="img"
            aria-label="Screenshot preview"
          />

          <div 
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
              showActions ? "opacity-100" : "opacity-0"
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-lg shadow-lg">
              <button
                onClick={onEdit}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-500/50 transition-colors disabled:opacity-50"
                aria-label="Edit screenshot"
                title="Edit & Annotate"
              >
                <Pencil size={16} className="text-white" />
              </button>

              <button
                onClick={onSave}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors disabled:opacity-50"
                aria-label="Save screenshot"
                title="Save to Desktop"
              >
                <Save size={16} className="text-white" />
              </button>

              <button
                onClick={onCopy}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors disabled:opacity-50"
                aria-label="Copy screenshot"
                title="Copy to Clipboard"
              >
                <Copy size={16} className="text-white" />
              </button>

              <button
                onClick={onDelete}
                disabled={isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-500/50 transition-colors disabled:opacity-50"
                aria-label="Delete screenshot"
                title="Delete Screenshot"
              >
                <Trash2 size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
