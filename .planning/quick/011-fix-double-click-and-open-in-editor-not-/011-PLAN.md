---
phase: quick-011
type: bugfix
autonomous: true
---

# Quick Task 011: Fix Open in Editor not launching

## Problem

Double-clicking on a file node or clicking "Open in Editor" button does not open the external editor.

## Root Cause

In `src/main/graph-builder.js`, when creating nodes from the directory structure, the `sourceType` property was not being passed through to the node object. This caused `getInspectorFilePath()` in the renderer to build incorrect file paths.

For `src/` files, the function fell back to using `.planning/` prefix, generating paths like:
- `/project/.planning/renderer.js` (wrong)
Instead of:
- `/project/src/renderer.js` (correct)

## Fix

Add `sourceType: dirNode.sourceType` to the addNode call in graph-builder.js:

```javascript
addNode({
  id: dirNode.id,
  name: dirNode.name,
  type: nodeType,
  path: dirNode.path,
  extension: dirNode.extension,
  sourceType: dirNode.sourceType  // <-- Added this line
});
```

## Files Modified

- `src/main/graph-builder.js` - Pass sourceType when creating nodes
