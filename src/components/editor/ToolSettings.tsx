import { ColorPicker } from './ColorPicker';
import type { ToolType } from './EditorApp';

interface ToolSettingsProps {
  tool: ToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
}

export function ToolSettings({
  tool,
  color,
  strokeWidth,
  fontSize,
  onColorChange,
  onStrokeWidthChange,
  onFontSizeChange,
}: ToolSettingsProps) {
  const showColorPicker = tool !== 'select';
  const showStrokeWidth = ['rect', 'ellipse', 'arrow', 'line'].includes(tool);
  const showFontSize = tool === 'text';

  if (tool === 'select') {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-400">
          Click and drag to select objects. Press Delete to remove.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {showColorPicker && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Color</span>
          <ColorPicker color={color} onChange={onColorChange} />
        </div>
      )}

      {showStrokeWidth && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Stroke</span>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="w-20 h-1 bg-neutral-600 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-xs text-neutral-300 w-6">{strokeWidth}px</span>
        </div>
      )}

      {showFontSize && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Size</span>
          <input
            type="range"
            min="12"
            max="72"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="w-20 h-1 bg-neutral-600 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-xs text-neutral-300 w-6">{fontSize}px</span>
        </div>
      )}

      {tool === 'blur' && (
        <span className="text-sm text-neutral-400">
          Draw rectangles to pixelate sensitive content
        </span>
      )}
    </div>
  );
}
