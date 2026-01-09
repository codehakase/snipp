import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { EditorState } from './EditorApp';

interface AnnotationCanvasProps {
  imageData: string;
  editorState: EditorState;
  containerSize: { width: number; height: number };
}

export interface CanvasRef {
  exportToDataURL: () => string | null;
  undo: () => void;
  redo: () => void;
}

// Parse CSS gradient to Fabric gradient
function parseGradient(cssGradient: string, width: number, height: number): fabric.Gradient<'linear'> | null {
  const match = cssGradient.match(/linear-gradient\((\d+)deg,\s*([^,]+)\s+(\d+)%,\s*([^)]+)\s+(\d+)%\)/);
  if (!match) return null;

  const angle = parseInt(match[1]);
  const color1 = match[2].trim();
  const color2 = match[4].trim();

  // Convert angle to coordinates
  const angleRad = (angle - 90) * Math.PI / 180;
  const x1 = 0.5 - Math.cos(angleRad) * 0.5;
  const y1 = 0.5 - Math.sin(angleRad) * 0.5;
  const x2 = 0.5 + Math.cos(angleRad) * 0.5;
  const y2 = 0.5 + Math.sin(angleRad) * 0.5;

  return new fabric.Gradient({
    type: 'linear',
    coords: {
      x1: x1 * width,
      y1: y1 * height,
      x2: x2 * width,
      y2: y2 * height,
    },
    colorStops: [
      { offset: 0, color: color1 },
      { offset: 1, color: color2 },
    ],
  });
}

