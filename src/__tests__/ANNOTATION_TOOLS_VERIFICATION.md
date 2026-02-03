# Annotation Tools Manual Verification Checklist

This document provides a comprehensive verification checklist for all annotation editor tools and features. Run through this checklist after making changes to ensure all functionality works correctly.

## Prerequisites

1. Build the app: `pnpm tauri:build` or `pnpm tauri:dev`
2. Launch the app and take a screenshot (Cmd+Shift+2 by default)
3. Click "Edit" on the screenshot preview popup to open the editor

---

## Tool Tests

### Select Tool (V)

- [ ] **Activation**: Press `V` or click select tool in toolbar - tool highlights in blue
- [ ] **Object selection**: Click on any annotation to select it (shows transform handles)
- [ ] **Multi-select**: Cmd+click to select multiple objects
- [ ] **Move object**: Drag selected object to new position
- [ ] **Resize object**: Drag corner handles to resize
- [ ] **Rotate object**: Drag rotation handle to rotate
- [ ] **Delete object**: Select object and press Delete/Backspace - object is removed
- [ ] **Cannot delete background/image**: Try to delete - should not remove base image

### Rectangle Tool (R)

- [ ] **Activation**: Press `R` or click rect tool - tool highlights in blue
- [ ] **Draw rectangle**: Click and drag on canvas - rectangle appears
- [ ] **Stroke color**: Change color picker - new rectangles use selected color
- [ ] **Stroke width**: Adjust slider (1-20px) - new rectangles use selected width
- [ ] **Transparent fill**: Rectangles should have transparent fill (not solid)
- [ ] **Negative direction**: Draw from bottom-right to top-left - works correctly

### Ellipse Tool (E)

- [ ] **Activation**: Press `E` or click ellipse tool - tool highlights in blue
- [ ] **Draw ellipse**: Click and drag on canvas - ellipse appears
- [ ] **Stroke color**: Uses selected color
- [ ] **Stroke width**: Uses selected width
- [ ] **Transparent fill**: Ellipses have transparent fill
- [ ] **Aspect ratio**: Can draw both circles and ovals

### Arrow Tool (A)

- [ ] **Activation**: Press `A` or click arrow tool - tool highlights in blue
- [ ] **Draw arrow**: Click and drag - line with arrowhead appears
- [ ] **Arrowhead orientation**: Head points in direction of drag end
- [ ] **Grouped movement**: Select arrow with select tool - entire arrow moves together
- [ ] **Scaling**: Resize arrow - head stays attached and scales proportionally
- [ ] **Stroke color**: Arrow uses selected color
- [ ] **Stroke width**: Line uses selected width

### Line Tool (L)

- [ ] **Activation**: Press `L` or click line tool - tool highlights in blue
- [ ] **Draw line**: Click and drag - line appears
- [ ] **No arrowhead**: Line has no arrowhead (unlike arrow tool)
- [ ] **Stroke color**: Uses selected color
- [ ] **Stroke width**: Uses selected width

### Text Tool (T)

- [ ] **Activation**: Press `T` or click text tool - tool highlights in blue
- [ ] **Create text**: Click on canvas - "Type here" text appears in edit mode
- [ ] **Edit text**: Type to replace placeholder text
- [ ] **Font size**: Adjust slider (12-72px) - affects new text objects
- [ ] **Text color**: Uses selected color
- [ ] **Font family**: Text uses Inter or system font
- [ ] **Exit editing**: Click outside text to deselect

### Blur Tool (B)

- [ ] **Activation**: Press `B` or click blur tool - tool highlights in blue
- [ ] **Draw blur region**: Click and drag over image area
- [ ] **Pixelation effect**: Region shows pixelated/blocky version of underlying image
- [ ] **Not solid rectangle**: Should NOT be a solid dark rectangle
- [ ] **Minimum size**: Very small regions (<5px) are discarded
- [ ] **Works with padding**: Blur correctly accounts for image padding offset
- [ ] **Undo support**: Cmd+Z removes blur region

---

## Styling Features

### Padding Controls

- [ ] **Presets work**: None (0), S (16), M (32), L (64), XL (96) all apply correct padding
- [ ] **Uniform padding**: All sides update when using presets
- [ ] **Individual inputs**: Can set different values for top/right/bottom/left
- [ ] **Live preview**: Canvas updates immediately when padding changes
- [ ] **Image position**: Image moves to correct position within padded area

### Background Colors

- [ ] **Solid presets**: White, Light Gray, Dark, Black, None, Blue, Purple, Green all work
- [ ] **Transparent**: "None" shows checkered pattern indicating transparency
- [ ] **Gradient presets**: All 8 gradients render correctly
- [ ] **Custom color picker**: Can select custom hex color
- [ ] **Live preview**: Background updates immediately

### Border Radius

- [ ] **Presets work**: None (0), S (8), M (16), L (24), XL (32) all apply correctly
- [ ] **Slider range**: 0-48px
- [ ] **Rounded corners on image**: Image corners are clipped to radius
- [ ] **Rounded corners on background**: Background rect has rounded corners
- [ ] **Export preserves corners**: Saved image has transparent rounded corners

### Zoom Controls

- [ ] **Presets work**: 25%, 50%, 100%, 200% all apply correctly
- [ ] **Slider range**: 10%-200% (0.1-2.0)
- [ ] **Initial auto-fit**: Canvas fits within viewport on load
- [ ] **Zoom affects display**: Canvas scales visually at different zoom levels
- [ ] **Export ignores zoom**: Saved image is always at 1x resolution

---

## Undo/Redo System

- [ ] **Undo button**: Click undo button in top bar - reverts last action
- [ ] **Redo button**: Click redo button - restores undone action
- [ ] **Cmd+Z**: Keyboard shortcut for undo works
- [ ] **Cmd+Shift+Z**: Keyboard shortcut for redo works
- [ ] **Drawing tracked**: All tool operations are in undo history
- [ ] **Move/resize tracked**: Object modifications are in undo history
- [ ] **Delete tracked**: Can undo object deletion
- [ ] **History limit**: After 50 operations, oldest entries are removed
- [ ] **Undo to empty**: Can undo all the way back to initial state (no annotations)

---

## Keyboard Shortcuts

- [ ] **Escape**: Closes editor window
- [ ] **Cmd+S**: Saves edited screenshot
- [ ] **Cmd+C**: Copies edited screenshot to clipboard (when no text selected)
- [ ] **V, R, E, A, L, T, B**: Tool shortcuts work
- [ ] **Delete/Backspace**: Deletes selected objects in select mode

---

## Export & Save

- [ ] **Copy button**: Copies current canvas to clipboard as PNG
- [ ] **Save button**: Saves to file system
- [ ] **Border radius in export**: Transparent corners preserved in saved PNG
- [ ] **Annotations in export**: All annotations included in export
- [ ] **Resolution**: Export at logical (1x) resolution, not scaled

---

## Edge Cases

- [ ] **Retina display**: Canvas renders sharply on high-DPI screens
- [ ] **Large images**: Editor handles screenshots larger than viewport
- [ ] **Small images**: Editor handles small screenshots correctly
- [ ] **Window resize**: Canvas adjusts when editor window is resized
- [ ] **Sidebar hover**: Right sidebar appears on hover, hides on mouse leave

---

## Test Results

| Date | Tester | Pass/Fail | Notes |
|------|--------|-----------|-------|
|      |        |           |       |

---

## Running Automated Tests

```bash
# Run all Jest tests
pnpm test

# Run only annotation tool tests
pnpm test annotationTools
```
