# Technology Stack: Claude Code Integration

**Project:** GSD Viewer
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

This research focuses on **stack additions only** for Claude Code integration into the existing Electron-based GSD Viewer. The existing stack (Electron 28, 3d-force-graph, chokidar, electron-store, esbuild) remains validated and should not be changed.

**Key findings:**
- Claude Code hooks provide native integration without custom file monitoring
- WebSocket server adds unnecessary complexity — IPC is superior for Electron
- No new dependencies required for Read operation detection
- Electron 28 → 40 upgrade optional but recommended for Node.js 24 support

## Stack Additions for Claude Code Integration 

### Core: Claude Code Hooks System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Code | Latest (Jan 2026) | Hook-based event emission | Native integration — Claude Code hooks fire on Read/Write/Edit/Delete operations automatically |
| Hook scripts | N/A | JSON stdin processor | Parse Claude Code hook events and forward to Electron via IPC |

**Rationale:**
Claude Code provides a [comprehensive hooks system](https://code.claude.com/docs/en/hooks) that fires at specific lifecycle points. For file operations, the relevant hooks are:

- **PostToolUse** - Fires after Read/Write/Edit tools complete (hook receives file_path, tool_input, tool_response)
- **PreToolUse** - Fires before operations execute (allows interception)

These hooks receive structured JSON via stdin containing:
```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Read|Write|Edit",
  "tool_input": {
    "file_path": "/absolute/path/to/file.txt"
  },
  "tool_response": { ... }
}
```

**Why NOT custom fs monitoring:**
- Claude Code already instruments all file operations
- Read operations are impossible to monitor reliably with fs.watch/chokidar (they don't emit events for reads)
- Hooks provide operation type, file path, and tool context automatically

**Integration pattern:**
1. Configure `.claude/settings.json` with PostToolUse hooks
2. Hook script parses JSON stdin
3. Script sends event to Electron via HTTP request to local endpoint or writes to watched file
4. Electron main process receives event, forwards to renderer via existing IPC

### Communication: HTTP Request (NOT WebSocket)

| Technology | Version | Purpose | Why NOT |
|------------|---------|---------|---------|
| WebSocket (ws) | 8.19.0 | ❌ NOT RECOMMENDED | Unnecessary complexity for one-way events |
| HTTP Server | Built-in | ✅ RECOMMENDED | Simple POST endpoint in Electron main process |

**Rationale for HTTP over WebSocket:**

According to [Electron IPC best practices](https://www.electronjs.org/docs/latest/tutorial/ipc), **IPC is always preferred over WebSocket** for Electron applications because:
- IPC displays data instantly, WebSocket has noticeable delay ([source](https://www.scriptol.com/javascript/ipc-vs-websocket.php))
- IPC is internal to Electron, WebSocket goes through network stack
- One-way event flow (Claude hooks → Electron) doesn't need bidirectional protocol

**If WebSocket were required**, the setup would be:

```javascript
// Main process
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const event = JSON.parse(data);
    mainWindow.webContents.send('claude-event', event);
  });
});
```

**But HTTP is simpler:**

```javascript
// Main process
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const event = JSON.parse(body);
      mainWindow.webContents.send('claude-event', event);
      res.writeHead(200);
      res.end();
    });
  }
});
server.listen(8765);
```

Hook script calls:
```bash
curl -X POST http://localhost:8765/claude-event -d "$STDIN"
```

**Alternative: File-based communication** (even simpler, reuses existing chokidar):
```bash
# Hook script
echo "$STDIN" > "$CLAUDE_PROJECT_DIR/.gsd-viewer/events/$(date +%s%N).json"
```

Electron already watches `.planning/` and `src/`, extend to watch `.gsd-viewer/events/`. No server needed.

### Optional: Performance Enhancements

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| bufferutil | 4.0.8 | WebSocket masking operations | Only if WebSocket is chosen (NOT RECOMMENDED) |
| utf-8-validate | 6.0.4 | WebSocket UTF-8 validation | Only if WebSocket is chosen AND Node.js < 18.14 |

**Note:** Node.js 18.14.0+ includes built-in `buffer.isUtf8()`, making utf-8-validate unnecessary ([source](https://www.npmjs.com/package/ws)). Electron 28 uses Node.js 18.18.2, so utf-8-validate is redundant.

## Existing Stack (No Changes Needed)

| Technology | Current Version | Purpose | Status |
|------------|----------------|---------|--------|
| Electron | 28.0.0 | Desktop app framework | ✅ Working, upgrade optional |
| 3d-force-graph | 1.79.0 | 3D visualization | ✅ No changes needed |
| chokidar | 3.6.0 | File watching (Write/Create/Delete) | ✅ Extends to watch hook event files |
| electron-store | 8.2.0 | Persistent settings | ✅ No changes needed |
| esbuild | 0.27.2 | Bundler | ✅ No changes needed |

## Optional Upgrade: Electron 28 → 40

**Current:** Electron 28.0.0 (Chromium 120, Node.js 18.18.2, V8 12.0)
**Latest:** Electron 40.0.0 (Chromium 144, Node.js 24.11.1, V8 14.4) — Released Jan 13, 2026

**Benefits:**
- Node.js 24 brings performance improvements
- 6 major Node.js versions newer (18 → 24)
- Security updates across 12 Electron major versions

**Breaking changes to review** ([source](https://www.electronjs.org/docs/latest/breaking-changes)):
- **Electron 28→29**: `ipcRenderer.sendTo()` removed (not used in current code)
- **Electron 31**: WebSQL removed (not used)
- **Electron 32**: `file.path` removed, use `webUtils.getPathForFile` (not used)
- **Electron 34**: `document.execCommand("paste")` deprecated (not used)
- **Electron 39**: `--host-rules` → `--host-resolver-rules` (not used)

**Verdict:** Upgrade is LOW RISK but not required for Claude Code integration. Current code doesn't use deprecated APIs.

**Installation:**
```bash
npm install electron@40
```

## Alternatives Considered

### WebSocket Libraries

| Library | Version | Why Not |
|---------|---------|---------|
| ws | 8.19.0 | Overcomplicated for one-way event stream |
| socket.io | Latest | Even more overhead than ws, not needed |
| uWebSockets.js | Latest | High-performance but C++ native deps, overkill |

**Verdict:** Built-in HTTP or file-based communication is superior for this use case.

### IPC Enhancement Libraries

| Library | Why Not |
|---------|---------|
| electron-better-ipc | Current IPC patterns work fine, unnecessary abstraction |
| electron-common-ipc | Adds message bus complexity, existing `ipcMain.handle` is sufficient |

**Verdict:** Existing IPC with `ipcMain.handle` and `webContents.send` is proven and simple.

## Read Operation Detection: How It Works

**Problem:** File system watchers (chokidar, fs.watch) do NOT emit events for read operations. Only write/create/delete operations trigger fs events.

**Solution:** Claude Code hooks provide the ONLY reliable way to detect Read operations.

**How Claude Code detects reads:**
1. Claude Code instruments the Read tool (file reading)
2. When Claude reads a file via the Read tool, PostToolUse hook fires
3. Hook receives JSON with `"tool_name": "Read"` and `"tool_input.file_path"`
4. Hook script forwards to Electron

**Hook configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read|Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.gsd-viewer/hooks/notify-electron.sh"
          }
        ]
      }
    ]
  }
}
```

**Hook script** (`.gsd-viewer/hooks/notify-electron.sh`):
```bash
#!/bin/bash
# Parse JSON from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Forward to Electron (file-based approach)
if [ -n "$FILE_PATH" ] && [ "$FILE_PATH" != "null" ]; then
  EVENT_FILE="$CLAUDE_PROJECT_DIR/.gsd-viewer/events/$(date +%s%N).json"
  echo "{\"event\":\"$TOOL_NAME\",\"path\":\"$FILE_PATH\",\"timestamp\":$(date +%s)}" > "$EVENT_FILE"
fi
```

**Electron integration** (extend existing watcher):
```javascript
// In main.js, extend watcher to include .gsd-viewer/events/
const watchPaths = [
  path.join(projectPath, '.planning'),
  path.join(projectPath, 'src'),
  path.join(projectPath, '.gsd-viewer/events')  // NEW
];

watcher.on('add', (eventFilePath) => {
  if (eventFilePath.includes('.gsd-viewer/events/')) {
    const event = JSON.parse(fs.readFileSync(eventFilePath, 'utf-8'));
    mainWindow.webContents.send('claude-event', event);
    fs.unlinkSync(eventFilePath);  // Clean up event file
  }
});
```

**Why this works:**
- Reuses existing chokidar watcher infrastructure
- No server process needed
- No port conflicts
- File cleanup prevents disk bloat
- Atomic writes prevent race conditions

## Installation Summary

**For file-based approach (RECOMMENDED):**
```bash
# No new npm dependencies needed!
# Only requires:
# 1. Claude Code hooks configuration (.claude/settings.json)
# 2. Hook script (.gsd-viewer/hooks/notify-electron.sh)
# 3. Extend existing chokidar watcher in main.js
```

**For HTTP approach (alternative):**
```bash
# No new npm dependencies needed!
# Use Node.js built-in http module
# Requires:
# 1. Claude Code hooks configuration
# 2. Hook script with curl
# 3. HTTP server in main.js
```

**For WebSocket approach (NOT RECOMMENDED):**
```bash
# If you really want WebSocket despite IPC being better:
npm install ws@8.19.0

# Optional performance (only if using WebSocket):
npm install bufferutil@4.0.8  # Optional
# utf-8-validate NOT needed (Node.js 18.18.2 has built-in validation)
```

**For Electron upgrade (optional):**
```bash
npm install electron@40
# Review breaking changes: https://www.electronjs.org/docs/latest/breaking-changes
```

## Real-Time Event Handling Pattern

**Current pattern (file changes):**
```
File system → chokidar → debounce → mainWindow.webContents.send('files-changed')
```

**New pattern (Claude operations):**
```
Claude Code → PostToolUse hook → Shell script → Event file → chokidar → mainWindow.webContents.send('claude-event')
```

**Unified event model in renderer:**
```javascript
// Existing
window.api.onFilesChanged((event, data) => {
  // data: { event: 'add|change|unlink', path: '/path', sourceType: 'planning|src' }
  visualizer.flashNode(data.path);
});

// NEW
window.api.onClaudeEvent((event, data) => {
  // data: { event: 'Read|Write|Edit', path: '/path', timestamp: 123456 }
  visualizer.flashNode(data.path, { color: 'blue', intensity: 2 });
});
```

**Preload.js additions:**
```javascript
// In contextBridge.exposeInMainWorld
onClaudeEvent: (callback) => ipcRenderer.on('claude-event', callback)
```

## Environment Variables Available

Claude Code hooks have access to:
- `CLAUDE_PROJECT_DIR` - Absolute path to project root
- `CLAUDE_ENV_FILE` - Path to persist environment variables (SessionStart hooks only)
- Standard environment (PATH, HOME, etc.)

**Use in hook scripts:**
```bash
# Reference project-relative paths
SCRIPT_DIR="$CLAUDE_PROJECT_DIR/.gsd-viewer/hooks"
EVENT_DIR="$CLAUDE_PROJECT_DIR/.gsd-viewer/events"
```

## Security Considerations

**Claude Code hooks security:**
- Hooks execute arbitrary shell commands — review all hook scripts
- Use absolute paths or `$CLAUDE_PROJECT_DIR` for script references
- Validate JSON input before processing
- Don't expose sensitive data in event files

**Electron IPC security:**
- Context isolation already enabled (`contextIsolation: true`)
- Node integration disabled (`nodeIntegration: false`)
- Preload script whitelist APIs via contextBridge
- No additional security concerns for Claude events

## Testing Strategy

**Unit tests:**
- Mock Claude Code hook JSON input
- Test hook script parsing and event file creation
- Test Electron event processing

**Integration tests:**
1. Configure Claude Code hooks in test project
2. Run Claude Code operations (Read/Write/Edit)
3. Verify events received in Electron
4. Verify graph visualization updates

**Manual testing:**
1. Open project in GSD Viewer
2. Run Claude Code in same project directory
3. Ask Claude to read/write files
4. Verify real-time graph updates with blue flashes for reads

## Performance Characteristics

**File-based approach:**
- Latency: ~50-100ms (hook execution + fs write + chokidar detect)
- Overhead: Minimal (single file write per operation)
- Reliability: High (atomic fs operations)

**HTTP approach:**
- Latency: ~10-30ms (hook execution + HTTP POST + IPC forward)
- Overhead: HTTP server in main process
- Reliability: High (HTTP error handling needed)

**WebSocket approach (not recommended):**
- Latency: ~20-50ms (hook execution + WebSocket send + IPC forward)
- Overhead: WebSocket server in main process
- Reliability: Medium (connection management, reconnection logic)

**IPC (existing, for comparison):**
- Latency: <5ms (direct memory communication)
- Overhead: None
- Reliability: Very High (Electron-native)

## Documentation Links

**Claude Code Hooks:**
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Get Started with Hooks](https://code.claude.com/docs/en/hooks-guide)
- [Hooks in Claude Code (eesel.ai guide)](https://www.eesel.ai/blog/hooks-in-claude-code)

**Electron IPC:**
- [Inter-Process Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [IPC vs WebSocket comparison](https://www.scriptol.com/javascript/ipc-vs-websocket.php)

**WebSocket (if needed):**
- [ws npm package](https://www.npmjs.com/package/ws)
- [ws GitHub repository](https://github.com/websockets/ws)

**Electron Upgrades:**
- [Electron Releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)
- [Electron 40.0.0 Release](https://www.electronjs.org/blog/electron-40-0)

## Confidence Assessment

| Area | Confidence | Source |
|------|-----------|---------|
| Claude Code hooks API | HIGH | Official documentation via WebFetch |
| Hook event structure | HIGH | Official docs show exact JSON schemas |
| Read operation detection | HIGH | Verified PostToolUse fires for Read tool |
| File-based communication | HIGH | Reuses proven chokidar infrastructure |
| HTTP approach viability | HIGH | Node.js built-in http module |
| WebSocket NOT needed | HIGH | Multiple sources confirm IPC superiority |
| Electron 28 compatibility | HIGH | Code review shows no breaking APIs used |
| Electron 40 upgrade safety | MEDIUM | Breaking changes reviewed, appear safe |
| ws library details | HIGH | Official npm page and GitHub README |
| Performance characteristics | MEDIUM | Based on architecture analysis, not benchmarks |

## Recommendation

**RECOMMENDED APPROACH: File-based event communication**

**Why:**
1. Zero new npm dependencies
2. Reuses existing chokidar watcher
3. Simple bash scripts for hooks
4. No server lifecycle management
5. No port conflicts
6. Atomic file operations prevent race conditions

**Implementation checklist:**
- [ ] Add Claude Code hooks configuration to `.claude/settings.json`
- [ ] Create `.gsd-viewer/hooks/notify-electron.sh` script
- [ ] Extend chokidar watcher to watch `.gsd-viewer/events/`
- [ ] Add event processing logic in main.js
- [ ] Add `onClaudeEvent` IPC handler in preload.js
- [ ] Add Claude event visualization in renderer
- [ ] Test with real Claude Code operations

**NOT RECOMMENDED:**
- WebSocket server (unnecessary complexity for one-way events)
- New IPC libraries (existing IPC works perfectly)
- Electron upgrade (not required for integration, low priority)

## Questions for Validation

These questions emerged during research and should be addressed during implementation:

1. **Hook execution timing:** Does PostToolUse fire synchronously or asynchronously relative to file operations? (Impacts event ordering)
2. **Hook failure handling:** What happens if hook script fails? Does Claude Code retry? (Impacts reliability)
3. **Multi-file operations:** How do hooks fire for MultiEdit tool? One event per file or batch? (Impacts visualization)
4. **Session isolation:** Do hooks from multiple Claude Code sessions interfere? (Impacts multi-user scenarios)
5. **Event cleanup:** Should old event files be garbage collected beyond immediate cleanup? (Impacts long-running sessions)

These can be answered empirically during Phase 1 implementation.
