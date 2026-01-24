# Quick Task 011 Summary

**Task:** Fix double-click and Open in Editor not launching external editor
**Date:** 2026-01-24
**Commits:** 48e6b83, 1c056de

## What Was Done

Fixed TWO bugs preventing "Open in Editor" from working:

### Bug 1: Missing sourceType in graph-builder

The `graph-builder.js` was not passing `sourceType` property when creating file/directory nodes. This caused `getInspectorFilePath()` to use the wrong path prefix for `src/` files.

**Fix:** Added `sourceType: dirNode.sourceType` to node creation in `src/main/graph-builder.js`.

### Bug 2: IPC handler race condition

The IPC handlers for git operations (`get-git-status`, `get-git-branch`, `get-git-commits`, `add-recent-project`) were registered AFTER `createWindow()` was called, causing a race condition where the renderer tried to call them before they existed.

**Fix:** Moved `createWindow()` to the END of `app.whenReady()` block, after all IPC handlers are registered.

### Files Modified

| File | Change |
|------|--------|
| `src/main/graph-builder.js` | Added sourceType to addNode call |
| `src/main/main.js` | Moved createWindow() after IPC handler registration |
| `src/renderer/bundle.js` | Rebuilt |

## Verification

1. Run `npm start`
2. Open a project - no IPC handler errors in console
3. Double-click any file node - modal opens and "Open in Editor" works
4. Files from both `.planning/` and `src/` directories open correctly
