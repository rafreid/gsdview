# Quick Task 008: Fix Path Error - Missing sourceType

## Issue
Clicking on `src/` files in the graph caused an ENOENT error:
```
Error reading file: ENOENT: no such file or directory, stat '.planning/renderer/bundle.js'
```

The path was incorrectly resolving `src/renderer/bundle.js` to `.planning/renderer/bundle.js`.

## Root Cause
In `buildGraphFromProject()` (renderer.js line ~1367), when adding directory/file nodes to the graph, the `sourceType` property was not being copied from the parsed directory nodes:

```javascript
// BEFORE (missing sourceType)
for (const dirNode of directory.nodes) {
  addNode({
    id: dirNode.id,
    name: dirNode.name,
    type: dirNode.type,
    path: dirNode.path,
    extension: dirNode.extension
  });
}
```

This caused `showDetailsPanel()` to fall back to the `.planning/` prefix (line 1852) since `node.sourceType` was undefined.

## Fix
Added `sourceType: dirNode.sourceType` to preserve the source type when building graph nodes:

```javascript
// AFTER (sourceType included)
for (const dirNode of directory.nodes) {
  addNode({
    id: dirNode.id,
    name: dirNode.name,
    type: dirNode.type,
    path: dirNode.path,
    extension: dirNode.extension,
    sourceType: dirNode.sourceType
  });
}
```

## Files Modified
- `src/renderer/renderer.js` - Added sourceType to addNode() call

## Commit
- `66fa2a9` - fix(quick-008): add missing sourceType when building graph nodes

## Verification
After the fix, clicking on src/ files now correctly resolves to `{projectPath}/src/{filePath}` and file content preview works.
