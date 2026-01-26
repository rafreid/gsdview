# Project Research Summary

**Project:** GSD Viewer v1.4 - Claude Code Integration
**Domain:** Real-time IDE activity visualization for AI assistant operations
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

GSD Viewer v1.4 will integrate Claude Code hooks to visualize AI assistant file operations in real-time alongside existing file system monitoring. The recommended approach uses Claude Code's native PostToolUse hooks with a file-based event communication pattern that requires zero new dependencies. Hooks write event files to a watched directory, extending the existing chokidar infrastructure rather than introducing WebSocket server complexity. 

The key architectural insight is that Claude Code hooks provide the only reliable way to detect Read operations (which file system watchers cannot capture), while avoiding common pitfalls like duplicate events, event ordering issues, and main process blocking. By reusing the proven chokidar watcher pattern with a simple bash hook script, we achieve real-time Claude operation visualization without adding npm dependencies or server lifecycle management overhead.

Critical risks center on event deduplication (Claude Code hooks can fire twice from certain directories) and maintaining 60fps animation performance during operation bursts. These are mitigated through event hashing with time windows and batched animation processing that already exists in v1.3's flash system.

## Key Findings

### Recommended Stack

**NO new npm dependencies required.** The integration leverages existing infrastructure (chokidar, Electron IPC) with Claude Code's native hooks system.

**Core technologies:**
- **Claude Code Hooks (PostToolUse)**: Native integration for Read/Write/Edit detection - fires automatically on all file operations with structured JSON payloads
- **File-based communication**: Hook scripts write to `.gsd-viewer/events/`, chokidar watches directory - reuses existing watcher, zero server overhead
- **Bash hook scripts**: Parse Claude JSON stdin, write event files - simple, portable, no Node.js process spawning needed
- **Existing chokidar watcher**: Extended to watch `.gsd-viewer/events/` directory - proven infrastructure, already handles debouncing and IPC

**What NOT to add:**
- WebSocket server (ws package) - unnecessary complexity for one-way events, IPC is superior for Electron
- HTTP server - file-based approach simpler, no port conflicts or lifecycle management
- electron-better-ipc - current IPC patterns work perfectly
- Electron 28 -> 40 upgrade - not required for integration, low priority (though safe if desired)

### Expected Features

**Must have (table stakes for v1.4):**
- **Claude Read operation visualization** - Critical differentiator; no other tool shows reads
- **Operation-specific flash colors** - Blue for reads, yellow for writes, green for creates, red for deletes
- **Enhanced flash effects** - User requirement: larger radius, brighter glow (current + 50% radius, + 25% intensity)
- **Source attribution** - Distinguish Claude operations from file system events in visualization

**Should have (competitive differentiators):**
- **Real-time feedback (<300ms latency)** - Industry standard for perceived instantaneous response
- **Synchronized AI operation feedback** - Visual confirmation matching Claude's actual file access timing
- **Activity feed integration** - Claude operations appear in existing activity log with source indicator

**Defer (v2+ or not needed):**
- OS-level read detection (strace/inotify) - complex, platform-specific, Claude hooks are superior
- VS Code extension for non-Claude editors - separate project scope
- Accessibility reduced-motion support - should add but not blocking
- Full audit trail with indefinite retention - anti-feature, privacy concerns
- System-wide file monitoring - performance nightmare, security risks
- Built-in file editing - violates viewer-only constraint

### Architecture Approach

The architecture extends existing patterns rather than introducing new systems. Claude Code hooks POST JSON to bash scripts that write event files, chokidar detects new files and forwards via existing IPC to renderer, where existing flash animation system visualizes operations.

**Major components:**

1. **Claude Code Hooks Configuration** (`.claude/settings.json`) - PostToolUse matcher for Read/Write/Edit tools, executes hook script with JSON stdin
2. **Hook Observer Script** (`.gsd-viewer/hooks/notify-electron.sh`) - Parses JSON stdin from Claude hooks, writes event file with operation metadata, exits immediately (non-blocking)
3. **Extended Chokidar Watcher** (`src/main/main.js`) - Watches `.gsd-viewer/events/` directory, detects new event files, enriches with node ID/source type, forwards via IPC, cleans up event files
4. **IPC Extension** (`src/main/preload.js`) - New `onClaudeOperation` listener exposes Claude events to renderer process
5. **Renderer Integration** (`src/renderer/renderer.js`) - Handles `claude-operation` events, triggers flash animations with Claude-specific styling, updates activity feed and heat map

**Key architectural decisions:**
- File-based over WebSocket: Reuses proven infrastructure, no server lifecycle, no port conflicts, atomic writes prevent races
- Event enrichment in main process: Convert absolute paths to graph node IDs before sending to renderer
- Dual event sources: Claude hooks (reads + writes) + chokidar (writes only) provide redundancy and different timing characteristics
- Non-blocking hooks: Always exit 0, log errors to file, never block Claude operations

