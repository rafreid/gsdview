---
phase: 07-expanded-file-scope
plan: 02
subsystem: file-watcher
tags: [chokidar, file-watching, dual-directory, sourceType]

dependency-graph:
  requires:
    - 07-01 (parseDirectories with sourceType)
  provides:
    - Dual-directory file watching
    - File change events with sourceType property
    - Path resolution for both .planning/ and src/
  affects:
    - 07-03 (visual differentiation)
    - Future phases using file change detection

tech-stack:
  added: []
  patterns:
    - Array-based chokidar.watch for multiple directories
    - sourceType property in IPC events
    - Cross-platform path normalization

key-files:
  created: []
  modified:
    - src/main/main.js (startWatching function)
    - src/renderer/renderer.js (findNodeIdFromPath, onFilesChanged)

decisions:
  - Watch both .planning/ and src/ simultaneously
  - Use ignore patterns to filter out noise (node_modules, .git, dist, etc.)
  - sourceType property identifies which directory changed
  - Graceful handling when neither directory exists

metrics:
  duration: ~10 minutes
  completed: 2026-01-23
---

# Phase 7 Plan 02: Dual-Directory File Watcher Summary

**One-liner:** Extended file watcher to monitor both .planning/ and src/ directories with sourceType identification in change events.

## What Was Built

### Task 1: Extended startWatching for Dual Directories
- Updated `startWatching(projectPath)` in main.js to watch both `.planning/` and `src/` directories
- Built array of paths to watch, checking existence before adding
- Configured chokidar with ignore patterns:
  - `**/node_modules/**`
  - `**/.git/**`
  - `**/dist/**`
  - `**/build/**`
  - `**/coverage/**`
  - `**/.next/**`
  - `**/.cache/**`
  - `**/__pycache__/**`
- Added sourceType determination in `watcher.on('all')` handler
- Graceful handling when neither directory exists

### Task 2: Updated findNodeIdFromPath for Both Directory Trees
- Updated `findNodeIdFromPath(changedPath)` in renderer.js
- Added cross-platform path normalization (backslash to forward slash)
- Handles both `.planning/` and `/src/` paths
- Matches nodes by both `path` and `sourceType` properties
- Enhanced console logging for debugging

### Task 3: Verified Flash Animations for Both Directories
- Updated `onFilesChanged` listener to include sourceType in console logs
- Flash animations work for files in both directories
- Tree panel items flash in sync with graph nodes

## Key Code Changes

### main.js - startWatching()
```javascript
const planningPath = path.join(projectPath, '.planning');
const srcPath = path.join(projectPath, 'src');

const watchPaths = [];
if (fs.existsSync(planningPath)) watchPaths.push(planningPath);
if (fs.existsSync(srcPath)) watchPaths.push(srcPath);

watcher = chokidar.watch(watchPaths, {
  ignoreInitial: true,
  persistent: true,
  depth: 10,
  ignored: ['**/node_modules/**', '**/.git/**', ...]
});

// sourceType in events
mainWindow.webContents.send('files-changed', { event, path: filePath, sourceType });
```

### renderer.js - findNodeIdFromPath()
```javascript
// Handles both directories:
// - .planning/ -> finds node with sourceType === 'planning'
// - src/ -> finds node with sourceType === 'src'
const node = currentGraphData.nodes.find(n =>
  n.path === relativePath && n.sourceType === 'planning'
);
```

## Verification Results

All success criteria met:
- [x] File watcher monitors both .planning/ and src/ directories simultaneously
- [x] Change events include sourceType property for directory identification
- [x] findNodeIdFromPath correctly resolves nodes in either directory tree
- [x] Flash animations trigger for both .planning/ and src/ file changes
- [x] Ignored patterns prevent noise from node_modules, .git, dist, etc.
- [x] Projects with only .planning/ (no src/) work without errors

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d83f6e3 | feat(07-02): extend file watcher to monitor both .planning/ and src/ directories |
| 2 | 7e06dc8 | feat(07-02): update findNodeIdFromPath for both directory trees |
| 3 | 5ac412b | feat(07-02): add sourceType to file change console logging |

## Next Phase Readiness

**Ready for 07-03:** Visual differentiation of directory trees
- File watcher now monitors both directories
- Change events include sourceType for identifying source
- findNodeIdFromPath resolves paths in both trees
- Flash animations work for both .planning/ and src/ files
