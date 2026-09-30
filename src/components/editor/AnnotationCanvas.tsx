import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { debugLog } from '@/lib/utils';
import type { EditorState } from './EditorApp';

// Custom metadata type for blur regions
interface BlurRegionData {
  type: 'blurRegion';
  originalBounds: { left: number; top: number; width: number; height: number };
  blockSize: number;
}

interface AnnotationCanvasProps {
  imageData: string;
  editorState: EditorState;
  containerSize: { width: number; height: number };
  autoFit: boolean;
  onZoomCalculated?: (zoom: number) => void;
}

export interface CanvasRef {
  exportToDataURL: () => string | null;
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// History entry represents a canvas state snapshot
interface HistoryEntry {
  json: string;
  timestamp: number;
}

function hasPadding(padding: EditorState['padding']): boolean {
  return padding.top > 0 || padding.right > 0 || padding.bottom > 0 || padding.left > 0;
}

// Fabric clip paths force large images through a size-limited bitmap cache.
// Clip while drawing instead so the source image stays at its native resolution.
class RoundedFabricImage extends fabric.FabricImage {
  private cornerRadius = 0;

  setCornerRadius(radius: number): void {
    this.cornerRadius = Math.max(0, radius);
    this.dirty = true;
  }

  _render(ctx: CanvasRenderingContext2D): void {
    const radius = Math.min(this.cornerRadius, this.width / 2, this.height / 2);
    if (radius <= 0) {
      super._render(ctx);
      return;
    }

    const left = -this.width / 2;
    const top = -this.height / 2;
    const right = this.width / 2;
    const bottom = this.height / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left + radius, top);
    ctx.lineTo(right - radius, top);
    ctx.quadraticCurveTo(right, top, right, top + radius);
    ctx.lineTo(right, bottom - radius);
    ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
    ctx.lineTo(left + radius, bottom);
    ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
    ctx.lineTo(left, top + radius);
    ctx.quadraticCurveTo(left, top, left + radius, top);
    ctx.closePath();
    ctx.clip();
    super._render(ctx);
    ctx.restore();
  }
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

// Create a pixelated blur region from the underlying image
async function createBlurRegion(
  sourceImage: fabric.FabricImage,
  bounds: { left: number; top: number; width: number; height: number },
  imagePadding: { left: number; top: number },
  blockSize: number = 8
): Promise<fabric.FabricImage | null> {
  // Calculate the region to extract from the source image (accounting for padding)
  const imageLeft = imagePadding.left;
  const imageTop = imagePadding.top;

  // Calculate intersection with the image bounds
  const imgWidth = sourceImage.width || 0;
  const imgHeight = sourceImage.height || 0;

  const cropLeft = Math.max(0, bounds.left - imageLeft);
  const cropTop = Math.max(0, bounds.top - imageTop);
  const cropRight = Math.min(imgWidth, bounds.left + bounds.width - imageLeft);
  const cropBottom = Math.min(imgHeight, bounds.top + bounds.height - imageTop);

  const cropWidth = cropRight - cropLeft;
  const cropHeight = cropBottom - cropTop;

  // Skip if the blur region doesn't overlap with the image
  if (cropWidth <= 0 || cropHeight <= 0) {
    return null;
  }

  // Get the source image element
  const sourceElement = sourceImage.getElement() as HTMLImageElement;
  if (!sourceElement) return null;

  // Create a temporary canvas to extract the region
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropWidth;
  tempCanvas.height = cropHeight;
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return null;

  // Draw the cropped region from the source image
  ctx.drawImage(
    sourceElement,
    cropLeft, cropTop, cropWidth, cropHeight,  // source rectangle
    0, 0, cropWidth, cropHeight                 // destination rectangle
  );

  // Create a fabric image from the temp canvas
  const blurImage = new fabric.FabricImage(tempCanvas, {
    left: imageLeft + cropLeft,
    top: imageTop + cropTop,
    originX: 'left',
    originY: 'top',
  });

  // Apply pixelate filter
  const pixelateFilter = new fabric.filters.Pixelate({
    blocksize: blockSize,
  });
  blurImage.filters = [pixelateFilter];
  blurImage.applyFilters();

  // Store metadata for serialization
  (blurImage as fabric.FabricImage & { blurRegionData?: BlurRegionData }).blurRegionData = {
    type: 'blurRegion',
    originalBounds: bounds,
    blockSize,
  };

  return blurImage;
}

export const AnnotationCanvas = forwardRef<CanvasRef, AnnotationCanvasProps>(
  ({ imageData, editorState, containerSize, autoFit, onZoomCalculated }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const imageRef = useRef<RoundedFabricImage | null>(null);
    const bgRectRef = useRef<fabric.Rect | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const activeShapeRef = useRef<fabric.Object | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
    const isInitializedRef = useRef(false);

    // History state for undo/redo
    const historyRef = useRef<HistoryEntry[]>([]);
    const historyIndexRef = useRef(-1);
    const isRestoringRef = useRef(false);
    const maxHistorySize = 50;

    // Initialize Fabric canvas and load image
    useEffect(() => {
      if (!canvasRef.current || isInitializedRef.current) return;
      isInitializedRef.current = true;
      const imageLoadController = new AbortController();

      // Get device pixel ratio for high-DPI display support
      const dpr = window.devicePixelRatio || 1;

      const canvas = new fabric.Canvas(canvasRef.current, {
        selection: editorState.tool === 'select',
        preserveObjectStacking: true,
        // Enable Fabric's retina scaling for sharp rendering on high-DPI displays
        enableRetinaScaling: true,
      });

      debugLog('[AnnotationCanvas] Canvas initialized with DPR:', dpr);

      fabricRef.current = canvas;

      // Load the screenshot image
      RoundedFabricImage.fromURL(
        `data:image/png;base64,${imageData}`,
        { signal: imageLoadController.signal },
      ).then((loadedImage) => {
        const img = loadedImage as RoundedFabricImage;
        // StrictMode can start a replacement canvas before the previous image
        // load settles. Only the load owned by the active canvas may update refs.
        if (imageLoadController.signal.aborted || fabricRef.current !== canvas) {
          debugLog('[AnnotationCanvas] Skipping stale image load');
          return;
        }

        const imgWidth = img.width || 800;
        const imgHeight = img.height || 600;

        const dpr = window.devicePixelRatio || 1;
        debugLog('[AnnotationCanvas] Image loaded:', {
          imgWidth,
          imgHeight,
          devicePixelRatio: dpr,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          isRetina: dpr > 1,
        });

        // Store original image size for later calculations
        setOriginalImageSize({ width: imgWidth, height: imgHeight });
        imageRef.current = img;

        // Calculate canvas size with padding
        const { padding, backgroundColor, borderRadius } = editorState;
        const fullCanvasWidth = imgWidth + padding.left + padding.right;
        const fullCanvasHeight = imgHeight + padding.top + padding.bottom;

        debugLog('[AnnotationCanvas] Canvas dimensions:', { fullCanvasWidth, fullCanvasHeight });

        // Create background rectangle (full canvas size)
        const isGradient = backgroundColor.startsWith('linear-gradient');
        const bgFill = isGradient
          ? parseGradient(backgroundColor, fullCanvasWidth, fullCanvasHeight)
          : backgroundColor;

        const bgRect = new fabric.Rect({
          left: 0,
          top: 0,
          width: fullCanvasWidth,
          height: fullCanvasHeight,
          fill: bgFill || backgroundColor,
          visible: hasPadding(padding),
          rx: borderRadius,
          ry: borderRadius,
          selectable: false,
          evented: false,
          hoverCursor: 'default',
          originX: 'left',
          originY: 'top',
        });
        bgRectRef.current = bgRect;
        canvas.add(bgRect);

        img.setCornerRadius(borderRadius);

        // Position image with padding offset
        img.set({
          left: padding.left,
          top: padding.top,
          scaleX: 1,
          scaleY: 1,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
          hoverCursor: 'default',
        });

        canvas.add(img);

        // Ensure background is at the back
        canvas.sendObjectToBack(bgRect);

        // Set initial canvas size - zoom will be calculated by dedicated effect
        canvas.setDimensions({ width: fullCanvasWidth, height: fullCanvasHeight });
        setCanvasSize({ width: fullCanvasWidth, height: fullCanvasHeight });

        canvas.renderAll();
      }).catch((error: unknown) => {
        if (!imageLoadController.signal.aborted) {
          debugLog('[AnnotationCanvas] Failed to load image:', error);
        }
      });

      return () => {
        imageLoadController.abort();
        void canvas.dispose();

        if (fabricRef.current === canvas) {
          fabricRef.current = null;
          imageRef.current = null;
          bgRectRef.current = null;
          isInitializedRef.current = false;
          setOriginalImageSize({ width: 0, height: 0 });
          setCanvasSize({ width: 0, height: 0 });
        }
      };
    }, [imageData]);

    // Keep the canvas fitted while in automatic zoom mode. A manual zoom selection
    // switches this off in EditorApp, so subsequent resizes preserve the user's zoom.
    useEffect(() => {
      const canvas = fabricRef.current;

      if (!autoFit) return;
      if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;
      if (containerSize.width === 0 || containerSize.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const availableWidth = containerSize.width - 64;
      const availableHeight = containerSize.height - 64;
      const scaleX = availableWidth / canvasSize.width;
      const scaleY = availableHeight / canvasSize.height;
      const fitZoom = Math.min(scaleX, scaleY, 1);

      debugLog('[AnnotationCanvas] Auto-fit zoom calculation:', {
        containerSize,
        canvasSize,
        availableWidth,
        availableHeight,
        scaleX,
        scaleY,
        fitZoom,
        devicePixelRatio: dpr,
      });

      canvas.setZoom(fitZoom);
      // Set CSS dimensions for display (Fabric handles backing store scaling internally with enableRetinaScaling)
      canvas.setDimensions(
        { width: canvasSize.width * fitZoom, height: canvasSize.height * fitZoom },
        { cssOnly: false }
      );
      canvas.renderAll();

      if (onZoomCalculated && Math.abs(editorState.zoom - fitZoom) > 0.001) {
        onZoomCalculated(fitZoom);
      }
    }, [autoFit, containerSize, canvasSize, editorState.zoom, onZoomCalculated]);

    // Save current state to history
    const saveToHistory = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas || isRestoringRef.current) return;

      // Get all annotation objects (exclude background and main image)
      const objects = canvas.getObjects().filter(obj =>
        obj !== bgRectRef.current && obj !== imageRef.current
      );

      // Serialize annotation objects with custom properties for blur regions
      const json = JSON.stringify(objects.map(obj => {
        const serialized = obj.toObject(['id', 'objects', 'src']);
        // Include blur region metadata if present
        const blurData = (obj as fabric.FabricImage & { blurRegionData?: BlurRegionData }).blurRegionData;
        if (blurData) {
          serialized.blurRegionData = blurData;
        }
        return serialized;
      }));

      // If we're not at the end of history, truncate forward history
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }

      // Add new entry
      historyRef.current.push({
        json,
        timestamp: Date.now(),
      });

      // Enforce max history size
      if (historyRef.current.length > maxHistorySize) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current++;
      }
    }, []);

    // Restore state from history
    const restoreFromHistory = useCallback(async (index: number) => {
      const canvas = fabricRef.current;
      const entry = historyRef.current[index];
      if (!canvas || !entry) return;

      isRestoringRef.current = true;

      // Remove all annotation objects
      const objectsToRemove = canvas.getObjects().filter(obj =>
        obj !== bgRectRef.current && obj !== imageRef.current
      );
      objectsToRemove.forEach(obj => canvas.remove(obj));

      // Parse and recreate objects
      const objectsData = JSON.parse(entry.json);
      for (const objData of objectsData) {
        const recreated = await recreateObject(objData);
        if (recreated) {
          canvas.add(recreated);
        }
      }

      canvas.discardActiveObject();
      canvas.renderAll();

      historyIndexRef.current = index;
      isRestoringRef.current = false;
    }, []);

    // Helper to recreate fabric objects from serialized data
    const recreateObject = async (objData: Record<string, unknown>): Promise<fabric.Object | null> => {
      const type = objData.type as string;

      switch (type) {
        case 'Rect':
        case 'rect':
          return new fabric.Rect(objData as fabric.TOptions<fabric.RectProps>);
        case 'Ellipse':
        case 'ellipse':
          return new fabric.Ellipse(objData as fabric.TOptions<fabric.EllipseProps>);
        case 'Line':
        case 'line':
          return new fabric.Line(
            [
              objData.x1 as number ?? 0,
              objData.y1 as number ?? 0,
              objData.x2 as number ?? 0,
              objData.y2 as number ?? 0,
            ],
            objData as fabric.TOptions<fabric.FabricObjectProps>
          );
        case 'Triangle':
        case 'triangle':
          return new fabric.Triangle(objData as fabric.TOptions<fabric.FabricObjectProps>);
        case 'IText':
        case 'i-text':
          return new fabric.IText(objData.text as string ?? '', objData as fabric.TOptions<fabric.ITextProps>);
        case 'Group':
        case 'group': {
          // Recreate group objects (e.g., arrows)
          const objectsData = objData.objects as Record<string, unknown>[] | undefined;
          if (!objectsData || objectsData.length === 0) return null;

          const groupObjects: fabric.Object[] = [];
          for (const childData of objectsData) {
            const child = await recreateObject(childData);
            if (child) {
              groupObjects.push(child);
            }
          }

          if (groupObjects.length === 0) return null;

          const group = new fabric.Group(groupObjects, {
            left: objData.left as number ?? 0,
            top: objData.top as number ?? 0,
            angle: objData.angle as number ?? 0,
            scaleX: objData.scaleX as number ?? 1,
            scaleY: objData.scaleY as number ?? 1,
            originX: (objData.originX as fabric.TOriginX) ?? 'center',
            originY: (objData.originY as fabric.TOriginY) ?? 'center',
          });

          return group;
        }
        case 'Image':
        case 'image': {
          // Check if this is a blur region
          const blurData = objData.blurRegionData as BlurRegionData | undefined;
          if (blurData && imageRef.current) {
            // Recreate the blur region from the source image
            const blurImage = await createBlurRegion(
              imageRef.current,
              blurData.originalBounds,
              editorState.padding,
              blurData.blockSize
            );
            if (blurImage) {
              // Apply any transformations from the serialized data
              blurImage.set({
                angle: objData.angle as number ?? 0,
                scaleX: objData.scaleX as number ?? 1,
                scaleY: objData.scaleY as number ?? 1,
              });
              return blurImage;
            }
          }
          // Fallback: try to recreate from src if available
          const src = objData.src as string | undefined;
          if (src) {
            try {
              const img = await fabric.FabricImage.fromURL(src);
              img.set({
                left: objData.left as number ?? 0,
                top: objData.top as number ?? 0,
                angle: objData.angle as number ?? 0,
                scaleX: objData.scaleX as number ?? 1,
                scaleY: objData.scaleY as number ?? 1,
                originX: (objData.originX as fabric.TOriginX) ?? 'left',
                originY: (objData.originY as fabric.TOriginY) ?? 'top',
              });
              return img;
            } catch {
              return null;
            }
          }
          return null;
        }
        default:
          return null;
      }
    };

    // Update canvas when padding, background, or border radius changes
    useEffect(() => {
      const canvas = fabricRef.current;
      const img = imageRef.current;
      const bgRect = bgRectRef.current;

      // Need original image size to calculate new canvas dimensions
      if (!canvas || !img || !bgRect || originalImageSize.width === 0) return;

      const imgWidth = originalImageSize.width;
      const imgHeight = originalImageSize.height;
      const { padding, backgroundColor, borderRadius } = editorState;
      const fullCanvasWidth = imgWidth + padding.left + padding.right;
      const fullCanvasHeight = imgHeight + padding.top + padding.bottom;

      debugLog('[AnnotationCanvas] Updating canvas:', {
        padding,
        borderRadius,
        fullCanvasWidth,
        fullCanvasHeight
      });

      // Store current zoom
      const currentZoom = canvas.getZoom();

      // Update internal canvas size (at zoom 1)
      setCanvasSize({ width: fullCanvasWidth, height: fullCanvasHeight });

      // Update background rectangle
      const isGradient = backgroundColor.startsWith('linear-gradient');
      const bgFill = isGradient
        ? parseGradient(backgroundColor, fullCanvasWidth, fullCanvasHeight)
        : backgroundColor;

      bgRect.set({
        width: fullCanvasWidth,
        height: fullCanvasHeight,
        fill: bgFill || backgroundColor,
        visible: hasPadding(padding),
        rx: borderRadius,
        ry: borderRadius,
        dirty: true,
      });
      bgRect.setCoords();

      // Update image position
      img.set({
        left: padding.left,
        top: padding.top,
        dirty: true,
      });

      img.setCornerRadius(borderRadius);
      img.setCoords();

      // Update canvas element size with zoom
      canvas.setDimensions(
        { width: fullCanvasWidth * currentZoom, height: fullCanvasHeight * currentZoom },
        { cssOnly: false }
      );

      // Ensure background stays at the back
      canvas.sendObjectToBack(bgRect);
      canvas.requestRenderAll();
    }, [editorState.padding, editorState.backgroundColor, editorState.borderRadius, originalImageSize]);

    // Handle zoom changes
    useEffect(() => {
      const canvas = fabricRef.current;
      if (autoFit || !canvas || canvasSize.width === 0 || editorState.zoom <= 0) return;

      canvas.setZoom(editorState.zoom);
      canvas.setDimensions(
        { width: canvasSize.width * editorState.zoom, height: canvasSize.height * editorState.zoom },
        { cssOnly: false }
      );
      canvas.renderAll();
    }, [autoFit, editorState.zoom, canvasSize]);

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

    // Track object modifications (move, scale, rotate) for undo history
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const handleObjectModified = () => {
        if (!isRestoringRef.current) {
          saveToHistory();
        }
      };

      canvas.on('object:modified', handleObjectModified);

      return () => {
        canvas.off('object:modified', handleObjectModified);
      };
    }, [saveToHistory]);

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
            saveToHistory();
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
        const wasDrawing = isDrawing && activeShapeRef.current !== null;
        setIsDrawing(false);
        startPointRef.current = null;

        // Convert arrow line to grouped arrow (line + head)
        if (editorState.tool === 'arrow' && activeShapeRef.current instanceof fabric.Line) {
          const line = activeShapeRef.current;
          const x1 = line.x1 || 0;
          const y1 = line.y1 || 0;
          const x2 = line.x2 || 0;
          const y2 = line.y2 || 0;

          // Remove the temporary line
          canvas.remove(line);

          // Calculate arrow head angle and size
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;

          // Create line with coordinates relative to group center
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;

          const arrowLine = new fabric.Line(
            [x1 - centerX, y1 - centerY, x2 - centerX, y2 - centerY],
            {
              stroke: editorState.color,
              strokeWidth: editorState.strokeWidth,
              originX: 'center',
              originY: 'center',
            }
          );

          // Create arrow head positioned at the end point, relative to group center
          const arrowHead = new fabric.Triangle({
            left: x2 - centerX,
            top: y2 - centerY,
            width: headLength,
            height: headLength,
            fill: editorState.color,
            angle: (angle * 180 / Math.PI) + 90,
            originX: 'center',
            originY: 'center',
          });

          // Group the line and head together
          const arrowGroup = new fabric.Group([arrowLine, arrowHead], {
            left: centerX,
            top: centerY,
            originX: 'center',
            originY: 'center',
          });

          // Mark this group as an arrow for serialization
          (arrowGroup as fabric.Group & { arrowData?: object }).arrowData = {
            color: editorState.color,
            strokeWidth: editorState.strokeWidth,
          };

          canvas.add(arrowGroup);
          activeShapeRef.current = null;

          // Save to history after completing arrow
          if (wasDrawing) {
            saveToHistory();
          }
          return;
        }

        // Convert blur rectangle to pixelated image region
        if (editorState.tool === 'blur' && activeShapeRef.current instanceof fabric.Rect) {
          const rect = activeShapeRef.current;
          const rectLeft = rect.left || 0;
          const rectTop = rect.top || 0;
          const rectWidth = rect.width || 0;
          const rectHeight = rect.height || 0;

          // Skip if rectangle is too small
          if (rectWidth < 5 || rectHeight < 5) {
            canvas.remove(rect);
            activeShapeRef.current = null;
            return;
          }

          // Remove the temporary rectangle
          canvas.remove(rect);

          // Create pixelated blur region from the image
          const img = imageRef.current;
          if (img) {
            const bounds = {
              left: rectLeft,
              top: rectTop,
              width: rectWidth,
              height: rectHeight,
            };

            createBlurRegion(img, bounds, editorState.padding, 8).then((blurImage) => {
              if (blurImage && fabricRef.current) {
                fabricRef.current.add(blurImage);
                fabricRef.current.renderAll();
                saveToHistory();
              }
            });
          }

          activeShapeRef.current = null;
          return;
        }

        activeShapeRef.current = null;

        // Save to history after completing a drawing action
        if (wasDrawing) {
          saveToHistory();
        }
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
      };
    }, [editorState, isDrawing, saveToHistory]);

    // Delete key handler
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            fabricRef.current &&
            editorState.tool === 'select') {
          const canvas = fabricRef.current;
          const activeObjects = canvas.getActiveObjects();
          let deletedAny = false;
          activeObjects.forEach(obj => {
            // Don't delete background or main image
            if (obj === bgRectRef.current || obj === imageRef.current) return;
            canvas.remove(obj);
            deletedAny = true;
          });
          canvas.discardActiveObject();
          canvas.renderAll();
          if (deletedAny) {
            saveToHistory();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editorState.tool, saveToHistory]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportToDataURL: () => {
        if (!fabricRef.current || canvasSize.width === 0) return null;

        const canvas = fabricRef.current;
        const currentBorderRadius = editorState.borderRadius;

        // Temporarily reset zoom for full-resolution export
        const currentZoom = canvas.getZoom();
        canvas.setZoom(1);
        canvas.setDimensions(
          { width: canvasSize.width, height: canvasSize.height },
          { cssOnly: false }
        );

        // Apply canvas-level clip path for rounded corners during export
        // This ensures the exported PNG has transparent corners when borderRadius > 0
        let previousClipPath: fabric.Object | undefined;
        if (currentBorderRadius > 0) {
          previousClipPath = canvas.clipPath;
          canvas.clipPath = new fabric.Rect({
            width: canvasSize.width,
            height: canvasSize.height,
            rx: currentBorderRadius,
            ry: currentBorderRadius,
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0,
            absolutePositioned: true,
          });
        }

        // Export at 1x resolution (logical pixels, not device pixels)
        // The multiplier: 1 ensures we get the logical size output
        const dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });

        // Restore canvas clip path
        if (currentBorderRadius > 0) {
          canvas.clipPath = previousClipPath;
        }

        // Restore zoom
        canvas.setZoom(currentZoom);
        canvas.setDimensions(
          { width: canvasSize.width * currentZoom, height: canvasSize.height * currentZoom },
          { cssOnly: false }
        );

        return dataURL;
      },
      undo: () => {
        if (historyIndexRef.current > 0) {
          restoreFromHistory(historyIndexRef.current - 1);
        } else if (historyIndexRef.current === 0) {
          // Undo to initial state (no annotations)
          const canvas = fabricRef.current;
          if (!canvas) return;
          isRestoringRef.current = true;
          const objectsToRemove = canvas.getObjects().filter(obj =>
            obj !== bgRectRef.current && obj !== imageRef.current
          );
          objectsToRemove.forEach(obj => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.renderAll();
          historyIndexRef.current = -1;
          isRestoringRef.current = false;
        }
      },
      redo: () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          restoreFromHistory(historyIndexRef.current + 1);
        }
      },
      canUndo: () => historyIndexRef.current >= 0,
      canRedo: () => historyIndexRef.current < historyRef.current.length - 1,
      setZoom: (zoom: number) => {
        if (!fabricRef.current || canvasSize.width === 0) return;
        fabricRef.current.setZoom(zoom);
        fabricRef.current.setDimensions(
          { width: canvasSize.width * zoom, height: canvasSize.height * zoom },
          { cssOnly: false }
        );
        fabricRef.current.renderAll();
      },
    }), [canvasSize, restoreFromHistory, editorState.borderRadius]);

    return (
      <div className="shadow-2xl">
        <canvas ref={canvasRef} />
      </div>
    );
  }
);

AnnotationCanvas.displayName = 'AnnotationCanvas';
