import { useEffect, useState, useCallback, useRef } from 'react';
import { AnnotationCanvas } from './AnnotationCanvas';
import { Toolbar } from './Toolbar';
import { ToolSettings } from './ToolSettings';
import { PaddingControls } from './PaddingControls';
import { useEditor } from '@/hooks/useEditor';
import { invoke } from '@/lib/tauri';
import { Save, Copy, X } from 'lucide-react';

export type ToolType = 'select' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'blur';

export interface EditorState {
  tool: ToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  padding: { top: number; right: number; bottom: number; left: number };
  backgroundColor: string;
  borderRadius: number;
  zoom: number; // 0.25 to 2, where 1 = 100%
}

export function EditorApp() {
  const {
    imageData,
    timestamp,
    canvasRef,
    exportCanvas,
  } = useEditor();

  const [editorState, setEditorState] = useState<EditorState>({
    tool: 'select',
    color: '#ff0000',
    strokeWidth: 3,
    fontSize: 24,
    padding: { top: 32, right: 32, bottom: 32, left: 32 },
    backgroundColor: '#ffffff',
    borderRadius: 12,
    zoom: -1, // Fit mode by default (works well for Retina displays)
  });

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size for proper "Fit" zoom calculation
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const handleToolChange = useCallback((tool: ToolType) => {
    setEditorState(prev => ({ ...prev, tool }));
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setEditorState(prev => ({ ...prev, color }));
  }, []);

  const handleStrokeWidthChange = useCallback((strokeWidth: number) => {
    setEditorState(prev => ({ ...prev, strokeWidth }));
  }, []);

  const handleFontSizeChange = useCallback((fontSize: number) => {
    setEditorState(prev => ({ ...prev, fontSize }));
  }, []);

  const handlePaddingChange = useCallback((padding: EditorState['padding']) => {
    setEditorState(prev => ({ ...prev, padding }));
  }, []);

  const handleBackgroundColorChange = useCallback((backgroundColor: string) => {
    setEditorState(prev => ({ ...prev, backgroundColor }));
  }, []);

  const handleBorderRadiusChange = useCallback((borderRadius: number) => {
    setEditorState(prev => ({ ...prev, borderRadius }));
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setEditorState(prev => ({ ...prev, zoom: Math.max(0.25, Math.min(2, zoom)) }));
  }, []);

  const handleSave = useCallback(async () => {
    const base64 = await exportCanvas();
    if (base64 && timestamp) {
      await invoke('save_edited_screenshot', {
        base64Image: base64,
        timestamp
      });
    }
  }, [exportCanvas, timestamp]);

  const handleCopy = useCallback(async () => {
    const base64 = await exportCanvas();
    if (base64 && timestamp) {
      await invoke('copy_edited_screenshot', {
        base64Image: base64,
        timestamp
      });
    }
  }, [exportCanvas, timestamp]);

  const handleClose = useCallback(async () => {
    await invoke('close_editor_window');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        handleCopy();
      }
      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': handleToolChange('select'); break;
          case 'r': handleToolChange('rect'); break;
          case 'e': handleToolChange('ellipse'); break;
          case 'a': handleToolChange('arrow'); break;
          case 'l': handleToolChange('line'); break;
          case 't': handleToolChange('text'); break;
          case 'b': handleToolChange('blur'); break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleSave, handleCopy, handleToolChange]);

  if (!imageData) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-neutral-400">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-neutral-900 overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ToolSettings
            tool={editorState.tool}
            color={editorState.color}
            strokeWidth={editorState.strokeWidth}
            fontSize={editorState.fontSize}
            onColorChange={handleColorChange}
            onStrokeWidthChange={handleStrokeWidthChange}
            onFontSizeChange={handleFontSizeChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-white text-sm transition-colors"
          >
            <Copy size={16} />
            Copy
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <Toolbar
          currentTool={editorState.tool}
          onToolChange={handleToolChange}
        />

        {/* Canvas Area */}
        <div 
          ref={canvasContainerRef}
          className="flex-1 overflow-auto flex items-center justify-center p-8"
        >
          <AnnotationCanvas
            ref={canvasRef}
            imageData={imageData}
            editorState={editorState}
            containerSize={containerSize}
          />
        </div>

        {/* Right Panel - Padding & Background */}
        <div className="w-64 bg-neutral-800 border-l border-neutral-700 p-4 overflow-y-auto">
          <PaddingControls
            padding={editorState.padding}
            backgroundColor={editorState.backgroundColor}
            borderRadius={editorState.borderRadius}
            zoom={editorState.zoom}
            onPaddingChange={handlePaddingChange}
            onBackgroundColorChange={handleBackgroundColorChange}
            onBorderRadiusChange={handleBorderRadiusChange}
            onZoomChange={handleZoomChange}
          />
        </div>
      </div>
    </div>
  );
}
