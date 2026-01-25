---
phase: 27-chokidar-extension-ipc
plan: 01
subsystem: electron-main-process
tags: [electron, ipc, chokidar, file-watching, event-processing]
requires: [26-hook-infrastructure]
provides: [claude-event-forwarding, event-deduplication, ipc-channel-claude-operation]
affects: [28-renderer-event-consumer]
tech-stack:
  added: []
  patterns: [event-queue-processing, deduplication-window, node-id-enrichment]
key-files:
  created: []
  modified: [src/main/main.js, src/main/preload.js]
decisions:
  - id: claude-events-separate-watcher
    choice: Use separate chokidar watcher for Claude events vs file changes
    rationale: Different lifecycle and processing requirements (no debounce for Claude events)
  - id: dedup-window-200ms
    choice: 200ms deduplication window for same file_path
    rationale: Hooks can fire twice for same operation, need to suppress duplicates
  - id: serial-queue-processing
    choice: Queue-based serial processing instead of parallel
    rationale: Maintain event order and prevent race conditions
  - id: nodeId-enrichment-pattern
    choice: Match graph-builder node ID format (sourceType:/relative/path)
    rationale: Enables direct node lookup in renderer graph
metrics:
  duration: 101s
  completed: 2026-01-25
---

# Phase 27 Plan 01: Chokidar Extension IPC Summary

**One-liner:** Electron main process watches Claude operation events, deduplicates, enriches with nodeId, and forwards via IPC

## What Was Built

Complete event pipeline from `.gsd-viewer/events/` directory to renderer IPC channel:

1. **Claude Event Watcher** - Separate chokidar watcher monitoring `.gsd-viewer/events/`
2. **Event Processing Pipeline** - Parse, validate, deduplicate, enrich, queue, forward, cleanup
3. **IPC Listener Exposure** - `window.electronAPI.onClaudeOperation()` for renderer subscription

**Event Flow:**
```
Hook writes event file
  → Chokidar 'add' event fires
  → handleClaudeEvent() parses & validates
  → Deduplication check (200ms window)
  → Queue for serial processing
  → enrichEventWithNodeId() adds nodeId
  → Forward via 'claude-operation' IPC
  → Delete event file
```

## Implementation Details

### Deduplication Logic
- Map tracks `file_path → timestamp`
- Events for same file within 200ms window are ignored
- Automatic cleanup of entries older than 1 minute (prevents memory leak)

### Node ID Enrichment
Matches graph-builder pattern for direct node lookup:
- Planning files: `planning:/STATE.md`
- Source files: `src:/main/main.js`
- Unknown files: `null` nodeId (still forwarded with full path)

### Serial Processing Queue
- Prevents race conditions from simultaneous events
- Maintains order of operations
- Lock flag prevents queue re-entry

## Key Files Modified

### src/main/main.js
- **Added:** Module-level event watcher state variables
- **Added:** `startClaudeEventWatcher()` - Initialize watcher on project load
- **Added:** `stopClaudeEventWatcher()` - Cleanup on project unload
- **Added:** `handleClaudeEvent()` - Parse, validate, deduplicate
- **Added:** `processEventQueue()` - Serial forwarding to renderer
- **Added:** `enrichEventWithNodeId()` - Graph node ID matching
- **Updated:** `startWatching()` now also starts Claude event watcher
- **Updated:** `stopWatching()` now also stops Claude event watcher

### src/main/preload.js
- **Added:** `onClaudeOperation` listener to `electronAPI` object
- Follows existing `onFilesChanged` pattern

## Task Breakdown

| Task | Name                       | Commit  | Files                    |
|------|----------------------------|---------|--------------------------|
| 1    | Claude Event Watcher       | d5f2d32 | src/main/main.js         |
| 2    | Event Processing Pipeline  | 98dc47f | src/main/main.js         |
| 3    | Preload IPC Listener       | 19c1e8f | src/main/preload.js      |

## Decisions Made

### Decision: Separate watcher for Claude events
**Rationale:** File changes require debouncing (multiple rapid changes), but Claude events are already discrete operations that should not be debounced.

### Decision: 200ms deduplication window
**Rationale:** Phase 26 documented that hooks can fire twice for the same operation. Window is long enough to catch duplicates but short enough to not suppress legitimate rapid operations.

### Decision: Serial queue processing
**Rationale:** Maintains chronological order of operations for correct visualization. Prevents potential file deletion race conditions.

### Decision: Node ID format matches graph-builder
**Rationale:** Enables renderer to directly look up and highlight graph nodes without additional translation layer.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 28 Prerequisites Met:**
- ✅ IPC channel 'claude-operation' operational
- ✅ Events enriched with nodeId matching graph nodes
- ✅ Event schema validated (operation, file_path, timestamp, nodeId, sourceType)
- ✅ Deduplication prevents duplicate visual updates

**Blockers for Phase 28:** None

**Concerns:**
- Renderer must handle events with `nodeId: null` (files outside src/ or .planning/)
- Consider rate limiting if Claude generates hundreds of events (unlikely but possible)

## Testing Notes

**Manual Testing:**
Application successfully:
1. Starts and logs "[ClaudeEvents] Watching: {path}"
2. Event files in `.gsd-viewer/events/` trigger processing
3. Events validated for required fields (operation, file_path, timestamp)
4. Duplicate events within 200ms suppressed
5. Events enriched with nodeId in correct format
6. Events forwarded via IPC 'claude-operation' channel
7. Event files cleaned up after processing
8. DevTools console shows `typeof window.electronAPI.onClaudeOperation === 'function'` → true

**Test Event Example:**
```json
{
  "schema_version": "1.0",
  "timestamp": 1737829200000,
  "operation": "read",
  "file_path": "/home/rafreid/AFLUXSYS/products/GSDv/src/main/main.js",
  "tool": "Read",
  "source": "claude-code"
}
```

**Enriched Output:**
```javascript
{
  schema_version: "1.0",
  timestamp: 1737829200000,
  operation: "read",
  file_path: "/home/.../src/main/main.js",
  tool: "Read",
  source: "claude-code",
  nodeId: "src:/main/main.js",      // ← Added
  sourceType: "src"                  // ← Added
}
```

## Success Criteria Met

- ✅ Application starts and shows "[ClaudeEvents] Watching:" in console
- ✅ New event files in .gsd-viewer/events/ trigger processing
- ✅ Events enriched with nodeId matching graph node format
- ✅ Duplicate events (same file_path within 200ms) ignored
- ✅ IPC channel 'claude-operation' delivers events to renderer
- ✅ Event files deleted after processing
- ✅ window.electronAPI.onClaudeOperation available to renderer

## Handoff to Phase 28

**What Phase 28 Will Receive:**
- IPC events via `window.electronAPI.onClaudeOperation(callback)`
- Event structure: `{ operation, file_path, timestamp, nodeId, sourceType, tool, source }`
- Operations: 'read', 'write', 'edit'
- nodeId format: 'src:/path' or 'planning:/path' (or null)

**What Phase 28 Should Do:**
1. Subscribe to `onClaudeOperation` on app initialization
2. Look up nodeId in graph data structure
3. Apply visual flash/pulse animation to node
4. Handle null nodeId gracefully (file outside watched directories)
5. Consider animation queue if many events arrive simultaneously

**Pattern to Follow:**
```javascript
window.electronAPI.onClaudeOperation((event) => {
  const node = graphData.nodes.find(n => n.id === event.nodeId);
  if (node) {
    flashNode(node, event.operation); // Different colors for read/write/edit
  }
});
```
