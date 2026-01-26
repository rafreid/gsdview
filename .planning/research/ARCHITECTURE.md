# Architecture Research: Claude Code + Electron Integration

**Project:** GSD Viewer
**Domain:** Real-time Claude Code operation sync with Electron desktop app
**Researched:** 2026-01-25
**Overall confidence:** HIGH

## Executive Summary

Integrating Claude Code hooks with GSD Viewer requires adding a WebSocket server to the Electron main process that receives HTTP POST requests from Claude Code hooks and broadcasts events to the renderer via IPC. This architecture maintains clean separation of concerns while enabling real-time operation tracking alongside existing file system monitoring.

**Key architectural decision:** Use a hybrid webhook-to-WebSocket pattern where Claude Code hooks POST to localhost HTTP endpoint, which immediately broadcasts to renderer via existing IPC channels. WebSocket server runs in main process, not as external servic

## Current Architecture Analysis

### Existing Components

| Component | Location | Responsibilities | Communication |
|-----------|----------|------------------|---------------|
| **Main Process** | `src/main/main.js` | IPC handlers, chokidar watchers, git operations, file I/O | IPC, file system events |
| **Preload Script** | `src/main/preload.js` | Context bridge exposing IPC APIs to renderer | Bridges main ↔ renderer |
| **Renderer Process** | `src/renderer/renderer.js` | 3D graph, UI panels, flash animations, event handling | IPC listeners, DOM |
| **Graph Builder** | `src/main/graph-builder.js` | Builds graph nodes/links from parsed data | Module exports |
| **Parsers** | `src/main/parsers/*.js` | Parse roadmap, requirements, directory, state | Sync functions |
| **Chokidar Watcher** | `src/main/main.js` (lines 67-130) | Monitors `.planning/` and `src/` directories | File system events → IPC |

### Current Data Flow

```
File System Change
    ↓
chokidar.watch event
    ↓
Debounced handler (500ms)
    ↓
mainWindow.webContents.send('files-changed', {event, path, sourceType})
    ↓
Renderer: electronAPI.onFilesChanged callback
    ↓
Flash animation + heat map update
```

**Key observations:**
- IPC already handles real-time events (`files-changed` channel)
- Debouncing prevents rapid-fire updates (500ms)
- `sourceType` field distinguishes `.planning/` vs `src/`
- Flash animations + heat maps already visualize changes
- Main process is single-threaded Node.js environment

## Proposed Architecture: WebSocket + IPC Hybrid

### Components to Add

| Component | Location | Responsibilities | Ports/Channels |
|-----------|----------|------------------|----------------|
| **WebSocket Server** | `src/main/ws-server.js` | Listen for HTTP POST from hooks, broadcast to IPC | HTTP: 3030, IPC: `claude-operation` |
| **Hook Scripts** | `.claude/hooks/*.js` | Intercept Claude Code events, POST to localhost | → HTTP POST :3030/events |
| **Hook Coordinator** | `src/main/hook-coordinator.js` | Parse hook payloads, enrich with context, route to renderer | IPC sender |

### Components to Modify

| Component | Changes | Reason |
|-----------|---------|--------|
| **Main Process** (`main.js`) | Import and initialize WebSocket server on startup | Launch WS server alongside Electron |
| **Preload Script** (`preload.js`) | Add `onClaudeOperation` IPC listener registration | Expose hook events to renderer |
| **Renderer** (`renderer.js`) | Add handler for `claude-operation` events, trigger flash animations | Visualize Claude operations |
| **package.json** | Add `ws` dependency (v8.18.0+) | WebSocket server library |

### Data Flow with Claude Code Hooks

```
Claude Code Operation (Write/Edit/Bash)
    ↓
Hook fires (PostToolUse, PreToolUse)
    ↓
Hook script (.claude/hooks/observer.js)
    ↓
HTTP POST localhost:3030/events
    {
      "session_id": "abc123",
      "hook_event_name": "PostToolUse",
      "tool_name": "Write",
      "tool_input": {"file_path": "/path/to/file.js"},
      "timestamp": 1737847200
    }
    ↓
WebSocket Server (main process)
    ↓
Hook Coordinator: Parse, enrich, validate
    ↓
mainWindow.webContents.send('claude-operation', enrichedData)
    ↓
Renderer: Flash animation + activity feed update
```

## Integration Points

### 1. WebSocket Server in Main Process

**Location:** `src/main/ws-server.js`

