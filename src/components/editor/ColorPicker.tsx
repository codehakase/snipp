import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const presetColors = [
  '#ff0000', '#ff6b00', '#ffd500', '#00ff00',
  '#00d4ff', '#0066ff', '#8b00ff', '#ff00ff',
  '#ffffff', '#cccccc', '#666666', '#000000',
];

export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={popoverRef}>
      {label && (
        <span className="text-xs text-neutral-400 mb-1 block">{label}</span>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-md border-2 border-neutral-600 hover:border-neutral-500 transition-colors"
        style={{ backgroundColor: color }}
        title="Pick color"
      />

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 z-50">
          <HexColorPicker color={color} onChange={onChange} />

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-neutral-400">#</span>
            <HexColorInput
              color={color}
              onChange={onChange}
              className="w-20 px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-sm text-white"
              prefixed={false}
            />
          </div>

          <div className="mt-3 grid grid-cols-6 gap-1">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => onChange(presetColor)}
                className={`w-6 h-6 rounded border-2 transition-colors ${
                  color === presetColor ? 'border-white' : 'border-transparent hover:border-neutral-500'
                }`}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
