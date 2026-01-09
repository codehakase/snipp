import { useRef, useState } from 'react';
import { Save, Copy, Trash2, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScreenshot } from '@/hooks/useScreenshot';

interface ScreenshotPreviewProps {
  imageUrl: string;
  onSave?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  className?: string;
}

export function ScreenshotPreview({
  imageUrl,
  onSave,
  onCopy,
  onDelete,
  onEdit,
  onClose,
  className
}: ScreenshotPreviewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [showActions, setShowActions] = useState(false);
  const { isLoading } = useScreenshot();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/uri-list", imageUrl);
    e.dataTransfer.setData("text/plain", imageUrl);

    if (imageRef.current) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = imageRef.current;

      const scale = 0.3;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;

      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const dragImage = new Image();
            dragImage.src = url;
            e.dataTransfer.setDragImage(dragImage, 0, 0);
          }
        });
      }
    }
  };

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
        className="relative w-64 rounded-lg overflow-hidden shadow-2xl group"
        draggable
        onDragStart={handleDragStart}
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

        <div className="relative cursor-move">
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Screenshot preview"
            className="w-full h-auto object-contain block"
            crossOrigin="anonymous"
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