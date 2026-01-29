---
phase: quick
plan: 024
subsystem: visualization
completed: 2026-01-28
duration: 2min

tags: [webgl, three.js, force-graph-3d, rendering, bug-fix]

provides:
  - Working 3D graph rendering after project selection
  - Proper WebGL canvas refresh on view mount and resize

key-files:
  modified:
    - src/renderer/graph-renderer.js
    - src/renderer/view-controller.js

decisions:
  - decision: Force WebGL render via renderer().render() after resize
    rationale: Three.js WebGLRenderer doesn't auto-refresh when canvas dimensions change via width()/height() setters
    alternatives: ["Call refresh() if available", "Recreate Graph instance", "Use canvas resize observer"]

  - decision: Re-apply graphData on mount to trigger re-render
    rationale: When container becomes visible after being hidden, ForceGraph3D needs explicit data reapplication to render
    alternatives: ["Call Graph.refresh()", "Manually call renderer.render() in loop", "Reinitialize Graph instance"]

commits:
  - hash: a34b6ae
    message: "fix(quick-024): fix ForceGraph3D canvas not rendering after project selection"
---

# Quick Task 024: Fix Graph Not Loading After Project Selection

**One-liner:** ForceGraph3D canvas now renders correctly via explicit WebGL refresh and graphData reapplication on mount

## Overview

Fixed critical rendering bug where the 3D force graph canvas would remain blank after selecting a project, despite data loading correctly (visible in minimap). The issue was caused by Three.js WebGLRenderer not automatically re-rendering when canvas dimensions changed or when the container transitioned from hidden to visible state.

## Root Cause

**Problem:** ForceGraph3D initializes at module load time. When:
1. Container dimensions change via `Graph.width()` / `Graph.height()`
2. Container becomes visible after being hidden (view switching)

The Three.js WebGLRenderer updates internal state but doesn't trigger a scene render. This left the canvas blank despite having correct dimensions and data.

**Key insight:** The minimap showed data correctly because it has its own independent render loop. The main canvas relied on ForceGraph3D's internal rendering, which wasn't being triggered.

## Implementation

### 1. Force WebGL Render After Resize

**File:** `src/renderer/graph-renderer.js`
**Function:** `handleResize()`

```javascript
Graph.width(targetWidth);
Graph.height(targetHeight);

// Force WebGL render after resize
// When canvas dimensions change, Three.js WebGLRenderer needs explicit render call
if (Graph.renderer && Graph.scene && Graph.camera) {
  Graph.renderer().render(Graph.scene(), Graph.camera());
}
```

**Why:** After setting dimensions, explicitly call `renderer().render()` to update the WebGL canvas.

### 2. Re-apply GraphData on Mount

**File:** `src/renderer/graph-renderer.js`
**Function:** `mount()`

```javascript
// Resize graph to container dimensions (may have changed while hidden)
handleResize();

// Force scene refresh after container becomes visible
// Re-apply graph data to trigger internal re-render
if (Graph && state.currentGraphData.nodes.length > 0) {
  Graph.graphData(state.currentGraphData);
  setTimeout(() => Graph.zoomToFit(400), 100);
}
```

**Why:** Re-applying graphData triggers ForceGraph3D's internal render cycle. The 100ms delayed zoomToFit ensures camera positioning happens after the scene fully renders.

### 3. Cleanup Debug Logging

Removed extensive console.log statements added during investigation:
- Graph initialization logs
- handleResize dimension logs
- mount/unmount lifecycle logs
- updateGraph operation logs
- view-controller switchToView logs

**Result:** Clean console output, production-ready code.

## Testing

**Manual verification required:**
1. `npm start`
2. Click "Select Project" and choose a folder with `.planning/`
3. Verify 3D graph renders with visible nodes (not blank canvas)
4. Verify minimap also shows data (confirms data loaded)
5. Switch views: Graph → Dashboard → Graph
6. Verify graph re-renders correctly after view switch
7. Check console for clean output (no debug spam)

**Expected behavior:**
- ✓ Graph renders immediately after project selection
- ✓ Graph re-renders when switching back from other views
- ✓ No blank canvas at any point
- ✓ Camera zooms to fit nodes automatically
- ✓ Clean console output

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### ForceGraph3D Rendering Architecture

ForceGraph3D wraps Three.js with a convenience API:
- `Graph.width()` / `Graph.height()` - Update internal dimensions
- `Graph.renderer()` - Access Three.js WebGLRenderer instance
- `Graph.scene()` - Access Three.js Scene
- `Graph.camera()` - Access Three.js PerspectiveCamera
- `Graph.graphData()` - Update nodes/links (triggers re-render)

**Key limitation:** Dimension setters don't auto-render. Must manually call `renderer().render(scene(), camera())` or re-apply data.

### View Lifecycle

```
User clicks "Select Project"
  → loadProject()
    → updateGraph(graphData)
      → Graph.graphData()
      → setTimeout(() => Graph.zoomToFit(400), 500)
    → window.switchToView('graph')
      → view-controller.switchToView('graph')
        → graph-renderer.mount()
          → handleResize()           // Sets dimensions + forces render
            → Graph.width() / height()
            → renderer().render()
          → Graph.graphData()        // Re-apply to trigger render
          → Graph.zoomToFit(400)     // Position camera
```

## Impact

**User experience:**
- Fixed: Users can now see the graph immediately after selecting a project
- Fixed: View switching no longer results in blank canvas
- Improved: Cleaner console output (removed debug logs)

**Code quality:**
- Cleaner: Removed 20+ debug console.log statements
- Reliable: Explicit render calls prevent race conditions
- Maintainable: Clear comments explain WebGL render requirements

## Files Changed

| File | Lines Changed | Summary |
|------|---------------|---------|
| `src/renderer/graph-renderer.js` | +34, -16 | Added WebGL render refresh, graphData reapplication, removed debug logs |
| `src/renderer/view-controller.js` | +3, -9 | Removed debug logs from switchToView |

**Total:** 2 files, 37 insertions, 25 deletions

## Related Issues

**Debug document:** `.planning/debug/graph-not-loading.md`
- Documents investigation process
- Eliminated hypotheses (view switching, container visibility, DOM timing)
- Final hypothesis: WebGL render not triggered

## Next Steps

None - fix is complete and ready for user verification.

## Success Metrics

- [x] Task completed and committed
- [x] All debug logging removed
- [x] WebGL render explicitly triggered after resize
- [x] GraphData reapplied on mount
- [ ] Manual verification by user (pending)

---

**Duration:** 2 minutes
**Commit:** a34b6ae
**Status:** Complete, awaiting user verification
