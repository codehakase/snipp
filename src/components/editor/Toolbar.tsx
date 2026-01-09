import {
  MousePointer2,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  Type,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolType } from './EditorApp';

interface ToolbarProps {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const tools: { type: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { type: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { type: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { type: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'E' },
  { type: 'arrow', icon: ArrowUpRight, label: 'Arrow', shortcut: 'A' },
  { type: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { type: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { type: 'blur', icon: EyeOff, label: 'Redact', shortcut: 'B' },
];

export function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  return (
    <div className="w-14 bg-neutral-800 border-r border-neutral-700 flex flex-col items-center py-3 gap-1">
      {tools.map(({ type, icon: Icon, label, shortcut }) => (
        <button
          key={type}
          onClick={() => onToolChange(type)}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg transition-all",
            currentTool === type
              ? "bg-blue-600 text-white"
              : "text-neutral-400 hover:bg-neutral-700 hover:text-white"
          )}
          title={`${label} (${shortcut})`}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