**Why main process:**
- Main process has full Node.js access (no sandboxing)
- Can use standard `ws` library and `http` module
- Direct access to IPC for broadcasting to renderer
- Single instance for entire application lifecycle
- No CORS issues (localhost to localhost)

**Port selection:**
- Default: 3030 (configurable via environment variable)
- Collision handling: Retry with random port if 3030 taken
- Store active port for hook configuration

**Server lifecycle:**
```javascript
// Startup: app.whenReady().then(() => startWebSocketServer())
// Shutdown: app.on('window-all-closed', () => stopWebSocketServer())
```

### 2. Hook Coordinator

**Location:** `src/main/hook-coordinator.js`

**Responsibilities:**
- Validate incoming hook payloads (schema checking)
- Enrich with project context (convert relative paths to absolute)
- Filter events (ignore non-file operations if configured)
- Rate limiting (prevent flooding renderer)
- Queue management (buffer events if renderer not ready)

**Enrichment example:**
```javascript
// Incoming: {"tool_name": "Write", "tool_input": {"file_path": "/full/path/file.js"}}
// Enriched: {
//   "tool_name": "Write",
//   "file_path": "/full/path/file.js",
//   "relative_path": "src/file.js",
//   "sourceType": "src",
//   "nodeId": "file-src-file.js",  // Match graph node ID
//   "timestamp": 1737847200
// }
```

### 3. Hook Scripts Configuration

**Location:** `.claude/hooks/hooks.json`

**Structure:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/observer.js"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/observer.js"
          }
        ]
      }
    ]
  }
}
```

**Observer script:** `.claude/hooks/observer.js`
- Read JSON from stdin (hook payload)
- HTTP POST to `http://localhost:3030/events`
- Exit code 0 (non-blocking, always allow operation)
- Timeout: 5 seconds max

### 4. IPC Channel Extension

**New channel:** `claude-operation`

**Payload format:**
```typescript
{
  session_id: string
  hook_event_name: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'SessionStart' | 'SessionEnd'
  tool_name?: string  // Only for tool-related events
  file_path?: string  // Absolute path
  relative_path?: string  // Relative to project root
  sourceType?: 'planning' | 'src' | 'unknown'
  nodeId?: string  // Matching graph node ID
  command?: string  // For Bash tool events
  timestamp: number  // Unix timestamp ms
  metadata?: {
    status?: 'success' | 'failure'
    duration?: number  // ms
  }
}
```

**Why separate channel from `files-changed`:**
- Different event sources (Claude vs file system)
- Different debouncing requirements (no debounce for Claude operations)
- Different UI treatment (distinct flash colors/animations)
- Easier to disable Claude sync without affecting file watching

### 5. Renderer Integration

**Modification:** Add listener in `renderer.js` initialization

```javascript
// Listen for Claude Code operations
window.electronAPI.onClaudeOperation((operation) => {
  if (operation.nodeId && operation.file_path) {
    // Flash animation for file nodes
    flashNode(operation.nodeId, operation.tool_name);

    // Update activity feed
    addActivityEntry({
      type: 'claude-operation',
      tool: operation.tool_name,
      path: operation.relative_path,
      timestamp: operation.timestamp
    });

    // Update heat map
    if (nodeHeatMap.has(operation.nodeId)) {
      nodeHeatMap.get(operation.nodeId).lastChangeTime = operation.timestamp;
    }
  }
});
```

**Flash animation enhancement:**
- Use different colors for Claude operations vs file changes
- Claude operations: Blue flash (0x45B7D1)
- File system changes: Yellow flash (0xFFAA00)
- Display tool name in node label during flash

## Component Boundaries

### Clear Separation of Concerns

| Boundary | Responsibility | Does NOT Handle |
|----------|----------------|-----------------|
| **Hook Scripts** | POST to localhost, exit quickly | Parsing, enrichment, UI logic |
| **WebSocket Server** | Receive HTTP, basic validation, forward to coordinator | Business logic, graph operations |
| **Hook Coordinator** | Parse, enrich, validate, queue | Network operations, rendering |
| **Main Process** | IPC broadcasting, lifecycle management | UI rendering, graph layout |
| **Renderer** | Display, animations, user interaction | File I/O, network requests |

### Why Not Put WebSocket in Renderer?

**Rejected pattern:** WebSocket client in renderer connecting to external server

**Reasons:**
1. **Security:** Renderer is sandboxed (contextIsolation: true), limited Node.js access
2. **Complexity:** Requires external server process, more moving parts
3. **Reliability:** External server can crash independently
4. **Performance:** Extra network hop (hook → server → renderer)
5. **Consistency:** IPC is already the established pattern for main ↔ renderer

