---
phase: 33-interactivity
plan: "01"
subsystem: diagram-interactivity
tags: [d3.js, svg, file-inspector, tooltips, collapse, click-handlers]

requires:
  - "32-02: Artifact blocks rendered with status indicators"
  - "13-01: File inspector modal implementation"
  - "16-01: File metadata helpers (formatFileSize, formatRelativeTime)"

provides:
  - "Clickable artifacts in diagram view that open file inspector"
  - "Hover tooltips showing file metadata in diagram view"
  - "Stage collapse/expand toggle in diagram view"

affects:
  - "33-02: Multi-stage selection and navigation"
  - "Future: Diagram keyboard shortcuts"

tech-stack:
  added: []
  patterns:
    - "D3.js event handlers (.on) for SVG interactivity"
    - "Shared function exports between graph-renderer and diagram-renderer"
    - "Set data structure for collapsed state tracking"

key-files:
  created: []
  modified:
    - src/renderer/index.html: "Added #diagram-tooltip CSS and HTML element"
    - src/renderer/diagram-renderer.js: "Added click handlers, hover tooltips, collapse toggle"
    - src/renderer/graph-renderer.js: "Exported openFileInspector, formatFileSize, formatRelativeTime"

decisions:
  - key: "Export inspector functions from graph-renderer"
    rationale: "Reuse existing file inspector modal for diagram view instead of duplicating code"
    alternatives: ["Duplicate modal implementation", "Create shared module"]
    
  - key: "Separate #diagram-tooltip element"
    rationale: "Avoid conflicts with graph view tooltip, allow diagram-specific styling"
    alternatives: ["Reuse #tooltip", "Create tooltip component"]
    
  - key: "In-memory Set for collapsed state"
    rationale: "State resets on view switch, no persistence needed for v1.5"
    alternatives: ["Persist to electron-store", "Add to state-manager"]

metrics:
  duration: "5min"
  completed: "2026-01-28"
---

# Phase 33 Plan 01: Core Diagram Interactions Summary

**One-liner:** Click artifacts to inspect, hover for metadata tooltips, toggle stage collapse with +/- indicators

## What Was Built

Added three core interactive features to the diagram view:

1. **Artifact Click Handlers**
   - Clicking any artifact block opens the file inspector modal
   - Imports `openFileInspector` from graph-renderer for code reuse
   - Builds node object with planning sourceType and relative path
   - Added cursor:pointer for visual affordance

2. **Hover Tooltips**
   - Hovering artifacts shows metadata tooltip (name, size, modified, status)
   - Tooltip follows cursor position with 15px offset
   - Uses formatFileSize and formatRelativeTime from graph-renderer
   - Separate #diagram-tooltip element prevents graph view conflicts

3. **Stage Collapse/Expand**
   - Click stage header to toggle artifact visibility
   - Collapse indicator shows + (collapsed) or - (expanded)
   - Smooth opacity transitions (0 to 1)
   - State tracked in collapsedStages Set (reset on view switch)

## Technical Implementation

**Exports from graph-renderer.js:**
```javascript
export async function openFileInspector(node)
export function formatFileSize(bytes)
export function formatRelativeTime(timestamp)
```

**Imports in diagram-renderer.js:**
```javascript
import { openFileInspector, formatFileSize, formatRelativeTime } from './graph-renderer.js';
const fs = window.require('fs');
const path = window.require('path');
```

**Event Handlers on Artifact Groups:**
- `click`: Opens file inspector with constructed node object
- `mouseover`: Shows tooltip with file stats
- `mouseout`: Hides tooltip
- `mousemove` (on SVG): Positions tooltip near cursor

**Collapse Toggle:**
- Click handler on stage header rect
- `toggleStageCollapse(stageId)` function toggles Set membership
- Updates opacity and pointer-events on artifacts and "+N more" text
- Updates collapse indicator text (+ / -)

## Files Changed

| File | Lines Changed | Purpose |
|------|---------------|---------|
| src/renderer/index.html | +24 | Added #diagram-tooltip CSS and HTML element |
| src/renderer/diagram-renderer.js | +97 | Click handlers, hover tooltips, collapse toggle |
| src/renderer/graph-renderer.js | +3 | Exported 3 functions (openFileInspector, formatFileSize, formatRelativeTime) |

## Testing Performed

Manual verification confirms:
- ✅ Clicking artifacts opens file inspector with correct file contents
- ✅ Hover shows tooltip with name, size, modified time, status
- ✅ Tooltip follows cursor position smoothly
- ✅ Stage header click toggles artifacts (opacity 0/1)
- ✅ Collapse indicator changes (+ / -)
- ✅ Modal close (X or Escape) works from diagram view
- ✅ No console errors during interactions

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] INTR-01: Artifact click opens file inspector modal
- [x] INTR-02: Hover shows tooltip with file metadata
- [x] INTR-03: Stage header click expands/collapses artifacts
- [x] No console errors during interactions
- [x] Tooltip follows cursor position
- [x] Modal displays correct file contents

## Decisions Made

1. **Shared Inspector Modal**: Reused graph-renderer's openFileInspector instead of creating diagram-specific modal. Reduces code duplication and ensures consistent UX across views.

2. **Separate Tooltip Element**: Created #diagram-tooltip instead of reusing #tooltip to avoid z-index and visibility conflicts between views.

3. **No Persistence for Collapsed State**: Collapse state resets when switching views. Acceptable for v1.5 MVP; can add persistence later if users request it.

## Known Limitations

- Collapsed state is not persisted (resets on view switch)
- Tooltip disappears if mouse moves fast (inherent SVG limitation)
- No keyboard shortcuts for collapse/expand (planned for future)

## Next Phase Readiness

**Ready for 33-02:** Multi-stage selection and navigation will build on these interaction primitives.

**Potential enhancements:**
- Persist collapsed state to electron-store
- Add keyboard shortcuts (C to collapse all, E to expand all)
- Tooltip animation transitions (fade in/out)
- Double-click to expand all artifacts in stage

## Performance Notes

- No performance issues observed
- Tooltip positioning via RAF mousemove is smooth
- Opacity transitions are GPU-accelerated (CSS)
- Set operations for collapse state are O(1)

## Commits

| Hash | Message |
|------|---------|
| cae97ed | feat(33-01): add artifact click handlers and tooltip element |
| 07e850e | feat(33-01): add hover tooltip with file metadata |
| 3494e19 | feat(33-01): add stage header expand/collapse toggle |
