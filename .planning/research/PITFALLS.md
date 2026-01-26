# Real-Time Event Integration Pitfalls

**Domain:** Adding WebSocket/Hook Integration to Existing Electron Visualization App
**Researched:** 2026-01-25
**Confidence:** MEDIUM-HIGH

This research identifies common mistakes when adding real-time external event integration (Claude Code hooks via WebSocket) to an existing Electron visualization application with animation-based feedback.

---

## Critical Pitfalls  

Mistakes that cause rewrites, data corruption, or major architectural changes.

### Pitfall 1: Duplicate Hook Events from Directory Context

**What goes wrong:** Claude Code hooks fire duplicate events when running from certain directories (particularly home directory), causing double animations, duplicate activity log entries, and state corruption.

**Why it happens:**
- Claude Code has a known issue where hook events fire twice from home directory
- Configuration loading hierarchy or session management creates duplicate registration
- Directory-specific behavior affects hook execution

**Consequences:**
- Every file operation triggers TWO flash animations instead of one
- Activity log fills with duplicate entries
- Performance degrades from processing same event twice
- User confusion from doubled visual feedback
- Token waste from duplicate context window updates

**Prevention:**
1. **Event deduplication layer** - Track recent event hashes/signatures with timestamp window (200-500ms)
2. **Idempotency keys** - Add unique event ID to each hook payload, discard duplicates
3. **Source tracking** - Log hook event source to detect if same event arrives twice
4. **Validation** - Check event timestamp + path combo hasn't been processed recently

**Detection:**
- Activity log shows identical events within <500ms
- Same file node flashes twice in rapid succession
- WebSocket server logs show duplicate messages for single operation
- Performance profiling shows duplicate processing paths

**Which phase:** Phase 1 (WebSocket server + hook integration) - MUST address before proceeding to animation sync

