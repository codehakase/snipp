import { useEffect, useState, useCallback, useRef } from 'react';
import { AnnotationCanvas } from './AnnotationCanvas';
import { Toolbar } from './Toolbar';
import { ToolSettings } from './ToolSettings';
import { PaddingControls } from './PaddingControls';
import { useEditor } from '@/hooks/useEditor';
import { invoke } from '@/lib/tauri';
import { Save, Copy, X, Settings2 } from 'lucide-react';

export type ToolType = 'select' | 'rect' | 'ellipse' | 'arrow' | 'line' | 'text' | 'blur';

export interface EditorState {
  tool: ToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  padding: { top: number; right: number; bottom: number; left: number };
  backgroundColor: string;
  borderRadius: number;
  zoom: number; // 0.1 to 2, where 1 = 100%
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
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 12,
    zoom: 0, // 0 = auto-fit (will be calculated)
  });

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track container size
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

  // Cleanup sidebar timeout on unmount
  useEffect(() => {
    return () => {
      if (sidebarTimeoutRef.current) {
        clearTimeout(sidebarTimeoutRef.current);
      }
    };
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
    setEditorState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(2, zoom)) }));
  }, []);

  const handleZoomCalculated = useCallback((zoom: number) => {
    // Set initial zoom when canvas calculates fit zoom
    setEditorState(prev => ({ ...prev, zoom }));
  }, []);

  const handleSidebarMouseEnter = useCallback(() => {
    if (sidebarTimeoutRef.current) {
      clearTimeout(sidebarTimeoutRef.current);
      sidebarTimeoutRef.current = null;
    }
    setIsSidebarOpen(true);
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    sidebarTimeoutRef.current = setTimeout(() => {
      setIsSidebarOpen(false);
    }, 300);
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
          className="flex-1 overflow-auto flex items-center justify-center p-8 bg-neutral-900"
        >
          <AnnotationCanvas
            ref={canvasRef}
            imageData={imageData}
            editorState={editorState}
            containerSize={containerSize}
            onZoomCalculated={handleZoomCalculated}
          />
        </div>

        {/* Right Panel - Collapsible Sidebar */}
        <div
          className="relative"
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          {/* Hover trigger zone (visible when collapsed) */}
          <div
            className={`absolute right-0 top-0 h-full w-10 flex items-center justify-center transition-opacity ${
              isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="bg-neutral-800 border border-neutral-700 rounded-l-lg p-2 cursor-pointer hover:bg-neutral-700 transition-colors">
              <Settings2 size={18} className="text-neutral-400" />
            </div>
          </div>

          {/* Sidebar panel */}
          <div
            className={`h-full bg-neutral-800 border-l border-neutral-700 overflow-hidden transition-all duration-200 ease-out ${
              isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <div className="w-64 p-4 overflow-y-auto h-full">
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
      </div>
    </div>
  );
}
