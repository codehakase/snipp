import { useState, useEffect, useRef, useCallback } from 'react';
import { listen, emit } from '@/lib/tauri';
import { debugLog } from '@/lib/utils';
import type { EditorData } from '@/types';
import type { CanvasRef } from '@/components/editor/AnnotationCanvas';

export const useEditor = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const canvasRef = useRef<CanvasRef>(null);

  useEffect(() => {
    const setupListener = async () => {
      try {
        debugLog('Setting up editor-data listener...');
        const unlisten = await listen('editor-data', (data: EditorData) => {
          debugLog('Received editor-data event');
          setImageData(data.base64_image);
          setTimestamp(data.timestamp);
        });
        debugLog('Editor listener setup successfully');
        await emit('editor-ready', {});
        debugLog('Emitted editor-ready signal');
        return unlisten;
      } catch (error) {
        console.error('Failed to setup editor listener:', error);
      }
    };

    let unlisten: (() => void) | undefined;
    setupListener().then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const exportCanvas = useCallback(async (): Promise<string | null> => {
    if (!canvasRef.current) return null;

    const dataUrl = canvasRef.current.exportToDataURL();
    if (!dataUrl) return null;

    // Remove data:image/png;base64, prefix
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }, []);

  return {
    imageData,
    timestamp,
    canvasRef,
    exportCanvas,
  };
};