export const AnnotationCanvas = forwardRef<CanvasRef, AnnotationCanvasProps>(
  ({ imageData, editorState, containerSize }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const imageRef = useRef<fabric.FabricImage | null>(null);
    const bgRectRef = useRef<fabric.Rect | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const activeShapeRef = useRef<fabric.Object | null>(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const isInitializedRef = useRef(false);

    // Initialize Fabric canvas and load image
    useEffect(() => {
      if (!canvasRef.current || isInitializedRef.current) return;
      isInitializedRef.current = true;

      const canvas = new fabric.Canvas(canvasRef.current, {
        selection: editorState.tool === 'select',
        preserveObjectStacking: true,
      });

      fabricRef.current = canvas;

      // Load the screenshot image
      fabric.FabricImage.fromURL(`data:image/png;base64,${imageData}`).then((img) => {
        const imgWidth = img.width || 800;
        const imgHeight = img.height || 600;

        setImageSize({ width: imgWidth, height: imgHeight });
        imageRef.current = img;

        // Calculate canvas size with padding
        const { padding, backgroundColor, borderRadius } = editorState;
        const canvasWidth = imgWidth + padding.left + padding.right;
        const canvasHeight = imgHeight + padding.top + padding.bottom;

        // Set canvas dimensions
        canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

        // Create background rectangle (full canvas size)
        const isGradient = backgroundColor.startsWith('linear-gradient');
        const bgFill = isGradient
          ? parseGradient(backgroundColor, canvasWidth, canvasHeight)
          : backgroundColor;

        const bgRect = new fabric.Rect({
          left: 0,
          top: 0,
          width: canvasWidth,
          height: canvasHeight,
          fill: bgFill || backgroundColor,
          selectable: false,
          evented: false,
          hoverCursor: 'default',
          originX: 'left',
          originY: 'top',
        });
        bgRectRef.current = bgRect;
        canvas.add(bgRect);

        // Apply clip path for border radius on the image
        if (borderRadius > 0) {
          const clipPath = new fabric.Rect({
            width: imgWidth,
            height: imgHeight,
            rx: borderRadius,
            ry: borderRadius,
            originX: 'center',
            originY: 'center',
          });
          img.set({ clipPath });
        }

        // Position image with padding offset
        img.set({
          left: padding.left,
          top: padding.top,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
          hoverCursor: 'default',
        });

        canvas.add(img);

        // Ensure background is at the back
        canvas.sendObjectToBack(bgRect);
        canvas.renderAll();
      });

      return () => {
        canvas.dispose();
        fabricRef.current = null;
        imageRef.current = null;
        bgRectRef.current = null;
        isInitializedRef.current = false;
      };
    }, [imageData]);

    // Update canvas when padding, background, or border radius changes
    useEffect(() => {
      const canvas = fabricRef.current;
      const img = imageRef.current;
      const bgRect = bgRectRef.current;

      if (!canvas || !img || !bgRect || imageSize.width === 0) return;

      const { padding, backgroundColor, borderRadius } = editorState;
      const canvasWidth = imageSize.width + padding.left + padding.right;
      const canvasHeight = imageSize.height + padding.top + padding.bottom;

      // Update canvas size
      canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

      // Update background rectangle
      const isGradient = backgroundColor.startsWith('linear-gradient');
      const bgFill = isGradient
        ? parseGradient(backgroundColor, canvasWidth, canvasHeight)
        : backgroundColor;

      bgRect.set({
        width: canvasWidth,
        height: canvasHeight,
        fill: bgFill || backgroundColor,
      });
      bgRect.setCoords();

      // Update image position
      img.set({
        left: padding.left,
        top: padding.top,
      });

      // Update clip path for border radius
      if (borderRadius > 0) {
        const clipPath = new fabric.Rect({
          width: imageSize.width,
          height: imageSize.height,
          rx: borderRadius,
          ry: borderRadius,
          originX: 'center',
          originY: 'center',
        });
        img.set({ clipPath });
      } else {
        img.set({ clipPath: undefined });
      }

      // Ensure background stays at the back
      canvas.sendObjectToBack(bgRect);
      canvas.renderAll();
    }, [editorState.padding, editorState.backgroundColor, editorState.borderRadius, imageSize]);

    // Update selection mode based on tool
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      canvas.selection = editorState.tool === 'select';
      canvas.forEachObject((obj) => {
        // Skip background rect and main image
        if (obj === bgRectRef.current || obj === imageRef.current) return;
        obj.selectable = editorState.tool === 'select';
        obj.evented = editorState.tool === 'select';
      });
      canvas.renderAll();
    }, [editorState.tool]);

    // Handle mouse events for drawing
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const handleMouseDown = (opt: fabric.TPointerEventInfo) => {
        if (editorState.tool === 'select') return;

        const pointer = canvas.getScenePoint(opt.e);
        startPointRef.current = { x: pointer.x, y: pointer.y };
        setIsDrawing(true);

        let shape: fabric.Object | null = null;

        switch (editorState.tool) {
          case 'rect':
            shape = new fabric.Rect({
              left: pointer.x,
              top: pointer.y,
              width: 0,
              height: 0,
              fill: 'transparent',
              stroke: editorState.color,
              strokeWidth: editorState.strokeWidth,
            });
            break;
          case 'ellipse':
            shape = new fabric.Ellipse({
              left: pointer.x,
              top: pointer.y,
              rx: 0,
              ry: 0,
              fill: 'transparent',
              stroke: editorState.color,
              strokeWidth: editorState.strokeWidth,
            });
            break;
          case 'line':
            shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: editorState.color,
              strokeWidth: editorState.strokeWidth,
            });
            break;
          case 'arrow':
            shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              stroke: editorState.color,
              strokeWidth: editorState.strokeWidth,
            });
            break;
          case 'text':
            const text = new fabric.IText('Type here', {
              left: pointer.x,
              top: pointer.y,
              fontSize: editorState.fontSize,
              fill: editorState.color,
              fontFamily: 'Inter, system-ui, sans-serif',
            });
            canvas.add(text);
            canvas.setActiveObject(text);
            text.enterEditing();
            return;
          case 'blur':
            shape = new fabric.Rect({
              left: pointer.x,
              top: pointer.y,
              width: 0,
              height: 0,
              fill: '#1a1a1a',
              stroke: '#1a1a1a',
              strokeWidth: 0,
              rx: 4,
              ry: 4,
            });
            break;
        }

        if (shape) {
          canvas.add(shape);
          activeShapeRef.current = shape;
        }
      };

      const handleMouseMove = (opt: fabric.TPointerEventInfo) => {
        if (!isDrawing || !startPointRef.current || !activeShapeRef.current) return;

        const pointer = canvas.getScenePoint(opt.e);
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;

        const width = pointer.x - startX;
        const height = pointer.y - startY;

        const shape = activeShapeRef.current;

        if (shape instanceof fabric.Rect) {
          shape.set({
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y,
            width: Math.abs(width),
            height: Math.abs(height),
          });
        } else if (shape instanceof fabric.Ellipse) {
          shape.set({
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y,
            rx: Math.abs(width) / 2,
            ry: Math.abs(height) / 2,
          });
        } else if (shape instanceof fabric.Line) {
          shape.set({ x2: pointer.x, y2: pointer.y });
        }

        canvas.renderAll();
      };

      const handleMouseUp = () => {
        setIsDrawing(false);
        startPointRef.current = null;

        // Convert arrow line to arrow with head
        if (editorState.tool === 'arrow' && activeShapeRef.current instanceof fabric.Line) {
          const line = activeShapeRef.current;
          const x1 = line.x1 || 0;
          const y1 = line.y1 || 0;
          const x2 = line.x2 || 0;
          const y2 = line.y2 || 0;

          // Calculate arrow head
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;

          const arrowHead = new fabric.Triangle({
            left: x2,
            top: y2,
            width: headLength,
            height: headLength,
            fill: editorState.color,
            angle: (angle * 180 / Math.PI) + 90,
            originX: 'center',
            originY: 'center',
          });

          canvas.add(arrowHead);
        }

        activeShapeRef.current = null;
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [editorState, isDrawing]);

    // Delete key handler
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            fabricRef.current &&
            editorState.tool === 'select') {
          const canvas = fabricRef.current;
          const activeObjects = canvas.getActiveObjects();
          activeObjects.forEach(obj => {
            // Don't delete background or main image
            if (obj === bgRectRef.current || obj === imageRef.current) return;
            canvas.remove(obj);
          });
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editorState.tool]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportToDataURL: () => {
        if (!fabricRef.current) return null;
        return fabricRef.current.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });
      },
      undo: () => {
        // TODO: Implement undo with history stack
      },
      redo: () => {
        // TODO: Implement redo with history stack
      },
    }));

    // Calculate canvas dimensions with padding
    const { padding } = editorState;
    const canvasWidth = imageSize.width + padding.left + padding.right;
    const canvasHeight = imageSize.height + padding.top + padding.bottom;

    // Calculate display zoom - "Fit" mode (zoom < 0) calculates scale to fit container
    const calculateFitZoom = () => {
      if (containerSize.width === 0 || containerSize.height === 0 || canvasWidth === 0 || canvasHeight === 0) {
        return 0.5; // Fallback
      }
      // Leave some padding around the canvas in the container
      const availableWidth = containerSize.width - 64;
      const availableHeight = containerSize.height - 64;
      
      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;
      
      // Use the smaller scale to ensure it fits, cap at 1 (don't upscale)
      return Math.min(scaleX, scaleY, 1);
    };

    const displayZoom = editorState.zoom < 0 ? calculateFitZoom() : editorState.zoom;

    // Calculate wrapper dimensions to prevent clipping
    const wrapperWidth = canvasWidth * displayZoom;
    const wrapperHeight = canvasHeight * displayZoom;

    return (
      <div
        className="shadow-2xl rounded-lg overflow-hidden"
        style={{
          width: wrapperWidth || 'auto',
          height: wrapperHeight || 'auto',
          minWidth: wrapperWidth || 'auto',
          minHeight: wrapperHeight || 'auto',
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{
            transform: `scale(${displayZoom})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    );
  }
);

AnnotationCanvas.displayName = 'AnnotationCanvas';