**Sources:**
- [Claude Code Hook Events Fired Twice When Running from Home Directory · Issue #3465](https://github.com/anthropics/claude-code/issues/3465)

---

### Pitfall 2: Event Ordering Lost in Async Processing

**What goes wrong:** Events arrive in correct order via WebSocket (TCP guarantees) but get processed out-of-order due to async handlers, causing animations to show wrong sequence (e.g., file deleted BEFORE it was created).

**Why it happens:**
- WebSocket protocol guarantees message ordering (TCP)
- Application-level async handlers don't preserve that order
- Multiple async operations (file system checks, graph updates, animation triggers) race
- Renderer IPC handlers process events independently without coordination

**Consequences:**
- Graph shows file deletion before creation
- Animation sequence incorrect (flash effect for delete before create)
- Activity log displays events in wrong chronological order
- State diverges from reality
- User loses trust in visualization accuracy

**Prevention:**
1. **Message queue with serial processing** - Queue all events, process one at a time
2. **Sequence numbers** - Add incrementing ID to each event, reject out-of-order
3. **Promise chaining** - Chain async operations so they complete in order
4. **Single processing loop** - Centralized event processor with FIFO queue

**Implementation Pattern:**
```javascript
// BAD: Parallel async handlers
ws.on('message', async (event) => {
  await processEvent(event); // Multiple can run simultaneously
});

// GOOD: Serial queue
const eventQueue = [];
let processing = false;

ws.on('message', (event) => {
  eventQueue.push(event);
  processQueue();
});

async function processQueue() {
  if (processing) return;
  processing = true;
  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    await processEvent(event);
  }
  processing = false;
}
```

**Detection:**
- Activity log timestamps correct but visual order wrong
- Graph state inconsistent with file system
- Animation for operation X starts after animation for later operation Y
- Race conditions in tests

**Which phase:** Phase 1 (WebSocket integration) - Must establish queue before adding complex animations

**Sources:**
- [WebSockets guarantee order - so why are my messages scrambled?](https://www.sitongpeng.com/writing/websockets-guarantee-order-so-why-are-my-messages-scrambled)
- [Handling Race Conditions in Real-Time Apps](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8)

---

### Pitfall 3: Main Process Blocking from WebSocket Server

**What goes wrong:** Running WebSocket server in Electron main process blocks the renderer, freezing UI during message processing or connection handling.

**Why it happens:**
- Main process can block renderer process despite being "separate"
- They aren't truly asynchronous - shared event loop characteristics
- Heavy WebSocket message processing blocks main process event loop
- Renderer waits for IPC responses from blocked main process

**Consequences:**
- Graph animations freeze mid-flash
- UI becomes unresponsive during file operation bursts
- Camera controls lag or stop working
- Application appears hung to user
- 60fps animation target impossible to maintain

**Prevention:**
1. **Separate worker process** - Run WebSocket server in dedicated Node.js child process, not main
2. **Offload to renderer** - Run WebSocket client in renderer with proper isolation
3. **Non-blocking patterns** - Use setImmediate(), process.nextTick() for CPU-intensive tasks
4. **Throttle message processing** - Batch events, process in chunks with yields

**Architecture Decision:**
```
OPTION A (Recommended): Separate Worker
- main.js: Electron main process (window management)
- ws-server.js: Child process running WebSocket server
- Communication: IPC between main and ws-server
- Benefits: True isolation, can't block renderer

OPTION B (Riskier): Renderer WebSocket Client
- renderer.js: WebSocket client connects to external server
- Benefits: Natural separation from main
- Risks: Must handle preload/context bridge carefully

OPTION C (Avoid): Main Process Server
- main.js: WebSocket server + Electron main
- Risks: High chance of blocking renderer
```

**Detection:**
- DevTools performance profiling shows main process CPU spikes
- UI freezes correlate with WebSocket message arrival
- requestAnimationFrame callbacks delayed during WS activity
- Chrome DevTools FPS meter drops below 60fps

**Which phase:** Phase 1 (Architecture) - Must decide before implementation begins

**Sources:**
- [The Horror of Blocking Electron's Main Process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c)
- [Electron Performance Documentation](https://www.electronjs.org/docs/latest/tutorial/performance)

---

### Pitfall 4: State Divergence on WebSocket Reconnect

**What goes wrong:** When WebSocket reconnects after disconnection, client state (last processed event, current graph state) doesn't sync with server, causing missed events or duplicate processing.

**Why it happens:**
- Socket IDs regenerate after reconnection
- Server doesn't remember client's last processed event
- Client doesn't request missed events from disconnect period
- No state synchronization protocol on reconnect

**Consequences:**
- File operations during disconnect never visualized
- Graph becomes stale (missing nodes, wrong state)
- User sees incomplete project visualization
- Reconnect might replay old events causing duplicate animations
- Activity log has gaps in timeline

**Prevention:**
1. **Event sourcing with sequence numbers** - Server tracks event sequence, client requests since last known
2. **Reconnection handshake** - Client sends last event ID, server replays missed events
3. **Periodic full sync** - Every N minutes, send full state snapshot to detect drift
4. **Optimistic queue** - Queue events during disconnect, reconcile on reconnect

**Handshake Protocol:**
```javascript
// On reconnect:
ws.on('open', () => {
  const lastEventId = localStorage.getItem('lastProcessedEventId');
  ws.send(JSON.stringify({
    type: 'RECONNECT',
    lastEventId: lastEventId || 0
  }));
});

// Server responds with missed events:
server.on('RECONNECT', (client, msg) => {
  const missedEvents = getEventsSince(msg.lastEventId);
  client.send(JSON.stringify({
    type: 'SYNC',
    events: missedEvents
  }));
});
```

**Detection:**
- Activity log has timestamp gaps
- Graph state doesn't match file system after reconnect
- Manual file system scan shows differences from graph
- User reports "missing changes" after network issues

**Which phase:** Phase 2 (Connection management) - Add after basic WebSocket working

**Sources:**
- [WebSocket Reconnect: Strategies for Reliable Communication](https://apidog.com/blog/websocket-reconnect/)
- [Troubleshooting connection issues | Socket.IO](https://socket.io/docs/v4/troubleshooting-connection-issues/)

---

### Pitfall 5: Memory Leaks from Unregistered Event Listeners

**What goes wrong:** WebSocket and IPC event listeners accumulate without cleanup, causing memory to grow unbounded until app crashes or slows to unusable state.

**Why it happens:**
- New listeners added on every WebSocket reconnect
- IPC listeners registered without corresponding removeListener
- Graph animation callbacks retain references to old nodes
- Activity trail objects never garbage collected

**Consequences:**
- Memory usage grows continuously (100MB -> 500MB -> 1GB+)
- Application slows over time
- MaxListenersExceeded warnings in console
- Eventually crashes or becomes unresponsive
- Node.js default limit is 10 listeners per event

**Prevention:**
1. **Cleanup pattern** - Always pair addEventListener with removeEventListener
2. **Component lifecycle hooks** - Use destroy/unmount to clean up listeners
3. **WeakMap for references** - Use WeakMap for graph node callbacks to allow GC
4. **Connection singleton** - Reuse single WebSocket connection, don't create new

**Cleanup Pattern:**
```javascript
// BAD: Memory leak
function setupWebSocket() {
  const ws = new WebSocket(url);
  ws.on('message', handleMessage); // Listener never removed
  return ws;
}

// GOOD: Proper cleanup
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.boundHandleMessage = this.handleMessage.bind(this);
  }

  connect() {
    this.ws = new WebSocket(url);
    this.ws.on('message', this.boundHandleMessage);
  }

  disconnect() {
    if (this.ws) {
      this.ws.off('message', this.boundHandleMessage);
      this.ws.close();
      this.ws = null;
    }
  }
}
```

**Detection:**
- Node.js process RSS memory continuously growing
- MaxListenersExceededWarning in DevTools console
- Chrome DevTools heap snapshots show increasing object counts
- Application slows after hours of use
- Event listener count increases in profiler

**Which phase:** Phase 1 & ongoing - Establish cleanup patterns from start, audit regularly

**Sources:**
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Memory leak when passing IPC events over contextBridge · Issue #27039](https://github.com/electron/electron/issues/27039)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or require refactoring.

### Pitfall 6: Animation Queue Overflow from Event Bursts

**What goes wrong:** During massive file operations (Git operations, bulk saves, directory scans), hundreds of events arrive in milliseconds, overwhelming the animation queue and causing frame drops, lag, or skipped animations.

**Why it happens:**
- Each file change triggers full animation sequence (flash + glow + fade)
- No throttling on incoming events
- requestAnimationFrame queue fills faster than 60fps can render
- Three.js scene has too many simultaneous material updates

**Consequences:**
- FPS drops from 60 to <15 during bursts
- Animation stutters and jerks
- Some file changes never animate (queue overflow)
- UI becomes laggy and unresponsive
- User experience severely degraded

**Prevention:**
1. **Event batching** - Collect events in time window (100-200ms), animate batch as single pulse
2. **Animation pooling** - Reuse animation objects instead of creating new
3. **Priority queue** - Animate only visible nodes, skip off-screen
4. **Debouncing** - Ignore rapid events for same file within threshold
5. **Frame budget** - Limit animations per frame to maintain 60fps

**Batching Implementation:**
```javascript
const eventBatch = new Map(); // path -> latest event
const BATCH_WINDOW = 150; // ms

function queueEvent(event) {
  eventBatch.set(event.path, event);

  clearTimeout(batchTimer);
  batchTimer = setTimeout(() => {
    const batchedEvents = Array.from(eventBatch.values());
    animateBatch(batchedEvents);
    eventBatch.clear();
  }, BATCH_WINDOW);
}
```

**Detection:**
- Chrome DevTools FPS meter shows drops during file operations
- Performance profiling shows long frame times (>16ms)
- Animation queues in DevTools show thousands of pending
- Visual stuttering during Git operations or bulk saves

**Which phase:** Phase 3 (Animation optimization) - After basic animations working but before production

**Sources:**
- [Architecting Electron Applications for 60fps](https://www.nearform.com/blog/architecting-electron-applications-for-60fps/)
- [Using Queues in Javascript to optimize animations on low-end devices](https://medium.com/tech-p7s1/using-queues-in-javascript-to-optimize-animations-on-low-end-devices-6e3dcad1cfdf)

---

### Pitfall 7: File System Watcher Duplicate Events

**What goes wrong:** File system watcher (chokidar) fires 3-5 events for single file save, causing multiple flash animations and activity log spam for one user action.

**Why it happens:**
- Text editors save files as: create temp -> write content -> rename -> delete temp
- Each step triggers separate file system event
- OS-level file system events are granular and noisy
- Different behavior across Windows/Mac/Linux

**Consequences:**
- Same file flashes 3-5 times for one save
- Activity log cluttered with duplicate entries
- Performance waste from processing same change multiple times
- User confusion from excessive visual feedback
- Combined with WebSocket events creates 6-10 events per save

**Prevention:**
1. **Debouncing with time window** - Merge events for same path within 200-500ms
2. **Event deduplication** - Track file hash/mtime, ignore if unchanged
3. **Disable chokidar during WebSocket events** - Choose one source of truth
4. **Stabilization delay** - Wait for file to "settle" before processing

**Debounce Pattern:**
```javascript
const debounceTimers = new Map();
const DEBOUNCE_MS = 300;

watcher.on('change', (path) => {
  if (debounceTimers.has(path)) {
    clearTimeout(debounceTimers.get(path));
  }

  const timer = setTimeout(() => {
    processFileChange(path);
    debounceTimers.delete(path);
  }, DEBOUNCE_MS);

  debounceTimers.set(path, timer);
});
```

**Detection:**
- Activity log shows same file path multiple times within <1 second
- Single save in VSCode causes 3+ flash animations
- Different event counts on different operating systems
- Log analysis shows event clusters with same path

**Which phase:** Phase 1 (Integration foundation) - Must address alongside WebSocket event deduplication

**Sources:**
- [A Robust Solution for FileSystemWatcher Firing Events Multiple Times](https://www.codeproject.com/Articles/1220093/A-Robust-Solution-for-FileSystemWatcher-Firing-Eve)
- [FileSystemWatcher events raise more than once · Issue #347](https://github.com/microsoft/dotnet/issues/347)

---

### Pitfall 8: WebSocket Connection Storms on Reconnect

**What goes wrong:** Network hiccup causes WebSocket disconnect, client attempts immediate reconnect, server rejects (still processing old connection), client retries rapidly, creating exponential connection attempt storm.

**Why it happens:**
- No exponential backoff on reconnection
- Client doesn't wait for server cleanup of old connection
- Multiple tabs/instances all reconnecting simultaneously
- Server overwhelmed by connection attempts during recovery

**Consequences:**
- Server CPU spikes from connection spam
- Legitimate connections rejected
- Network bandwidth wasted on failed attempts
- Application appears broken to user (stuck "Connecting...")
- Can trigger rate limiting or IP bans in production

**Prevention:**
1. **Exponential backoff with jitter** - 1s, 2s, 4s, 8s... + random jitter
2. **Max reconnect attempts** - Give up after N tries, require manual reconnect
3. **Connection status UI** - Show user reconnection state, don't hide failures
4. **Heartbeat/ping-pong** - Detect dead connections proactively

**Backoff Implementation:**
```javascript
class ReconnectingWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxAttempts = 10;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('close', () => {
      if (this.reconnectAttempts >= this.maxAttempts) {
        console.error('Max reconnect attempts reached');
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      const jitter = Math.random() * 1000;

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay + jitter);
    });

    this.ws.on('open', () => {
      this.reconnectAttempts = 0; // Reset on successful connection
    });
  }
}
```

**Detection:**
- Network logs show rapid connection attempts (10+ per second)
- Server logs show connection rate spikes
- Multiple WebSocket handshakes in DevTools Network tab
- Server CPU usage correlates with client disconnect events

**Which phase:** Phase 2 (Connection reliability) - Add before production deployment

**Sources:**
- [Robust WebSocket Reconnection Strategies in JavaScript With Exponential Backoff](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [Deal with Reconnection Storm — Two Strategies](https://amirsoleimani.medium.com/deal-with-reconnection-storm-two-strategies-4a835d0457f6)

---

### Pitfall 9: IPC Message Serialization Limits

**What goes wrong:** Sending large graph data structures (1000+ nodes) from main to renderer via IPC fails or causes crashes because objects exceed serialization limits or contain non-serializable types.

**Why it happens:**
- Electron IPC uses structured clone algorithm with size limits
- Graph nodes may contain THREE.js objects (non-serializable)
- Circular references in node relationships
- DOM objects can't cross process boundary

**Consequences:**
- IPC send fails silently or throws serialization error
- Graph updates don't reach renderer
- Application appears frozen (waiting for data that never arrives)
- Main process crash if trying to serialize invalid objects

**Prevention:**
1. **Serialize before sending** - Convert to plain objects, strip non-serializable
2. **Chunked transfers** - Split large datasets into smaller messages
3. **Shared memory** - Use MessagePort or SharedArrayBuffer for large data
4. **Data normalization** - Keep IPC payloads minimal, fetch details on demand

**Serialization Pattern:**
```javascript
// BAD: Send entire graph with THREE.js objects
mainWindow.webContents.send('graph-update', graphData);

// GOOD: Serialize to plain objects
function serializeGraphData(graphData) {
  return {
    nodes: graphData.nodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      // Strip THREE.js objects, functions, etc.
    })),
    links: graphData.links.map(l => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target
    }))
  };
}

mainWindow.webContents.send('graph-update', serializeGraphData(graphData));
```

**Detection:**
- Error: "object could not be cloned" in console
- IPC send returns false
- Data appears in main process logs but not renderer
- Large objects (>10MB) being sent via IPC

**Which phase:** Phase 1 (IPC architecture) - Establish serialization patterns early

**Sources:**
- [Memory leak when passing IPC events over contextBridge · Issue #27039](https://github.com/electron/electron/issues/27039)
- [Inter-Process Communication | Electron](https://www.electronjs.org/docs/latest/tutorial/ipc)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 10: WebSocket Client in Renderer Process Fails

**What goes wrong:** Trying to use WebSocket client library (like 'ws') in Electron renderer process throws "ws does not work in the browser" error despite renderer having Node.js access.

**Why it happens:**
- 'ws' package detects browser environment and loads browser.js stub
- Renderer process uses browser-like module resolution
- Package assumes browser = no Node.js WebSocket support
- Even with nodeIntegration: true, ws detects as browser

**Consequences:**
- Cannot use 'ws' library in renderer
- Must find alternative WebSocket library or approach
- Wasted time debugging library compatibility
- Potential delay in development

**Prevention:**
1. **Use native WebSocket API** - Browser WebSocket works in renderer
2. **Main process WebSocket** - Run ws library in main, proxy to renderer
3. **Universal libraries** - Use isomorphic WebSocket libraries (socket.io-client)

**Solution:**
```javascript
// In renderer process - use native WebSocket
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleEvent(data);
};

// NOT this (will fail):
const WebSocket = require('ws'); // Error: ws does not work in browser
```

**Detection:**
- Error message: "ws does not work in the browser"
- Import fails in renderer process
- Works in main process but not renderer

**Which phase:** Phase 1 (Initial setup) - Discover quickly during prototyping

**Sources:**
- [Should it be possible to use ws in an Electron renderer process? · Issue #1459](https://github.com/websockets/ws/issues/1459)

---

### Pitfall 11: Platform-Specific WebSocket Failures (Windows)

**What goes wrong:** WebSocket connections work perfectly on macOS/Linux during development but fail on Windows with connection timeouts or immediate disconnects.

**Why it happens:**
- Windows firewall blocks WebSocket ports
- Different network stack behavior on Windows
- localhost vs 127.0.0.1 resolution differences
- Windows Defender real-time protection interferes

**Consequences:**
- Application works for developers (Mac) but fails for users (Windows)
- Hard to debug (need Windows test environment)
- Support burden from Windows users
- Platform-specific code branches

**Prevention:**
1. **Test on all platforms early** - Don't wait for production
2. **Use 127.0.0.1 instead of localhost** - Avoids DNS resolution issues
3. **Document firewall configuration** - User guide for Windows setup
4. **Error messages with platform hints** - "WebSocket failed (check Windows Firewall)"

**Detection:**
- Bug reports from Windows users only
- Connection works in browser but not Electron on Windows
- Firewall logs show blocked connections
- Different error codes on Windows vs Mac/Linux

**Which phase:** Phase 2 (Cross-platform testing) - Before releasing to users

**Sources:**
- [Websocket client connection fails to connect to server (Windows only, Mac works fine) · Issue #25099](https://github.com/electron/electron/issues/25099)

---

### Pitfall 12: Hooks Don't Fire from Subdirectories

**What goes wrong:** Claude Code hooks work when running from project root but fail completely when Claude runs from subdirectories, blocking hook-based workflows.

**Why it happens:**
- Claude Code hook registration logic depends on working directory
- Configuration hierarchy doesn't propagate to subdirectories
- Process spawning logic differs based on cwd
- Relative path resolution for hook scripts fails

**Consequences:**
- Users running Claude from subdirectories get no events
- Inconsistent behavior confuses users
- CI/CD pipelines fail if run from wrong directory
- No error message, hooks just silently don't fire

**Prevention:**
1. **Detect working directory** - Check Claude's cwd and warn if not root
2. **Absolute paths in hook config** - Use absolute paths for hook scripts
3. **Parent directory search** - Look for .claude/ config in parent dirs
4. **Documentation** - Warn users to run Claude from project root

**Detection:**
- Hooks work sometimes but not others
- User reports "hooks not firing"
- Hook scripts exist but never execute
- cwd logs show Claude running from subdirectory

**Which phase:** Phase 1 (Hook setup) - Document and test during integration

**Sources:**
- [BUG: Hooks Completely Non-Functional in Subdirectories (v2.0.27) - Blocking CI/CD Workflows · Issue #10367](https://github.com/anthropics/claude-code/issues/10367)

---

## Phase-Specific Warnings

Guidance on which phases are most likely to encounter specific pitfalls and need deeper research.

| Phase Topic | Likely Pitfall | Mitigation Strategy |
|-------------|---------------|-------------------|
| WebSocket Server Setup | Main Process Blocking (#3) | Use separate worker process or renderer client |
| Hook Integration | Duplicate Events (#1) | Implement event deduplication from start |
| Event Processing | Event Ordering (#2) | Establish serial queue before complex logic |
| Connection Management | Reconnection Storms (#8) | Add exponential backoff early |
| State Sync | State Divergence (#4) | Design handshake protocol before reconnect logic |
| Animation Sync | Queue Overflow (#6) | Plan batching strategy before implementing animations |
| File Watching | Duplicate FS Events (#7) | Add debouncing when setting up chokidar |
| Memory Management | Listener Leaks (#5) | Establish cleanup patterns from day 1 |
| Cross-Platform | Windows WebSocket Issues (#11) | Test on Windows early and often |
| IPC Architecture | Serialization Limits (#9) | Design normalized data structure upfront |

---

## Integration-Specific Pitfalls

Since this milestone adds features to an **existing** system, special attention to integration risks:

### Integration Risk 1: Dual Event Sources (Chokidar + WebSocket)

**Problem:** Project currently uses chokidar for file watching. Adding WebSocket events creates TWO sources for same file changes.

**Scenarios:**
- User saves file in editor → chokidar fires + Claude Code hook fires → 2 animations
- Claude Code writes file → hook fires + chokidar fires → 2 animations
- Git operation touches 50 files → 100 total events (50 × 2)

**Mitigation:**
- **Option A:** Disable chokidar when WebSocket connected (WebSocket as primary)
- **Option B:** Deduplication layer merging both sources
- **Option C:** Use WebSocket for reads, chokidar for writes (different roles)

**Recommendation:** Option A - WebSocket as primary source when available, chokidar as fallback

---

### Integration Risk 2: Existing Animation System Compatibility

**Problem:** Project has existing flash animation system (v1.3). WebSocket events must integrate cleanly without breaking current animations.

**Current System (from PROJECT.md):**
- Flash effects with configurable duration/intensity
- Activity trails showing change flow
- Follow-active camera mode
- Operation-specific visual indicators

**Risk Areas:**
- WebSocket events might bypass existing animation queue
- New event schema might not map to existing animation types
- Timing conflicts between old and new animation triggers
- State management fragmentation

**Mitigation:**
- Map WebSocket events to existing animation API (don't create parallel system)
- Enhance current `processFileChange()` to accept WebSocket events
- Unified event schema for both sources
- Single animation queue for all event types

---

### Integration Risk 3: IPC Channel Congestion

**Problem:** Project uses IPC for graph updates, file changes, and UI state. Adding WebSocket events increases IPC message frequency significantly.

**Current IPC Channels (from codebase):**
- 'graph-update'
- 'file-changed'
- 'select-node'
- 'open-file'
- Plus new 'websocket-event' channel

**Risk:** IPC bottleneck during high-frequency events (100+ ops/sec during bulk operations)

**Mitigation:**
- Batch WebSocket events before sending via IPC
- Use dedicated IPC channel for WebSocket (don't overload existing channels)
- Monitor IPC queue depth
- Consider SharedArrayBuffer for high-frequency data

---

## Research Quality Assessment

**Confidence Levels:**

| Area | Confidence | Notes |
|------|------------|-------|
| Electron WebSocket Integration | HIGH | Multiple official sources + GitHub issues |
| Event Ordering & Race Conditions | HIGH | Well-documented problem with proven solutions |
| Animation Performance | MEDIUM | General web animation patterns, Electron-specific research limited |
| Claude Code Hooks | MEDIUM | Recent feature, documented issues but evolving |
| Connection Management | HIGH | Industry-standard patterns, extensive documentation |
| Memory Leaks | HIGH | Common Electron problem, well-documented solutions |

**Research Gaps:**

1. **Claude Code Hook Event Schema** - Limited documentation on exact event payload format (need to reference official docs during implementation)
2. **Performance at Scale** - No specific benchmarks for 1000+ file operations through WebSocket → Electron → Three.js pipeline
3. **Production Deployment** - Hook configuration in non-development environments unclear

---

## Prevention Checklist

Use this checklist during implementation to avoid common pitfalls:

**Phase 1: WebSocket Integration**
- [ ] Event deduplication layer for duplicate hook events
- [ ] Serial event queue to preserve ordering
- [ ] WebSocket server in worker process (not main)
- [ ] Proper event listener cleanup patterns
- [ ] IPC message serialization validated

**Phase 2: Connection Management**
- [ ] Exponential backoff for reconnection
- [ ] State sync handshake on reconnect
- [ ] Connection status UI for users
- [ ] Heartbeat/ping-pong keepalive

**Phase 3: Animation Integration**
- [ ] Event batching for burst handling
- [ ] Debouncing for file system events
- [ ] Frame budget monitoring (60fps target)
- [ ] Unified animation API for all event sources

**Phase 4: Production Readiness**
- [ ] Cross-platform testing (Windows, Mac, Linux)
- [ ] Memory leak audit
- [ ] Performance profiling under load
- [ ] Error recovery scenarios tested

---

## Sources

### Electron & WebSocket Integration
- [Strange error with WebSockets in Electron app - TMS WEB Core](https://support.tmssoftware.com/t/strange-error-with-websockets-in-electron-app/13873)
- [I can't connect to websocket server in electron app · Issue #37861](https://github.com/electron/electron/issues/37861)
- [Does anybody run wss server in electron normally? · Issue #1622](https://github.com/websockets/ws/issues/1622)
- [Websocket client connection fails to connect to server (Windows only) · Issue #25099](https://github.com/electron/electron/issues/25099)
- [Should it be possible to use ws in an Electron renderer process? · Issue #1459](https://github.com/websockets/ws/issues/1459)

### Performance & Animation
- [The Horror of Blocking Electron's Main Process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c)
- [Performance | Electron](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Architecting Electron Applications for 60fps](https://www.nearform.com/blog/architecting-electron-applications-for-60fps/)
- [Advanced Electron.js architecture - LogRocket Blog](https://blog.logrocket.com/advanced-electron-js-architecture/)
- [Using Queues in Javascript to optimize animations on low-end devices](https://medium.com/tech-p7s1/using-queues-in-javascript-to-optimize-animations-on-low-end-devices-6e3dcad1cfdf)

### Event Ordering & Synchronization
- [WebSockets guarantee order - so why are my messages scrambled?](https://www.sitongpeng.com/writing/websockets-guarantee-order-so-why-are-my-messages-scrambled)
- [Handling Race Conditions in Real-Time Apps](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8)
- [Top 7 Practices for Real-Time Data Synchronization](https://www.serverion.com/uncategorized/top-7-practices-for-real-time-data-synchronization/)

### Connection Management
- [Robust WebSocket Reconnection Strategies in JavaScript With Exponential Backoff](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [WebSocket Reconnect: Strategies for Reliable Communication](https://apidog.com/blog/websocket-reconnect/)
- [Deal with Reconnection Storm — Two Strategies](https://amirsoleimani.medium.com/deal-with-reconnection-storm-two-strategies-4a835d0457f6)
- [WebSocket Best Practices for Production Applications](https://lattestream.com/blog/websocket-best-practices)
- [Troubleshooting connection issues | Socket.IO](https://socket.io/docs/v4/troubleshooting-connection-issues/)

### Memory Leaks & IPC
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Memory leak when passing IPC events over contextBridge · Issue #27039](https://github.com/electron/electron/issues/27039)
- [MaxListenersExceededWarning: Possible EventEmitter memory leak detected · Issue #139](https://github.com/electron/remote/issues/139)
- [Inter-Process Communication | Electron](https://www.electronjs.org/docs/latest/tutorial/ipc)

### File System Watching
- [A Robust Solution for FileSystemWatcher Firing Events Multiple Times](https://www.codeproject.com/Articles/1220093/A-Robust-Solution-for-FileSystemWatcher-Firing-Eve)
- [FileSystemWatcher events raise more than once · Issue #347](https://github.com/microsoft/dotnet/issues/347)
- [Monitoring File System Changes with FileSystemWatcher in .NET](https://www.dotnet-guide.com/filesystemwatcher-class.html)

### Claude Code Hooks
- [Get started with Claude Code hooks](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Hook Events Fired Twice When Running from Home Directory · Issue #3465](https://github.com/anthropics/claude-code/issues/3465)
- [Hooks Completely Non-Functional in Subdirectories (v2.0.27) · Issue #10367](https://github.com/anthropics/claude-code/issues/10367)
- [A complete guide to hooks in Claude Code: Automating your development workflow](https://www.eesel.ai/blog/hooks-in-claude-code)

---

**Last Updated:** 2026-01-25
**Research Confidence:** MEDIUM-HIGH
**Primary Risk Areas:** Event deduplication, event ordering, main process blocking, state synchronization
