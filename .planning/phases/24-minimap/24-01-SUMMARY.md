---
phase: 24-minimap
plan: 01
subsystem: ui
tags: [canvas, minimap, navigation, visualization, RAF]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Base 3D graph visualization with ForceGraph3D
  - phase: 02-file-watching
    provides: Dynamic graph updates for minimap synchronization
provides:
  - Minimap panel with bird's-eye 2D overview of entire graph
  - Viewport indicator showing current camera position
  - Coordinate transformation system (world ↔ minimap)
  - Continuous RAF update loop for real-time minimap sync
affects: [25-minimap-interaction, future-navigation-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas 2D rendering alongside 3D graph for complementary views"
    - "RAF-based continuous update loop for synchronized minimap rendering"
    - "Coordinate transformation helpers (worldToMinimap, minimapToWorld)"

key-files:
  created: []
  modified:
    - src/renderer/index.html
    - src/renderer/renderer.js

key-decisions:
  - "Minimap positioned bottom-right to avoid overlapping color legend (bottom-left)"
  - "Z-index 100 to match color legend panel priority"
  - "Viewport size estimation based on camera distance (0.5x distance for width)"
  - "10% padding around node bounds for minimap boundaries"
  - "Continuous RAF update loop ensures real-time sync with graph changes"

patterns-established:
  - "calculateMinimapBounds(): Recalculate bounds on each render to adapt to node movements"
  - "worldToMinimap(x, y): Convert 3D world coordinates to 2D minimap canvas coordinates"
  - "minimapToWorld(x, y): Convert minimap canvas clicks to world coordinates (for future interaction)"
  - "drawMinimapViewport(): Render teal viewport rectangle with semi-transparent fill"

# Metrics
duration: 3min
completed: 2026-01-25
---

# Phase 24 Plan 01: Minimap Panel Summary

**Bird's-eye minimap with real-time node positions and camera viewport indicator using Canvas 2D and RAF update loop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-25T02:15:12Z
- **Completed:** 2026-01-25T02:18:34Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Minimap panel with collapsible header positioned in bottom-right corner
- Real-time rendering of all nodes as teal dots using Canvas 2D API
- Camera viewport rectangle showing current view position and estimated size
- Continuous RAF update loop ensures minimap stays synchronized with graph changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Minimap UI panel and canvas element** - `ce89f13` (feat)
2. **Task 2a: Minimap coordinate system and bounds calculation** - `16ed08c` (feat)
3. **Task 2b: Minimap rendering and RAF update loop** - `d01a513` (feat)

## Files Created/Modified
- `src/renderer/index.html` - Added minimap panel HTML structure and CSS styling
- `src/renderer/renderer.js` - Added minimap state, coordinate functions, rendering logic, and RAF loop

## Decisions Made

**Viewport size estimation approach:**
- Viewport world size estimated as 0.5x camera distance (width) and 0.375x (height)
- Minimum 50 units width to ensure visibility when camera is very close
- This rough approximation works for typical viewing angles without requiring complex projection math

**Continuous updates via RAF:**
- Minimap updates every frame via requestAnimationFrame for real-time sync
- Stops RAF loop when minimap is collapsed to save resources
- Recalculates bounds on each render to adapt to node position changes

**Positioning strategy:**
- Bottom-right position avoids color legend (bottom-left) and activity panel (bottom)
- Z-index 100 matches legend priority (both should be accessible without obstruction)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with clear task breakdown.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 24 Plan 02 (Minimap click-to-navigate interaction):**
- Minimap rendering complete with accurate node positions
- minimapToWorld() helper already implemented for canvas coordinate conversion
- Viewport indicator shows current camera position for context
- RAF loop ensures minimap stays synchronized during navigation

**Foundation established:**
- Coordinate transformation system ready for click handling
- Canvas element and context initialized and rendering
- Minimap panel UI in place with collapse functionality

---
*Phase: 24-minimap*
*Completed: 2026-01-25*
