import { ColorPicker } from './ColorPicker';

interface PaddingControlsProps {
  padding: { top: number; right: number; bottom: number; left: number };
  backgroundColor: string;
  borderRadius: number;
  zoom: number;
  onPaddingChange: (padding: { top: number; right: number; bottom: number; left: number }) => void;
  onBackgroundColorChange: (color: string) => void;
  onBorderRadiusChange: (radius: number) => void;
  onZoomChange: (zoom: number) => void;
}

const paddingPresets = [
  { label: 'None', value: 0 },
  { label: 'S', value: 16 },
  { label: 'M', value: 32 },
  { label: 'L', value: 64 },
  { label: 'XL', value: 96 },
];

const borderRadiusPresets = [
  { label: 'None', value: 0 },
  { label: 'S', value: 8 },
  { label: 'M', value: 16 },
  { label: 'L', value: 24 },
  { label: 'XL', value: 32 },
];

const backgroundPresets = [
  { color: '#ffffff', label: 'White' },
  { color: '#f5f5f5', label: 'Light Gray' },
  { color: '#1a1a1a', label: 'Dark' },
  { color: '#000000', label: 'Black' },
  { color: 'transparent', label: 'None' },
  { color: '#0066ff', label: 'Blue' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#10b981', label: 'Green' },
];

// Gradient presets
const gradientPresets = [
  { value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: 'Purple Blue' },
  { value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', label: 'Pink Red' },
  { value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: 'Blue Cyan' },
  { value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', label: 'Green Teal' },
  { value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: 'Pink Yellow' },
  { value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', label: 'Soft Pastel' },
  { value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', label: 'Warm Pink' },
  { value: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)', label: 'Dark Teal' },
];

const zoomPresets = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1 },
  { label: '200%', value: 2 },
];

export function PaddingControls({
  padding,
  backgroundColor,
  borderRadius,
  zoom,
  onPaddingChange,
  onBackgroundColorChange,
  onBorderRadiusChange,
  onZoomChange,
}: PaddingControlsProps) {
  const isUniform =
    padding.top === padding.right &&
    padding.right === padding.bottom &&
    padding.bottom === padding.left;

  const handleUniformPadding = (value: number) => {
    onPaddingChange({ top: value, right: value, bottom: value, left: value });
  };

  const isGradient = backgroundColor.startsWith('linear-gradient');

  return (
    <div className="space-y-6">
      {/* Zoom Section */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Zoom</h3>
        <div className="flex gap-1 mb-3">
          {zoomPresets.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => onZoomChange(value)}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                Math.abs(zoom - value) < 0.01
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="flex-1 h-1 bg-neutral-600 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-xs text-neutral-300 w-12 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Padding Section */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Padding</h3>

        {/* Presets */}
        <div className="flex gap-1 mb-4">
          {paddingPresets.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleUniformPadding(value)}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                isUniform && padding.top === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Individual Padding Inputs */}
        <div className="space-y-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <div key={side} className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 capitalize">{side}</span>
              <input
                type="number"
                min="0"
                max="200"
                value={padding[side]}
                onChange={(e) => onPaddingChange({ ...padding, [side]: Number(e.target.value) })}
                className="w-16 px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-white text-right"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Border Radius Section */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Corners</h3>

        {/* Presets */}
        <div className="flex gap-1 mb-4">
          {borderRadiusPresets.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onBorderRadiusChange(value)}
              className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                borderRadius === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Slider */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="48"
            value={borderRadius}
            onChange={(e) => onBorderRadiusChange(Number(e.target.value))}
            className="flex-1 h-1 bg-neutral-600 rounded-full appearance-none cursor-pointer"
          />
          <span className="text-xs text-neutral-300 w-10 text-right">{borderRadius}px</span>
        </div>
      </div>

      {/* Background Section */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Background</h3>

        {/* Solid Colors */}
        <p className="text-xs text-neutral-400 mb-2">Solid</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {backgroundPresets.map(({ color, label }) => (
            <button
              key={color}
              onClick={() => onBackgroundColorChange(color)}
              className={`aspect-square rounded-md border-2 transition-colors ${
                backgroundColor === color
                  ? 'border-blue-500'
                  : 'border-neutral-600 hover:border-neutral-500'
              }`}
              style={{
                backgroundColor: color === 'transparent' ? 'transparent' : color,
                backgroundImage: color === 'transparent'
                  ? 'linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)'
                  : 'none',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              }}
              title={label}
            />
          ))}
        </div>

        {/* Gradients */}
        <p className="text-xs text-neutral-400 mb-2">Gradients</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {gradientPresets.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onBackgroundColorChange(value)}
              className={`aspect-square rounded-md border-2 transition-colors ${
                backgroundColor === value
                  ? 'border-blue-500'
                  : 'border-neutral-600 hover:border-neutral-500'
              }`}
              style={{ backgroundImage: value }}
              title={label}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">Custom</span>
          <ColorPicker
            color={isGradient || backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
            onChange={onBackgroundColorChange}
          />
          <span className="text-xs text-neutral-500 flex-1 truncate">
            {isGradient ? 'Gradient' : backgroundColor}
          </span>
        </div>
      </div>
    </div>
  );
}