**Chosen pattern:** HTTP server in main process, IPC to renderer

**Benefits:**
1. **Security:** Main process is trusted, can run HTTP server safely
2. **Simplicity:** Single Electron process, no external dependencies
3. **Reliability:** Server lifecycle tied to app lifecycle
4. **Performance:** Direct localhost HTTP, then IPC (fast)
5. **Consistency:** Uses existing IPC patterns

## Scaling Considerations

### Performance Characteristics

| Scale | Hook Events/min | Strategy | Expected Impact |
|-------|----------------|----------|-----------------|
| **Low** (1-10 ops/min) | Typical development pace | Direct forwarding, no optimization | Negligible CPU/memory |
| **Medium** (10-50 ops/min) | Active editing session | Debouncing per file (100ms), queue buffering | <1% CPU, <10MB memory |
| **High** (50-200 ops/min) | Rapid iteration, batch operations | Aggressive debouncing (500ms), sampling | ~5% CPU, ~20MB memory |
| **Extreme** (>200 ops/min) | Unusual, likely buggy hooks | Rate limiting (max 5/sec), drop events | Alert user, prevent crash |

### Resource Management

**Memory:**
- Hook payload size: ~1-5KB per event
- Queue limit: 1000 events max (FIFO, drop oldest)
- Expected usage: <10MB for typical sessions

**CPU:**
- HTTP parsing: Negligible (ws library handles)
- JSON parsing: <1ms per event
- IPC send: <1ms per event
- Renderer flash animation: 2-3ms per node

**Network:**
- Localhost only (127.0.0.1)
- No external traffic
- Zero latency concerns

### Debouncing Strategy

**Per-file debouncing:**
```javascript
const fileDebounceTimers = new Map(); // filePath -> timer

function handleHookEvent(event) {
  const key = event.file_path || event.session_id;

  if (fileDebounceTimers.has(key)) {
    clearTimeout(fileDebounceTimers.get(key));
  }

  fileDebounceTimers.set(key, setTimeout(() => {
    sendToRenderer(event);
    fileDebounceTimers.delete(key);
  }, 100)); // 100ms debounce
}
```

**Why shorter than chokidar (100ms vs 500ms):**
- Claude operations are deliberate, not rapid file saves
- Lower latency improves perceived responsiveness
- Debouncing primarily prevents duplicate hook fires

## Data Flow Diagrams

### Startup Sequence

```
1. app.whenReady()
2. Register all IPC handlers
3. startWebSocketServer(port=3030)
   ↓
   HTTP server listening on localhost:3030
   ↓
   Store server instance in main.js
4. createWindow()
   ↓
   Renderer loads, registers onClaudeOperation listener
5. Chokidar starts watching files
6. System ready
```

### Operation Sequence (Write Tool)

```
User: "Create a new file src/utils/helper.js"
    ↓
Claude: Execute Write tool
    ↓
PostToolUse hook fires
    ↓
.claude/hooks/observer.js executes
    ↓
Read stdin: {
      "hook_event_name": "PostToolUse",
      "tool_name": "Write",
      "tool_input": {"file_path": "/project/src/utils/helper.js", "content": "..."}
    }
    ↓
HTTP POST localhost:3030/events (body = stdin JSON)
    ↓
WebSocket Server receives request
    ↓
Hook Coordinator parses payload
    ↓
Enrichment:
    - file_path: "/project/src/utils/helper.js"
    - relative_path: "src/utils/helper.js"
    - sourceType: "src"
    - nodeId: "file-src-utils-helper.js"
    ↓
Send via IPC: mainWindow.webContents.send('claude-operation', enriched)
    ↓
Renderer receives event
    ↓
Parallel actions:
    1. Flash node "file-src-utils-helper.js" (blue)
    2. Add activity feed entry: "Write: src/utils/helper.js"
    3. Update heat map: set lastChangeTime
    ↓
[Separately] Chokidar detects file creation
    ↓
Send via IPC: mainWindow.webContents.send('files-changed', {...})
    ↓
Renderer receives event
    ↓
Flash node "file-src-utils-helper.js" (yellow)
    ↓
Result: Node flashes twice (blue for Claude, yellow for file system)
```

### Shutdown Sequence

```
User closes window
    ↓
mainWindow.on('closed') fires
    ↓
stopWatching() (chokidar cleanup)
    ↓
stopWebSocketServer()
    ↓
Close all active connections
    ↓
HTTP server.close()
    ↓
app.quit()
```

