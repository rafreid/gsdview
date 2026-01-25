---
phase: 24-minimap
plan: 02
subsystem: navigation-ui
status: complete
tags: [minimap, click-navigation, drag-navigation, camera-control, ux-polish]

requires:
  - 24-01: minimap rendering and viewport display

provides:
  - click-to-navigate: users can click minimap to jump to any graph region
  - drag-navigation: users can drag on minimap for continuous camera positioning
  - visual-polish: pointer cursor and hover effects for minimap interactivity

affects:
  - future-navigation-features: established pattern for minimap-driven camera control

tech-stack:
  added: []
  patterns:
    - minimap-navigation: coordinate transformation + camera animation for minimap interaction
    - drag-state-management: mouse event handling for drag-to-navigate UX

key-files:
  created: []
  modified:
    - src/renderer/renderer.js: minimap click/drag handlers, navigation functions
    - src/renderer/index.html: minimap canvas cursor styling and hover effects

decisions:
  - click-navigation-animation:
      chosen: 800ms smooth animation
      rationale: "Fast enough to feel responsive, slow enough to maintain spatial awareness"
      alternatives: ["instant (0ms)", "slower (1000ms+)"]
      context: "Matches existing camera transition speeds in app"

  - drag-navigation-mode:
      chosen: instant positioning (0ms duration)
      rationale: "Dragging requires real-time feedback without animation lag"
      alternatives: ["short animation (100ms)", "same as click (800ms)"]
      context: "Creates smooth continuous navigation feel during drag"

  - cursor-style:
      chosen: pointer cursor on minimap canvas
      rationale: "Standard UI convention for clickable/draggable elements"
      alternatives: ["crosshair (previous)", "grab/grabbing cursors"]
      context: "Plan explicitly requested pointer cursor, simpler than grab cursor state management"

  - drag-state-tracking:
      chosen: minimapDragging boolean flag
      rationale: "Prevents click navigation from triggering after drag completes"
      alternatives: ["distance threshold", "time threshold"]
      context: "Simple and reliable - if user dragged, don't trigger click handler"

  - global-mouseup-listener:
      chosen: document-level mouseup event listener
      rationale: "Ensures drag ends even if mouse released outside minimap canvas"
      alternatives: ["canvas-only mouseup", "mouseleave fallback only"]
      context: "Better UX - drag state doesn't get stuck if user releases outside canvas"

metrics:
  duration: 2min
  tasks: 3
  commits: 3
  files-modified: 2
  completed: 2026-01-25
---

# Phase 24 Plan 02: Minimap Click Navigation Summary

**One-liner:** Click and drag minimap navigation with smooth 800ms animations for clicks and instant positioning for drag, using pointer cursor with teal hover effects.

## What Was Built

Added complete click-to-navigate and drag-to-navigate functionality to the minimap, enabling users to quickly jump to any region of the graph by clicking or smoothly navigate by dragging on the minimap overview.

### Implementation Details

**Task 1: Click-to-navigate handler**
- Created `navigateToMinimapPosition(canvasX, canvasY)` for smooth animated navigation
- Created `handleMinimapClick(event)` to process click events
- Added click listener in `initMinimap()` function
- Uses 800ms animation duration for smooth camera transitions
- Maintains current zoom level while panning to clicked position
- Works in both 2D and 3D modes with appropriate camera positioning

**Task 2: Drag navigation for continuous positioning**
- Added `minimapDragging` boolean state variable
- Created `navigateToMinimapPositionInstant(canvasX, canvasY)` for instant (0ms) positioning
- Implemented drag handlers:
  - `handleMinimapMouseDown`: starts drag, positions camera instantly
  - `handleMinimapMouseMove`: continues drag, updates camera position
  - `handleMinimapMouseUp`: ends drag
  - `handleMinimapMouseLeave`: ends drag when mouse leaves canvas
- Added global document-level mouseup listener to handle drag ending outside canvas
- Modified `handleMinimapClick` to skip if user was dragging (prevents accidental click after drag)

**Task 3: Cursor styling and visual polish**
- Changed minimap canvas cursor from `crosshair` to `pointer`
- Added hover effects:
  - Border color changes to teal: `rgba(78, 205, 196, 0.5)`
  - Box shadow glow effect: `0 0 8px rgba(78, 205, 196, 0.2)`