### Critical Pitfalls

1. **Duplicate Hook Events from Directory Context** - Claude Code hooks fire twice when running from home directory. Mitigation: Event deduplication layer with hash + timestamp window (200-500ms), idempotency keys, already-processed tracking.

2. **Event Ordering Lost in Async Processing** - TCP guarantees WebSocket order, but async handlers race causing wrong animation sequence. Mitigation: Serial event queue with FIFO processing, not parallel handlers (though less critical for file-based approach where chokidar already serializes).

3. **Main Process Blocking from WebSocket Server** - Running server in main process blocks renderer, freezes animations. Mitigation: File-based approach avoids this entirely; no server process needed.

4. **Animation Queue Overflow from Event Bursts** - Git operations or bulk saves create hundreds of events in milliseconds, overwhelming animation system. Mitigation: Event batching with 100-200ms window, animation pooling, priority queue for visible nodes only, frame budget enforcement.

5. **Memory Leaks from Unregistered Event Listeners** - Listeners accumulate without cleanup, memory grows unbounded. Mitigation: Always pair addEventListener with removeEventListener, component lifecycle cleanup hooks, WeakMap for graph node callbacks.

## Implications for Roadmap

Based on research, suggested phase structure follows natural dependency chain from hook infrastructure to visual integration:

### Phase 1: Hook Infrastructure
**Rationale:** Foundation must work before any UI integration. Hooks and event files are invisible infrastructure that can be tested independently.

**Delivers:**
- Claude Code hooks configuration in `.claude/settings.json`
- Hook observer script in `.gsd-viewer/hooks/notify-electron.sh`
- Event file schema definition

**Addresses Features:**
- Claude Read operation detection (FEATURES.md table stakes)
- Foundation for all Claude integration features

**Avoids Pitfalls:**
- Duplicate events (add deduplication from start)
- Non-blocking hook pattern (never exit code 2)
- Hooks from subdirectories (document working directory requirement)

**Research needed:** None - Claude Code hooks API is well-documented

### Phase 2: Chokidar Extension & IPC
**Rationale:** Extends proven existing infrastructure (chokidar watcher, IPC channels) without risk to current functionality. Can test event flow before touching renderer.

**Delivers:**
- Extended chokidar to watch `.gsd-viewer/events/`
- Event enrichment logic (path to node ID mapping)
- New IPC channel `claude-operation`
- Preload script `onClaudeOperation` listener

**Uses Stack:**
- Existing chokidar watcher (STACK.md - no changes needed)
- Electron IPC (STACK.md - proven pattern)
- Node.js built-in fs module

**Implements Architecture:**
- Extended Chokidar Watcher component
- IPC Extension component
- Event enrichment layer

**Avoids Pitfalls:**
- IPC serialization limits (validate plain object structure)
- Event ordering (chokidar already serializes events)
- Memory leaks (establish cleanup pattern)

**Research needed:** None - extends existing code patterns

### Phase 3: Renderer Integration & Flash Animations
**Rationale:** Only touches renderer after event flow proven working end-to-end. Reuses existing flash animation system, just adds new trigger path.

**Delivers:**
- Handler for `claude-operation` IPC events
- Operation-specific flash colors (blue for reads, yellow/green/red for writes)
- Enhanced flash effects (larger radius, brighter glow per user requirement)
- Activity feed Claude operation entries

**Addresses Features:**
- Operation-specific visual indicators (FEATURES.md table stakes)
- Enhanced flash effects (FEATURES.md user requirement)
- Source attribution (FEATURES.md differentiator)
- Activity feed integration (FEATURES.md differentiator)

**Implements Architecture:**
- Renderer Integration component
- Reuses existing flash animation system from v1.3

**Avoids Pitfalls:**
- Animation queue overflow (add batching before processing events)
- Dual event sources (flash once for Claude, once for chokidar with different colors)
- Frame budget (enforce 60fps target, skip animations if falling behind)

**Research needed:** None - extends existing animation code

### Phase 4: Performance & Polish
**Rationale:** Handles edge cases discovered during testing. Adds user-facing error messages and debug logging.

**Delivers:**
- Event batching for burst handling (100-200ms window)
- Event deduplication layer for duplicate hook fires
- Frame budget monitoring and enforcement
- User notifications if hooks not configured
- Debug mode showing hook traffic
- Cross-platform testing (Windows, Mac, Linux)

**Avoids Pitfalls:**
- Animation queue overflow (batching implementation)
- Duplicate events (deduplication implementation)
- File system watcher duplicates (extend debouncing to Claude events)

**Research needed:** None - standard optimization patterns

### Phase Ordering Rationale

- **Infrastructure first (Phase 1-2):** Hook configuration and event flow must work before any visual integration. Can be tested in isolation with curl/manual event files.

- **Renderer last (Phase 3):** Only touch renderer after event pipeline proven. Minimizes risk to existing v1.3 functionality (flash animations, activity feed, heat map).