## Architecture Patterns

### Pattern 1: Webhook-to-IPC Bridge

**What:** HTTP POST endpoint that immediately forwards to IPC channel

**When:** External process (Claude Code) needs to notify Electron app

**Why this pattern:**
- Claude Code hooks can only execute shell commands or HTTP requests
- Electron IPC is internal-only (not accessible from external processes)
- HTTP server bridges the gap between external tool and internal app

**Implementation:**
```javascript
// src/main/ws-server.js
const http = require('http');

function createWebhookServer(port, onEvent) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/events') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const event = JSON.parse(body);
          onEvent(event); // Forward to coordinator
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({success: true}));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({error: err.message}));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, '127.0.0.1');
  return server;
}
```

### Pattern 2: Event Enrichment Layer

**What:** Middleware that adds context to raw events before rendering

**When:** External events lack context needed for UI (node IDs, source types)

**Why this pattern:**
- Claude Code hooks provide absolute paths, not graph node IDs
- Renderer needs node IDs for flash animations
- Main process has access to project structure for path resolution

**Implementation:**
```javascript
// src/main/hook-coordinator.js
const path = require('path');

function enrichHookEvent(event, projectPath) {
  const enriched = {...event};

  if (event.tool_input?.file_path) {
    const filePath = event.tool_input.file_path;
    const relativePath = path.relative(projectPath, filePath);

    // Determine sourceType
    if (relativePath.startsWith('.planning/')) {
      enriched.sourceType = 'planning';
    } else if (relativePath.startsWith('src/')) {
      enriched.sourceType = 'src';
    } else {
      enriched.sourceType = 'unknown';
    }

    // Generate node ID (must match graph-builder.js format)
    const normalizedPath = relativePath.replace(/\\/g, '/');
    enriched.nodeId = `file-${normalizedPath.replace(/\//g, '-')}`;
    enriched.relative_path = relativePath;
    enriched.file_path = filePath;
  }

  enriched.timestamp = Date.now();
  return enriched;
}
```

### Pattern 3: Dual Event Sources

**What:** Two independent event sources triggering same UI updates

**When:** Multiple systems can cause the same state change (Claude writes file, file watcher detects it)

**Why this pattern:**
- Provides redundancy (if one system fails, other still works)
- Different timing characteristics (Claude = immediate, chokidar = delayed)
- Different metadata (Claude = intent, chokidar = actual change)

**Implementation:**
```javascript
// Renderer handles both sources
electronAPI.onClaudeOperation((op) => {
  flashNode(op.nodeId, 'claude', op.tool_name);
});

electronAPI.onFilesChanged((change) => {
  flashNode(change.nodeId, 'filesystem', change.event);
});

