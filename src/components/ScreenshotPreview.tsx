import { useState, useCallback, useRef } from 'react';
import { Trash2, Pencil } from 'lucide-react';
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
  className?: string;
}

export function ScreenshotPreview({
  imageUrl,
  dragFilePath,
  onSave,
  onCopy,
  onDelete,
  onEdit,
  className
}: ScreenshotPreviewProps) {
  const [showActions, setShowActions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { isLoading } = useScreenshot();

  const DRAG_THRESHOLD = 5;
  const dragStateRef = useRef<{ startX: number; startY: number; pending: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !dragFilePath || isDragging) return;
    if ((e.target as HTMLElement).closest('button')) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, pending: true };
  }, [dragFilePath, isDragging]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state?.pending || !dragFilePath || isDragging) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      setIsDragging(true);
      startDrag({ item: [dragFilePath], icon: dragFilePath })
        .then(() => {
          debugLog('Drag completed successfully');
        })
        .catch((err) => {
          debugLog('Native drag failed:', err);
        })
        .finally(() => {
          setIsDragging(false);
          dragStateRef.current = null;
        });
    }
  }, [dragFilePath, isDragging]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const handlePointerCancel = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  return (
    <div className={className}>
      <div
        className="relative w-[176px] h-[160px] rounded-2xl overflow-hidden shadow-2xl group animate-in zoom-in-95 fade-in duration-200"
        style={{ WebkitUserDrag: 'none' } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={() => !isDragging && setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Delete button - top right */}
        <button
          onClick={onDelete}
          disabled={isDragging}
          className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-black hover:bg-red-50 hover:border-red-500 hover:scale-110 transition-all duration-200 disabled:opacity-50"
          aria-label="Delete screenshot"
          title="Delete"
        >
          <Trash2 size={14} className="text-black" />
        </button>

        {/* Edit button - top left */}
        <button
          onClick={onEdit}
          disabled={isLoading || isDragging}
          className="absolute top-2 left-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-black hover:bg-blue-50 hover:border-blue-500 hover:scale-110 transition-all duration-200 disabled:opacity-50"
          aria-label="Edit screenshot"
          title="Edit"
        >
          <Pencil size={14} className="text-black" />
        </button>

        {/* Image container with drag support */}
        <div className={cn(
          "relative w-full h-full select-none",
          dragFilePath && !isDragging ? "cursor-grab" : "",
          isDragging ? "cursor-grabbing" : "",
          !dragFilePath ? "cursor-default" : ""
        )}>
          <div
            className="w-full h-full bg-center bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url("${imageUrl}")`,
              WebkitUserDrag: 'none',
              WebkitTouchCallout: 'none',
            } as React.CSSProperties}
            role="img"
            aria-label="Screenshot preview"
          />

          {/* Hover overlay with Copy and Save actions */}
          <div 
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm transition-opacity duration-200",
              showActions ? "opacity-100" : "opacity-0"
            )}
          >
            <button
              onClick={onCopy}
              disabled={isLoading || isDragging}
              className="flex items-center justify-center px-5 py-1.5 bg-white text-black rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50"
              aria-label="Copy to clipboard"
              title="Copy"
            >
              <span className="text-xs font-medium">Copy</span>
            </button>

            <button
              onClick={onSave}
              disabled={isLoading || isDragging}
              className="flex items-center justify-center px-5 py-1.5 bg-white text-black rounded-full hover:bg-white/90 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-50"
              aria-label="Save screenshot"
              title="Save"
            >
              <span className="text-xs font-medium">Save</span>
            </button>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Drag indicator overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-white text-black px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
              Release to drag
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
