---
quick: 023
description: Fix Select Project button and File Open not working
date: 2026-01-28
commits:
  - d77b58e - Initial fix attempt (partial)
  - a4898ec - Complete fix breaking all circular dependencies
---

# Quick Task 023: Fix Select Project and File Open

**Problem:** "Select Project" button and file open functionality stopped working after v1.5 changes.

**Root Cause:** Multiple circular dependencies between modules:
1. `graph-renderer.js` imported `onFilesChanged` from `diagram-renderer.js`
2. `diagram-renderer.js` imported `openFileInspector`, `formatFileSize`, `formatRelativeTime`, `highlightNodeInGraph` from `graph-renderer.js`

The circular dependency chain via view-controller.js:
```
renderer.js → view-controller.js → diagram-renderer.js → graph-renderer.js
```

This caused module initialization to fail, preventing the event listener for the Select Project button from being attached.

**Solution:** Applied handler registry pattern and extracted shared utilities:

1. Created `shared-utils.js` for pure utility functions:
   - `formatFileSize(bytes)` - Format file size for display
   - `formatRelativeTime(timestamp)` - Format relative time

2. Extended handler registry in `state-manager.js`:
   - `registerDiagramFilesChangedHandler(handler)` / `callDiagramFilesChangedHandler(data)`
   - `registerHighlightNodeHandler(handler)` / `callHighlightNodeHandler(nodeId)`
   - `registerOpenFileInspectorHandler(handler)` / `callOpenFileInspectorHandler(node)`

3. Updated imports:
   - `graph-renderer.js` - Registers handlers at module load, imports utilities from shared-utils
   - `diagram-renderer.js` - Uses handler calls instead of direct imports from graph-renderer

**Files Modified:**
- `src/renderer/shared-utils.js` - NEW: Pure utility functions
- `src/renderer/state-manager.js` - Extended handler registry
- `src/renderer/graph-renderer.js` - Register handlers, use shared utilities
- `src/renderer/diagram-renderer.js` - Use handler calls instead of direct imports

**Verification:**
- Build succeeds without errors
- No circular dependency warnings
- Select Project button works correctly
- File Open functionality restored