function flashNode(nodeId, source, detail) {
  const color = source === 'claude' ? 0x45B7D1 : 0xFFAA00;
  const label = source === 'claude' ? `Claude: ${detail}` : `FS: ${detail}`;
  // Trigger flash animation with source-specific styling
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running External WebSocket Server

**What goes wrong:** Launching separate Node.js process for WebSocket server

**Why bad:**
- Additional process to manage (start, stop, monitor)
- Port conflicts with other applications
- Race conditions (server starts before Electron ready)
- Harder to debug (multiple log streams)
- Unreliable shutdown (orphaned processes)

**Instead:** Embed HTTP server in Electron main process

### Anti-Pattern 2: Synchronous Hook Processing

**What goes wrong:** Processing hook events synchronously in main process

**Why bad:**
- Main process is single-threaded
- Blocks IPC handling during processing
- Blocks chokidar events
- Blocks user interactions (window dragging, menus)
- Can freeze renderer if processing takes too long

**Instead:** Use asynchronous processing with setImmediate/process.nextTick

```javascript
// BAD
function handleHookEvent(event) {
  const enriched = enrichEvent(event);  // Synchronous processing
  validateEvent(enriched);             // Blocks main thread
  sendToRenderer(enriched);
}

// GOOD
function handleHookEvent(event) {
  setImmediate(() => {
    const enriched = enrichEvent(event);
    validateEvent(enriched);
    sendToRenderer(enriched);
  });
}
```

### Anti-Pattern 3: Unbounded Event Queue

**What goes wrong:** Accumulating hook events without limits

**Why bad:**
- Memory leak if events arrive faster than processed
- Can crash Electron with OOM (Out Of Memory)
- Performance degrades as queue grows
- No graceful degradation

**Instead:** Bounded queue with FIFO eviction

```javascript
class BoundedQueue {
  constructor(maxSize = 1000) {
    this.queue = [];
    this.maxSize = maxSize;
  }

  push(item) {
    this.queue.push(item);
    if (this.queue.length > this.maxSize) {
      const dropped = this.queue.shift();
      console.warn('Queue full, dropped event:', dropped.hook_event_name);
    }
  }

  shift() {
    return this.queue.shift();
  }
}
```

### Anti-Pattern 4: Exposing Raw Hook Payloads to Renderer

**What goes wrong:** Sending unvalidated hook data directly to renderer

**Why bad:**
- Security risk (malicious hook could inject code)
- Renderer receives inconsistent data formats
- No validation of required fields
- Hard to debug renderer issues

**Instead:** Validate and sanitize in main process

```javascript
function validateHookEvent(event) {
  if (!event.session_id || typeof event.session_id !== 'string') {
    throw new Error('Invalid session_id');
  }

  if (!event.hook_event_name || !ALLOWED_EVENTS.includes(event.hook_event_name)) {
    throw new Error('Invalid hook_event_name');
  }

  // Sanitize strings (remove control characters)
  if (event.tool_input?.file_path) {
    event.tool_input.file_path = sanitizePath(event.tool_input.file_path);
  }

  return event;
}
```

### Anti-Pattern 5: Blocking Hooks

**What goes wrong:** Hook script exits with code 2 (blocking) on POST failure

**Why bad:**
- Breaks Claude Code operation if observer.js can't reach server
- Electron app might not be running
- Network issues cause Claude to hang
- User can't use Claude without GSD Viewer running

**Instead:** Always exit 0 (non-blocking), log errors

```javascript
// .claude/hooks/observer.js
try {
  await fetch('http://localhost:3030/events', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(hookData)
  });
} catch (err) {
  // Log to file, but don't block Claude
  fs.appendFileSync('/tmp/gsd-viewer-hook.log',
    `${new Date().toISOString()} Failed to POST: ${err.message}\n`);
}
process.exit(0); // Always allow operation
```

## Technology Stack Recommendations

### Core Dependencies

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **ws** | ^8.18.0 | WebSocket server (actually just need http module) | HIGH |
| **Node http** | Built-in | HTTP server for webhook endpoint | HIGH |

**Note:** We're actually using plain HTTP server, not WebSocket protocol. The `ws` library is optional; built-in `http` module is sufficient.

### Why Not socket.io?

**socket.io** is a popular alternative but adds unnecessary overhead:
- Requires client library in renderer (extra dependency)
- Auto-reconnection logic (not needed for IPC-based architecture)
- Multiple transport fallbacks (not needed for localhost HTTP)
- Larger bundle size (~60KB vs <5KB for raw HTTP)

**Verdict:** Use Node.js built-in `http` module, skip `ws` and `socket.io` entirely.

### Updated Stack Recommendation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **Node http** | Built-in | HTTP POST endpoint | Sufficient for webhook pattern |
| **Node fs** | Built-in | Log errors from hooks | Already used in project |

**No new dependencies required.** Electron's Node.js environment provides everything needed.

## Security Considerations

### Localhost-Only Binding

**Requirement:** HTTP server must bind to 127.0.0.1 ONLY

```javascript
server.listen(3030, '127.0.0.1', () => {
  console.log('Webhook server listening on localhost:3030');
});

// DO NOT use:
// server.listen(3030, '0.0.0.0'); // Exposes to network!
// server.listen(3030); // Defaults to all interfaces!
```

**Why critical:**
- Prevents external machines from sending fake hook events
- No firewall configuration needed
- Zero network attack surface

### Input Validation

**Required checks:**
1. JSON parsing errors (try-catch)
2. Required fields present (session_id, hook_event_name)
3. Field types correct (string, number, object)
4. Path traversal prevention (file_path validation)
5. Maximum payload size (10KB limit)

```javascript
function validateRequest(req, body) {
  // Size check
  if (Buffer.byteLength(body) > 10 * 1024) {
    throw new Error('Payload too large');
  }

  // Origin check (should be localhost)
  if (req.socket.remoteAddress !== '127.0.0.1') {
    throw new Error('Non-localhost request rejected');
  }

  // Parse JSON
  const event = JSON.parse(body);

  // Required fields
  if (!event.session_id || !event.hook_event_name) {
    throw new Error('Missing required fields');
  }

  // Path traversal check
  if (event.tool_input?.file_path?.includes('..')) {
    throw new Error('Path traversal detected');
  }

  return event;
}
```

### Rate Limiting

**Protect against:**
- Buggy hooks sending flood of requests
- Accidental infinite loops
- Malicious local processes

**Implementation:**
```javascript
const rateLimiter = new Map(); // sessionId -> {count, resetTime}

function checkRateLimit(sessionId) {
  const now = Date.now();
  const limit = rateLimiter.get(sessionId);

  if (!limit || now > limit.resetTime) {
    rateLimiter.set(sessionId, {count: 1, resetTime: now + 1000});
    return true;
  }

  if (limit.count >= 50) { // Max 50 events per second per session
    return false;
  }

  limit.count++;
  return true;
}
```

### Hook Script Safety

**Best practices:**
- Exit code 0 always (never block Claude operations)
- Timeout after 5 seconds max
- Log errors to file, not stderr (avoid spamming Claude)
- No sensitive data in POST payload (file content, env vars)

## Build Order (Suggested Phases)

### Phase 1: HTTP Server Foundation (Minimal)

**Goal:** HTTP endpoint accepts POST, logs to console

**Components:**
- `src/main/ws-server.js` - Basic HTTP server
- Integration in `src/main/main.js` - Start/stop server

**Success criteria:**
- Server starts with Electron
- `curl -X POST http://localhost:3030/events -d '{"test": true}'` works
- Server stops with Electron

**Estimated effort:** 2-4 hours

**Why first:**
- Simplest piece, validates HTTP server approach
- No hook scripts needed yet
- No renderer changes needed yet
- Easy to test in isolation

### Phase 2: Hook Scripts (Observer)

**Goal:** Claude Code hooks POST to server

**Components:**
- `.claude/hooks/hooks.json` - Hook configuration
- `.claude/hooks/observer.js` - Script that POSTs to server

**Success criteria:**
- Claude Code operations trigger hooks
- HTTP server receives POST requests
- Hook data logged to console
- No errors in Claude Code

**Estimated effort:** 3-5 hours

**Why second:**
- Builds on Phase 1 HTTP server
- Validates Claude Code integration works
- Can test hooks independently of renderer

**Testing without full app:**
```bash
# Terminal 1: Start Electron app (server running)
npm start

# Terminal 2: Simulate Claude Code hook
echo '{"session_id": "test", "hook_event_name": "PostToolUse", "tool_name": "Write"}' | \
  node .claude/hooks/observer.js
```

### Phase 3: Hook Coordinator (Enrichment)

**Goal:** Parse hook payloads, enrich with context

**Components:**
- `src/main/hook-coordinator.js` - Validation, enrichment, routing

**Success criteria:**
- Raw hook events converted to enriched format
- File paths resolved to node IDs
- Source types determined correctly
- Invalid events rejected gracefully

**Estimated effort:** 4-6 hours

**Why third:**
- Core business logic for integration
- Requires understanding of graph-builder.js node ID format
- Can test with mock events before renderer integration

**Testing:**
```javascript
// Test enrichment
const event = {
  tool_input: {file_path: '/project/src/utils/helper.js'},
  hook_event_name: 'PostToolUse',
  tool_name: 'Write'
};
const enriched = enrichHookEvent(event, '/project');
console.assert(enriched.nodeId === 'file-src-utils-helper.js');
console.assert(enriched.sourceType === 'src');
```

### Phase 4: IPC Extension (New Channel)

**Goal:** Send enriched events to renderer

**Components:**
- `src/main/main.js` - Wire coordinator to IPC sender
- `src/main/preload.js` - Expose `onClaudeOperation` listener

**Success criteria:**
- Hook events reach renderer
- Payload format matches TypeScript interface
- No errors in renderer console

**Estimated effort:** 2-3 hours

**Why fourth:**
- Extends existing IPC patterns (low risk)
- Enables renderer to receive events
- Can log events in renderer before implementing UI

**Testing:**
```javascript
// In renderer.js (temporary test code)
window.electronAPI.onClaudeOperation((op) => {
  console.log('Claude operation:', op);
});
```

### Phase 5: Renderer Integration (Flash Animations)

**Goal:** Visualize Claude operations in graph

**Components:**
- `src/renderer/renderer.js` - Add handler for `claude-operation` events
- Flash animation logic (reuse existing `flashNode` function)
- Activity feed updates

**Success criteria:**
- File nodes flash when Claude writes/edits
- Different color for Claude operations vs file changes
- Activity feed shows Claude operations
- Heat map updates on Claude operations

**Estimated effort:** 5-8 hours

**Why fifth:**
- Most visible user-facing feature
- Depends on all previous phases working
- Can iterate on UX (colors, animations, labels)

**Testing:**
- Write file with Claude, verify blue flash
- Edit file with Claude, verify flash
- Compare Claude flash vs manual file save flash

### Phase 6: Error Handling & Polish

**Goal:** Production-ready reliability

**Components:**
- Error boundaries in all layers
- Rate limiting in HTTP server
- Queue management in coordinator
- User-facing error messages
- Debug logging

**Success criteria:**
- Graceful degradation if server fails to start
- No crashes on malformed hook data
- User notified if hooks not configured
- Debug mode shows hook traffic

**Estimated effort:** 4-6 hours

**Why last:**
- Handles edge cases discovered during testing
- Improves user experience
- Adds observability for debugging

## Phase Dependencies

```
Phase 1 (HTTP Server)
    ↓
Phase 2 (Hook Scripts)
    ↓
Phase 3 (Hook Coordinator)
    ↓
Phase 4 (IPC Extension)
    ↓
Phase 5 (Renderer Integration)
    ↓
Phase 6 (Error Handling)
```

**Critical path:** Must complete phases sequentially
**Parallel work:** Documentation, testing can happen alongside

## Testing Strategy

### Unit Testing

**Hook Coordinator:**
- Input: Raw hook event
- Output: Enriched event
- Test cases: File paths, source types, node IDs

**WebSocket Server:**
- Input: HTTP POST with JSON body
- Output: HTTP 200 response
- Test cases: Valid events, invalid JSON, oversized payloads

### Integration Testing

**End-to-End:**
1. Start Electron app
2. Trigger Claude Code operation (Write file)
3. Verify HTTP POST received
4. Verify enrichment correct
5. Verify IPC sent to renderer
6. Verify flash animation displays

**Mock Testing:**
- Mock HTTP POST from curl: `curl -X POST http://localhost:3030/events -d @test-event.json`
- Mock IPC from main process: `mainWindow.webContents.send('claude-operation', mockEvent)`

### Manual Testing

**Checklist:**
- [ ] Start Electron, server starts successfully
- [ ] Close Electron, server stops cleanly
- [ ] Claude Code operation triggers hook
- [ ] Hook POSTs to server without error
- [ ] Server logs received event
- [ ] Renderer shows flash animation
- [ ] Activity feed updates
- [ ] Heat map updates
- [ ] Multiple rapid operations handled (no crashes)
- [ ] Server restart (port already in use) handled
- [ ] Invalid hook data rejected gracefully

## Open Questions & Gaps

### Q1: Should we support multiple Electron instances?

**Scenario:** User opens two GSD Viewer windows for different projects

**Current design:** Single HTTP server on port 3030

**Problem:** Second instance fails to start server (port in use)

**Options:**
1. **Random port selection:** Retry with random port if 3030 taken
2. **Instance detection:** Check if another instance running, show warning
3. **Port configuration:** Let user specify port via env var or settings

**Recommendation:** Option 1 (random port), store active port in temp file for hook discovery

**Implementation:**
```javascript
function startServer(preferredPort = 3030) {
  let port = preferredPort;
  const server = http.createServer(...);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying random port`);
      port = 3030 + Math.floor(Math.random() * 1000);
      server.listen(port, '127.0.0.1');
    }
  });

  server.listen(port, '127.0.0.1', () => {
    // Write active port to temp file
    fs.writeFileSync('/tmp/gsd-viewer-port.txt', port.toString());
  });
}
```

### Q2: How to handle hooks when Electron app not running?

**Scenario:** Claude Code operates on project, GSD Viewer closed

**Current design:** Hook POSTs to localhost:3030, fails silently

**Problem:** User expects operations to be visible when they reopen app

**Options:**
1. **Ignore:** No historical data, only show real-time operations
2. **Hook logging:** Hooks write to log file if POST fails, app reads on startup
3. **Replay from transcript:** Parse Claude's transcript JSON on app startup

**Recommendation:** Option 3 (transcript replay), most reliable

**Implementation:**
```javascript
// On app startup, parse session transcript
function replaySessionTranscript(projectPath) {
  const sessionPath = path.join(projectPath, '.claude/session.jsonl');
  if (!fs.existsSync(sessionPath)) return;

  const lines = fs.readFileSync(sessionPath, 'utf-8').split('\n');
  const operations = lines
    .filter(line => line.includes('PostToolUse'))
    .map(line => JSON.parse(line));

  // Build activity history
  operations.forEach(op => {
    addActivityEntry({
      type: 'claude-operation',
      tool: op.tool_name,
      path: op.tool_input?.file_path,
      timestamp: op.timestamp
    });
  });
}
```

### Q3: Should we support remote Electron (web)?

**Scenario:** Electron app accessible via web browser (using `@electron/remote` or similar)

**Current design:** Hooks POST to localhost:3030

**Problem:** Browser can't access localhost server

**Options:**
1. **Not supported:** Document limitation, CLI-only
2. **WebSocket upgrade:** Use WebSocket protocol for browser compatibility
3. **Proxy service:** Cloud service receives hooks, forwards to web clients

**Recommendation:** Option 1 (not supported), out of scope for initial release

**Note:** `CLAUDE_CODE_REMOTE` env var indicates remote environment, hook can check this

### Q4: How to handle concurrent sessions?

**Scenario:** User has multiple Claude Code sessions for same project

**Current design:** Events keyed by session_id

**Problem:** Activity feed shows mixed operations from different sessions

**Options:**
1. **Merge all:** Single activity feed, no distinction
2. **Separate streams:** Filter by session_id in UI
3. **Show latest only:** Only track most recent session

**Recommendation:** Option 2 (separate streams), add session filter to UI

**Implementation:**
```javascript
// Track active sessions
const activeSessions = new Map(); // sessionId -> {startTime, operations[]}