- Added smooth transitions for border-color and box-shadow (0.2s ease)
- Added hover background darkening for minimap panel: `rgba(0, 0, 0, 0.85)`

### Technical Architecture

**Coordinate Transformation Flow:**
```
User Click/Drag → Canvas Coordinates → minimapToWorld() → World Coordinates
→ navigateToMinimapPosition() → Graph.cameraPosition() → Camera Movement
```

**Drag State Management:**
```
mousedown → minimapDragging = true → instant navigation
mousemove (if dragging) → continuous instant updates
mouseup/mouseleave/document.mouseup → minimapDragging = false
```

**Navigation Modes:**
- **Click mode:** 800ms animated transition, smooth fly-to effect
- **Drag mode:** 0ms instant positioning, real-time camera following

### Code Quality

- Consistent naming convention: `handleMinimap*` for event handlers
- Proper event cleanup with global mouseup listener
- Maintains existing minimap infrastructure (bounds calculation, RAF loop)
- Reuses existing coordinate transformation helpers (`minimapToWorld`)
- No duplicate code - instant vs animated navigation cleanly separated

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

**Manual verification needed:**
1. Click anywhere on minimap → camera smoothly flies to that position (800ms)
2. Click and drag on minimap → camera follows continuously without lag
3. Release drag outside minimap canvas → drag ends properly (no stuck state)
4. Hover over minimap → border glows teal, cursor shows pointer
5. Works in both 2D and 3D modes
6. Minimap updates in real-time as graph nodes are added/removed (from 24-01)

**Edge cases handled:**
- Drag ending outside canvas (global mouseup listener)
- Click after drag (minimapDragging flag prevents)
- Missing Graph or cameraPosition (guard clauses)

## Dependencies & Integration

**Depends on (from 24-01):**
- `minimapCanvas`, `minimapCtx` - canvas element and context
- `minimapToWorld(canvasX, canvasY)` - coordinate transformation
- `calculateMinimapBounds()` - bounds recalculation
- `renderMinimap()` - continuous RAF update loop
- `is3D` - mode detection for camera positioning

**Provides for future plans:**
- Interactive minimap navigation pattern
- Drag-based continuous positioning UX
- Reusable camera navigation helpers

**Integration points:**
- `Graph.cameraPosition()` - 3d-force-graph API for camera control
- Mouse event system - standard browser events
- Existing minimap rendering loop - navigation works alongside rendering

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ea00713 | feat(24-02): add minimap click-to-navigate handler |
| 2 | 9325688 | feat(24-02): add minimap drag navigation for continuous positioning |
| 3 | 2a3787c | feat(24-02): add minimap cursor styling and visual polish |

## Decisions Made

1. **Click animation duration: 800ms**
   - Matches existing camera transition speeds in codebase
   - Fast enough to feel responsive, slow enough to maintain spatial awareness

2. **Drag mode: instant positioning (0ms)**
   - Real-time feedback required for dragging UX
   - No animation lag during continuous movement

3. **Cursor style: pointer**
   - Standard UI convention for interactive elements
   - Simpler than implementing grab/grabbing cursor state management

4. **Drag state tracking: boolean flag**
   - Prevents accidental click navigation after drag completes
   - Simple and reliable approach

5. **Global mouseup listener**
   - Ensures drag ends properly even if mouse released outside canvas
   - Better UX - prevents stuck drag state

## Performance Considerations

- **Instant drag positioning:** 0ms duration prevents animation queue buildup during fast dragging
- **RAF loop reuse:** No additional rendering overhead, uses existing continuous update loop
- **Guard clauses:** Early returns prevent unnecessary calculations when Graph not ready
- **Event delegation:** Direct listeners on canvas, not document-level capture

## Known Limitations

None identified. Feature complete as specified.

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Ready for:** Phase 25 or any future minimap enhancements

## Related Files

- `src/renderer/renderer.js` - minimap navigation logic (lines ~6655-6815)
- `src/renderer/index.html` - minimap canvas styling (lines ~232-244)

## User-Facing Changes

**New capabilities:**
1. Click anywhere on minimap to fly camera to that graph region
2. Drag on minimap to continuously navigate across graph
3. Visual feedback: pointer cursor and teal glow on hover

**UX improvements:**
- Fast navigation without needing to pan/zoom on main graph
- Smooth camera transitions for click, instant following for drag
- Clear visual affordance that minimap is interactive
