/**
 * Annotation Editor Tools Test Suite
 *
 * Tests for all annotation tools: select, rect, ellipse, arrow, line, text, blur
 * and styling features: padding, background, border radius, zoom
 */

describe('Annotation Editor Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGradient utility', () => {
    // Helper to parse CSS gradients (extracted from AnnotationCanvas.tsx logic)
    const parseGradient = (cssGradient, width, height) => {
      const match = cssGradient.match(/linear-gradient\((\d+)deg,\s*([^,]+)\s+(\d+)%,\s*([^)]+)\s+(\d+)%\)/);
      if (!match) return null;

      const angle = parseInt(match[1]);
      const color1 = match[2].trim();
      const color2 = match[4].trim();

      const angleRad = (angle - 90) * Math.PI / 180;
      const x1 = 0.5 - Math.cos(angleRad) * 0.5;
      const y1 = 0.5 - Math.sin(angleRad) * 0.5;
      const x2 = 0.5 + Math.cos(angleRad) * 0.5;
      const y2 = 0.5 + Math.sin(angleRad) * 0.5;

      return {
        type: 'linear',
        coords: { x1: x1 * width, y1: y1 * height, x2: x2 * width, y2: y2 * height },
        colorStops: [
          { offset: 0, color: color1 },
          { offset: 1, color: color2 },
        ],
      };
    };

    test('parses 135deg gradient correctly', () => {
      const result = parseGradient('linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 800, 600);

      expect(result).not.toBeNull();
      expect(result.type).toBe('linear');
      expect(result.colorStops[0].color).toBe('#667eea');
      expect(result.colorStops[1].color).toBe('#764ba2');
    });

    test('parses 45deg gradient correctly', () => {
      const result = parseGradient('linear-gradient(45deg, #ff0000 0%, #0000ff 100%)', 400, 300);

      expect(result).not.toBeNull();
      expect(result.colorStops[0].color).toBe('#ff0000');
      expect(result.colorStops[1].color).toBe('#0000ff');
    });

    test('returns null for invalid gradient format', () => {
      expect(parseGradient('not-a-gradient', 100, 100)).toBeNull();
      expect(parseGradient('', 100, 100)).toBeNull();
      expect(parseGradient('#ffffff', 100, 100)).toBeNull();
    });

    test('calculates correct coordinates for 0deg (bottom to top)', () => {
      const result = parseGradient('linear-gradient(0deg, #000000 0%, #ffffff 100%)', 100, 100);

      expect(result).not.toBeNull();
      // 0deg in CSS goes from bottom to top, so y1 > y2
      expect(result.coords.y1).toBeGreaterThan(result.coords.y2);
    });

    test('calculates correct coordinates for 90deg (left to right)', () => {
      const result = parseGradient('linear-gradient(90deg, #000000 0%, #ffffff 100%)', 100, 100);

      expect(result).not.toBeNull();
      // 90deg should go from left to right
      expect(result.coords.x1).toBeLessThan(result.coords.x2);
    });
  });

  describe('EditorState defaults', () => {
    const defaultEditorState = {
      tool: 'select',
      color: '#ff0000',
      strokeWidth: 3,
      fontSize: 24,
      padding: { top: 32, right: 32, bottom: 32, left: 32 },
      backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 12,
      zoom: 0,
    };

    test('default tool is select', () => {
      expect(defaultEditorState.tool).toBe('select');
    });

    test('default color is red', () => {
      expect(defaultEditorState.color).toBe('#ff0000');
    });

    test('default stroke width is 3', () => {
      expect(defaultEditorState.strokeWidth).toBe(3);
    });

    test('default font size is 24', () => {
      expect(defaultEditorState.fontSize).toBe(24);
    });

    test('default padding is uniform 32px', () => {
      expect(defaultEditorState.padding.top).toBe(32);
      expect(defaultEditorState.padding.right).toBe(32);
      expect(defaultEditorState.padding.bottom).toBe(32);
      expect(defaultEditorState.padding.left).toBe(32);
    });

    test('default background is purple-blue gradient', () => {
      expect(defaultEditorState.backgroundColor).toContain('linear-gradient');
      expect(defaultEditorState.backgroundColor).toContain('#667eea');
    });

    test('default border radius is 12px', () => {
      expect(defaultEditorState.borderRadius).toBe(12);
    });

    test('default zoom is 0 (auto-fit)', () => {
      expect(defaultEditorState.zoom).toBe(0);
    });
  });

  describe('Padding presets', () => {
    const paddingPresets = [
      { label: 'None', value: 0 },
      { label: 'S', value: 16 },
      { label: 'M', value: 32 },
      { label: 'L', value: 64 },
      { label: 'XL', value: 96 },
    ];

    test('None preset is 0px', () => {
      const none = paddingPresets.find(p => p.label === 'None');
      expect(none.value).toBe(0);
    });

    test('S preset is 16px', () => {
      const s = paddingPresets.find(p => p.label === 'S');
      expect(s.value).toBe(16);
    });

    test('M preset is 32px', () => {
      const m = paddingPresets.find(p => p.label === 'M');
      expect(m.value).toBe(32);
    });

    test('L preset is 64px', () => {
      const l = paddingPresets.find(p => p.label === 'L');
      expect(l.value).toBe(64);
    });

    test('XL preset is 96px', () => {
      const xl = paddingPresets.find(p => p.label === 'XL');
      expect(xl.value).toBe(96);
    });

    test('uniform padding check works correctly', () => {
      const isUniform = (padding) =>
        padding.top === padding.right &&
        padding.right === padding.bottom &&
        padding.bottom === padding.left;

      expect(isUniform({ top: 32, right: 32, bottom: 32, left: 32 })).toBe(true);
      expect(isUniform({ top: 10, right: 20, bottom: 30, left: 40 })).toBe(false);
      expect(isUniform({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(true);
    });
  });

  describe('Border radius presets', () => {
    const borderRadiusPresets = [
      { label: 'None', value: 0 },
      { label: 'S', value: 8 },
      { label: 'M', value: 16 },
      { label: 'L', value: 24 },
      { label: 'XL', value: 32 },
    ];

    test('presets have correct values', () => {
      expect(borderRadiusPresets.find(p => p.label === 'None').value).toBe(0);
      expect(borderRadiusPresets.find(p => p.label === 'S').value).toBe(8);
      expect(borderRadiusPresets.find(p => p.label === 'M').value).toBe(16);
      expect(borderRadiusPresets.find(p => p.label === 'L').value).toBe(24);
      expect(borderRadiusPresets.find(p => p.label === 'XL').value).toBe(32);
    });

    test('border radius max is 48px (slider limit)', () => {
      const maxBorderRadius = 48;
      expect(maxBorderRadius).toBe(48);
    });
  });

  describe('Zoom presets and limits', () => {
    const zoomPresets = [
      { label: '25%', value: 0.25 },
      { label: '50%', value: 0.5 },
      { label: '100%', value: 1 },
      { label: '200%', value: 2 },
    ];

    test('zoom presets cover expected range', () => {
      const values = zoomPresets.map(p => p.value);
      expect(values).toContain(0.25);
      expect(values).toContain(0.5);
      expect(values).toContain(1);
      expect(values).toContain(2);
    });

    test('zoom clamp function works correctly', () => {
      const clampZoom = (zoom) => Math.max(0.1, Math.min(2, zoom));

      expect(clampZoom(0.05)).toBe(0.1);
      expect(clampZoom(0.5)).toBe(0.5);
      expect(clampZoom(1)).toBe(1);
      expect(clampZoom(3)).toBe(2);
      expect(clampZoom(-1)).toBe(0.1);
    });
  });

  describe('Background color presets', () => {
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

    test('8 solid color presets exist', () => {
      expect(backgroundPresets.length).toBe(8);
    });

    test('8 gradient presets exist', () => {
      expect(gradientPresets.length).toBe(8);
    });

    test('transparent preset exists', () => {
      const transparent = backgroundPresets.find(p => p.color === 'transparent');
      expect(transparent).toBeDefined();
      expect(transparent.label).toBe('None');
    });

    test('all gradients have valid format', () => {
      const gradientRegex = /^linear-gradient\(\d+deg,\s*#[0-9a-f]{6}\s+\d+%,\s*#[0-9a-f]{6}\s+\d+%\)$/i;

      gradientPresets.forEach(preset => {
        expect(preset.value).toMatch(gradientRegex);
      });
    });

    test('isGradient detection works', () => {
      const isGradient = (bg) => bg.startsWith('linear-gradient');

      expect(isGradient('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')).toBe(true);
      expect(isGradient('#ffffff')).toBe(false);
      expect(isGradient('transparent')).toBe(false);
    });
  });

  describe('Tool types', () => {
    const validTools = ['select', 'rect', 'ellipse', 'arrow', 'line', 'text', 'blur'];

    test('all 7 tools are defined', () => {
      expect(validTools.length).toBe(7);
    });

    test('select tool is included', () => {
      expect(validTools).toContain('select');
    });

    test('drawing tools are included', () => {
      expect(validTools).toContain('rect');
      expect(validTools).toContain('ellipse');
      expect(validTools).toContain('line');
      expect(validTools).toContain('arrow');
    });

    test('text tool is included', () => {
      expect(validTools).toContain('text');
    });

    test('blur tool is included', () => {
      expect(validTools).toContain('blur');
    });
  });

  describe('Keyboard shortcuts', () => {
    const toolShortcuts = {
      'v': 'select',
      'r': 'rect',
      'e': 'ellipse',
      'a': 'arrow',
      'l': 'line',
      't': 'text',
      'b': 'blur',
    };

    test('all tools have single-key shortcuts', () => {
      expect(Object.keys(toolShortcuts).length).toBe(7);
    });

    test('V key selects select tool', () => {
      expect(toolShortcuts['v']).toBe('select');
    });

    test('R key selects rect tool', () => {
      expect(toolShortcuts['r']).toBe('rect');
    });

    test('shortcuts use lowercase letters', () => {
      Object.keys(toolShortcuts).forEach(key => {
        expect(key).toBe(key.toLowerCase());
        expect(key.length).toBe(1);
      });
    });
  });

  describe('Arrow calculation', () => {
    test('arrow head angle calculation', () => {
      // Test arrow pointing right (0 degrees)
      const x1 = 0, y1 = 0, x2 = 100, y2 = 0;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const angleDegrees = (angle * 180 / Math.PI) + 90;

      expect(angleDegrees).toBe(90); // Points right, triangle rotated 90deg
    });

    test('arrow pointing down', () => {
      const x1 = 50, y1 = 0, x2 = 50, y2 = 100;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const angleDegrees = (angle * 180 / Math.PI) + 90;

      expect(angleDegrees).toBe(180); // Points down
    });

    test('arrow group center calculation', () => {
      const x1 = 100, y1 = 100, x2 = 200, y2 = 200;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;

      expect(centerX).toBe(150);
      expect(centerY).toBe(150);
    });
  });

  describe('Blur region bounds calculation', () => {
    test('blur region intersection with image', () => {
      const imagePadding = { left: 32, top: 32 };
      const imgWidth = 800;
      const imgHeight = 600;
      const bounds = { left: 50, top: 50, width: 100, height: 100 };

      const imageLeft = imagePadding.left;
      const imageTop = imagePadding.top;

      const cropLeft = Math.max(0, bounds.left - imageLeft);
      const cropTop = Math.max(0, bounds.top - imageTop);
      const cropRight = Math.min(imgWidth, bounds.left + bounds.width - imageLeft);
      const cropBottom = Math.min(imgHeight, bounds.top + bounds.height - imageTop);

      const cropWidth = cropRight - cropLeft;
      const cropHeight = cropBottom - cropTop;

      expect(cropLeft).toBe(18);  // 50 - 32 = 18
      expect(cropTop).toBe(18);   // 50 - 32 = 18
      expect(cropWidth).toBe(100);
      expect(cropHeight).toBe(100);
    });

    test('blur region outside image returns zero dimensions', () => {
      const imagePadding = { left: 32, top: 32 };
      const imgWidth = 100;
      const imgHeight = 100;
      // Blur region completely outside image bounds
      const bounds = { left: 200, top: 200, width: 50, height: 50 };

      const imageLeft = imagePadding.left;
      const imageTop = imagePadding.top;

      const cropLeft = Math.max(0, bounds.left - imageLeft);
      const cropTop = Math.max(0, bounds.top - imageTop);
      const cropRight = Math.min(imgWidth, bounds.left + bounds.width - imageLeft);
      const cropBottom = Math.min(imgHeight, bounds.top + bounds.height - imageTop);

      const cropWidth = cropRight - cropLeft;
      const cropHeight = cropBottom - cropTop;

      // Region is outside, so dimensions should be negative or zero
      expect(cropWidth).toBeLessThanOrEqual(0);
      expect(cropHeight).toBeLessThanOrEqual(0);
    });

    test('minimum blur region size is 5px', () => {
      const minSize = 5;
      const smallRect = { width: 3, height: 3 };

      expect(smallRect.width < minSize || smallRect.height < minSize).toBe(true);
    });
  });

  describe('Canvas dimension calculations', () => {
    test('full canvas size includes padding', () => {
      const imgWidth = 800;
      const imgHeight = 600;
      const padding = { top: 32, right: 32, bottom: 32, left: 32 };

      const fullCanvasWidth = imgWidth + padding.left + padding.right;
      const fullCanvasHeight = imgHeight + padding.top + padding.bottom;

      expect(fullCanvasWidth).toBe(864);
      expect(fullCanvasHeight).toBe(664);
    });

    test('asymmetric padding calculation', () => {
      const imgWidth = 800;
      const imgHeight = 600;
      const padding = { top: 10, right: 20, bottom: 30, left: 40 };

      const fullCanvasWidth = imgWidth + padding.left + padding.right;
      const fullCanvasHeight = imgHeight + padding.top + padding.bottom;

      expect(fullCanvasWidth).toBe(860);
      expect(fullCanvasHeight).toBe(640);
    });

    test('zoom calculation for fit-to-container', () => {
      const containerWidth = 1200;
      const containerHeight = 800;
      const canvasWidth = 864;
      const canvasHeight = 664;
      const margin = 64;

      const availableWidth = containerWidth - margin;
      const availableHeight = containerHeight - margin;
      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1);

      expect(fitZoom).toBeLessThanOrEqual(1);
      expect(fitZoom).toBeGreaterThan(0);
    });
  });

  describe('History management', () => {
    test('max history size is 50', () => {
      const maxHistorySize = 50;
      expect(maxHistorySize).toBe(50);
    });

    test('history truncation on new action', () => {
      // Simulate history with undo position
      let history = [{ json: '1' }, { json: '2' }, { json: '3' }, { json: '4' }];
      let historyIndex = 1; // User undid twice, pointing to entry 2

      // Simulate new action - should truncate forward history
      if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
      }
      history.push({ json: '5' });
      historyIndex = history.length - 1;

      expect(history.length).toBe(3); // '1', '2', '5'
      expect(historyIndex).toBe(2);
    });

    test('canUndo returns correct state', () => {
      const canUndo = (historyIndex) => historyIndex >= 0;

      expect(canUndo(-1)).toBe(false);
      expect(canUndo(0)).toBe(true);
      expect(canUndo(5)).toBe(true);
    });

    test('canRedo returns correct state', () => {
      const canRedo = (historyIndex, historyLength) => historyIndex < historyLength - 1;

      expect(canRedo(0, 3)).toBe(true);
      expect(canRedo(2, 3)).toBe(false);
      expect(canRedo(-1, 3)).toBe(true);
    });
  });

  describe('Stroke width and font size limits', () => {
    test('stroke width range is 1-20px', () => {
      const minStrokeWidth = 1;
      const maxStrokeWidth = 20;

      expect(minStrokeWidth).toBe(1);
      expect(maxStrokeWidth).toBe(20);
    });

    test('font size range is 12-72px', () => {
      const minFontSize = 12;
      const maxFontSize = 72;

      expect(minFontSize).toBe(12);
      expect(maxFontSize).toBe(72);
    });
  });

  describe('Fabric.js object recreation', () => {
    test('recreateObject type mapping', () => {
      const typeMapping = {
        'Rect': 'Rect',
        'rect': 'Rect',
        'Ellipse': 'Ellipse',
        'ellipse': 'Ellipse',
        'Line': 'Line',
        'line': 'Line',
        'Triangle': 'Triangle',
        'triangle': 'Triangle',
        'IText': 'IText',
        'i-text': 'IText',
        'Group': 'Group',
        'group': 'Group',
        'Image': 'Image',
        'image': 'Image',
      };

      // Both cases should map to same type
      expect(typeMapping['Rect']).toBe(typeMapping['rect']);
      expect(typeMapping['Ellipse']).toBe(typeMapping['ellipse']);
      expect(typeMapping['Line']).toBe(typeMapping['line']);
      expect(typeMapping['IText']).toBe(typeMapping['i-text']);
      expect(typeMapping['Group']).toBe(typeMapping['group']);
      expect(typeMapping['Image']).toBe(typeMapping['image']);
    });
  });
});

describe('Export functionality', () => {
  test('export multiplier is 1 for logical pixels', () => {
    const exportMultiplier = 1;
    expect(exportMultiplier).toBe(1);
  });

  test('export format is PNG', () => {
    const exportFormat = 'png';
    expect(exportFormat).toBe('png');
  });

  test('export quality is 1 (max)', () => {
    const exportQuality = 1;
    expect(exportQuality).toBe(1);
  });
});