function handleHookEvent(event) {
  if (!activeSessions.has(event.session_id)) {
    activeSessions.set(event.session_id, {
      startTime: Date.now(),
      operations: []
    });
  }

  activeSessions.get(event.session_id).operations.push(event);

  // Renderer: Filter activity feed by selected session
  const selectedSession = getCurrentSessionId();
  const filteredOps = activeSessions.get(selectedSession)?.operations || [];
  renderActivityFeed(filteredOps);
}
```

## Sources

### Official Documentation
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - HIGH confidence
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - HIGH confidence
- [Node.js WebSocket](https://nodejs.org/en/learn/getting-started/websocket) - HIGH confidence

### Architecture Patterns
- [Multi-Agent Observability System](https://github.com/disler/claude-code-hooks-multi-agent-observability) - MEDIUM confidence
- [Electron IPC Architecture](https://blog.logrocket.com/electron-ipc-response-request-architecture-with-typescript/) - MEDIUM confidence
- [WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices) - MEDIUM confidence

### Libraries & Tools
- [ws WebSocket Library](https://github.com/websockets/ws) - HIGH confidence
- [chokidar File Watcher](https://github.com/paulmillr/chokidar) - HIGH confidence
- [express-ws](https://www.npmjs.com/package/express-ws) - MEDIUM confidence (not recommended)

### Security & Best Practices
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security/) - HIGH confidence
- [WebSocket Security Guide](https://medium.com/@innovativejude.tech/how-to-secure-websocket-connections-in-node-js-a-step-by-step-guide-6d983a07bd96) - MEDIUM confidence
- [Electron Performance](https://www.johnnyle.io/read/electron-performance) - MEDIUM confidence

### Community Examples
- [WebSocket + Express](https://betterstack.com/community/guides/scaling-nodejs/express-websockets/) - MEDIUM confidence
- [File Explorer with chokidar + WebSocket](https://github.com/rowleyj/file-explorer) - LOW confidence (reference implementation)
- [Webhook to WebSocket Bridge](https://github.com/fabianlindfors/sockethook) - LOW confidence (Go implementation, reference only)

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| **HTTP Server in Main Process** | HIGH | Standard Electron pattern, well-documented, proven approach |
| **Hook Scripts Configuration** | HIGH | Official Claude Code documentation, clear examples |
| **IPC Extension** | HIGH | Extends existing working IPC patterns in codebase |
| **Event Enrichment** | HIGH | Straightforward path/ID mapping logic |
| **Flash Animation Integration** | HIGH | Existing flash animation code, just add new trigger |
| **WebSocket Protocol Choice** | MEDIUM | Actually using HTTP not WebSocket, simpler than researched |
| **Multi-Instance Support** | MEDIUM | Edge case, needs testing with concurrent apps |
| **Transcript Replay** | MEDIUM | Depends on Claude transcript format stability |
| **Security** | HIGH | Localhost-only binding, standard validation practices |
| **Performance** | HIGH | Minimal overhead, similar to chokidar events |

**Overall:** Architecture is sound, based on proven patterns. Main risk is multi-instance edge case and transcript replay format changes. Core integration (Phases 1-5) is HIGH confidence.
