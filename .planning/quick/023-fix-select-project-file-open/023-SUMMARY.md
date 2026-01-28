---
quick: 023
description: Fix Select Project button and File Open not working
date: 2026-01-28
commit: d77b58e
---

# Quick Task 023: Fix Select Project and File Open

**Problem:** "Select Project" button and file open functionality stopped working after v1.5 changes.

**Root Cause:** Circular dependency between modules:
- `graph-renderer.js` imported `onFilesChanged` from `diagram-renderer.js`
- `diagram-renderer.js` imported `openFileInspector`, etc. from `graph-renderer.js`

This circular import caused module initialization to fail, preventing the event listener for the Select Project button from being attached.

**Solution:** Added handler registry pattern in `state-manager.js`:
1. `registerDiagramFilesChangedHandler(handler)` - Called by diagram-renderer.js to register its handler
2. `callDiagramFilesChangedHandler(data)` - Called by graph-renderer.js to invoke the handler

This breaks the circular dependency by having both modules import from state-manager.js (which doesn't import from either).

**Files Modified:**
- `src/renderer/state-manager.js` - Added handler registry functions
- `src/renderer/graph-renderer.js` - Removed direct import, use registry instead
- `src/renderer/diagram-renderer.js` - Register handler on module load

**Verification:**
- Build succeeds without errors
- No circular dependency warnings
- Select Project button should now work