- **Performance separate (Phase 4):** Edge case handling comes after basic flow working. Allows real usage data to guide optimization priorities.

- **Incremental testability:** Each phase can be tested independently. Phase 1 validates hooks fire, Phase 2 validates events reach renderer console, Phase 3 validates animations display.

- **Parallel work opportunity:** Documentation, hook script testing, and event schema design can happen alongside Phase 2 implementation.

### Research Flags

**Phases needing deeper research during planning:** None

All four phases use well-documented patterns:
- **Phase 1:** Claude Code hooks API officially documented, bash scripting is standard
- **Phase 2:** Chokidar and Electron IPC are existing working code, just extending
- **Phase 3:** Existing animation system from v1.3, just adding new triggers
- **Phase 4:** Standard performance patterns (batching, debouncing, profiling)

**Note on confidence:** Research quality is HIGH across all areas. Claude Code hooks have official documentation, Electron patterns are proven in existing codebase, and pitfalls are well-documented from community experience. The recommended file-based approach is simpler than WebSocket alternatives researched, increasing confidence further.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code hooks docs via WebFetch, file-based approach reuses existing chokidar, no new dependencies needed |
| Features | MEDIUM | Clear table stakes (operation visualization) and differentiators (reads detection), but animation tuning will need iteration based on user feedback |
| Architecture | HIGH | Extends proven patterns from existing v1.3 code, file-based approach simpler than researched WebSocket alternative |
| Pitfalls | HIGH | Multiple documented sources for each critical pitfall, community examples of solutions, integration risks identified from v1.3 architecture |

**Overall confidence:** HIGH

The integration approach is well-researched and conservative (extends existing infrastructure rather than adding complexity). Primary uncertainty is user experience tuning (flash intensity, batching thresholds, color choices) which requires iteration after basic functionality works.

### Gaps to Address

**Gap 1: Event schema evolution**
- **Issue:** Claude Code hooks payload format could change in future releases
- **Handling:** Version lock hook configuration, add schema validation, graceful degradation if fields missing
- **Phase:** Phase 1 (add schema validation from start)

**Gap 2: Animation tuning parameters**
- **Issue:** Optimal flash duration, glow intensity, batch window unknown until real usage
- **Handling:** Make all parameters configurable in settings, add debug mode showing event rates, plan to iterate based on user feedback
- **Phase:** Phase 3 (add configuration UI), Phase 4 (tune based on testing)

**Gap 3: Multi-instance Electron behavior**
- **Issue:** Research didn't cover multiple GSD Viewer instances for different projects
- **Handling:** File-based approach naturally supports this (each project has own `.gsd-viewer/events/` directory), but test explicitly
- **Phase:** Phase 4 (cross-platform testing should include multi-instance scenario)

**Gap 4: Historical replay when app closed**
- **Issue:** User runs Claude while GSD Viewer closed, expects to see operations when reopening
- **Handling:** Defer to v1.5+ (requires parsing Claude transcript JSON on startup, out of scope for v1.4 MVP)
- **Phase:** Not addressed in v1.4, document as known limitation

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Official API documentation, exact JSON schemas
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) - Getting started patterns
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - Official IPC patterns
- [chokidar GitHub Repository](https://github.com/paulmillr/chokidar) - File watcher capabilities and limitations
- Existing GSD Viewer codebase - v1.3 architecture patterns (main.js, renderer.js, preload.js)

### Secondary (MEDIUM confidence)
- [Hooks in Claude Code (eesel.ai)](https://www.eesel.ai/blog/hooks-in-claude-code) - Community guide with examples
- [Multi-Agent Observability System](https://github.com/disler/claude-code-hooks-multi-agent-observability) - Real-world hook integration example
- [IPC vs WebSocket comparison](https://www.scriptol.com/javascript/ipc-vs-websocket.php) - Performance characteristics
- [NN/g Animation Duration Guidelines](https://www.nngroup.com/articles/animation-duration/) - UX timing standards
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance) - Main process blocking patterns

### Tertiary (LOW confidence, needs validation)
- Various Stack Overflow discussions on file watcher debouncing techniques
- Blog posts on animation queue optimization (general patterns, not Electron-specific)

### Known Issues Documented
- [Claude Code Hook Events Fired Twice - Issue #3465](https://github.com/anthropics/claude-code/issues/3465) - Duplicate events from home directory
- [Hooks Non-Functional in Subdirectories - Issue #10367](https://github.com/anthropics/claude-code/issues/10367) - Working directory dependency
- [Memory leak passing IPC events - Issue #27039](https://github.com/electron/electron/issues/27039) - Event listener cleanup importance

---
*Research completed: 2026-01-25*
*Ready for roadmap: yes*
*Recommended approach: File-based event communication with Claude Code PostToolUse hooks*
*Critical success factor: Event deduplication and animation batching from Phase 1*
