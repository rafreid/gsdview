# Quick Task 011 Summary

**Task:** Fix double-click and Open in Editor not launching external editor
**Date:** 2026-01-24
**Commit:** 48e6b83

## What Was Done

Fixed a bug where the "Open in Editor" functionality was not working because file paths were being constructed incorrectly.

### Root Cause

The `graph-builder.js` was not passing `sourceType` property when creating file/directory nodes from the parsed directory structure. This caused `getInspectorFilePath()` to use the wrong path prefix for `src/` files.

### Fix Applied

Added `sourceType: dirNode.sourceType` to the node creation in `src/main/graph-builder.js` line 108.

### Files Modified

| File | Change |
|------|--------|
| `src/main/graph-builder.js` | Added sourceType to addNode call |
| `src/renderer/bundle.js` | Rebuilt |

## Verification

1. Run `npm start`
2. Open a project
3. Double-click any file node - modal opens and "Open in Editor" works
4. Files from both `.planning/` and `src/` directories open correctly
