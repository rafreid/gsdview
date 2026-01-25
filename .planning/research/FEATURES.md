# Feature Landscape: Real-Time Activity Visualization

**Domain:** Developer tools - Real-time IDE/editor activity visualization
**Researched:** 2026-01-25
**Confidence:** MEDIUM (ecosystem survey complete, some gaps in read operation tracking patterns)

## Table Stakes

Features users expect from real-time activity visualization. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Write operation flash** | All activity tools show modifications visually | Low | ✓ Already implemented via chokidar |
| **Create operation indicator** | Users expect to see new files appear | Low | ✓ Already implemented |
| **Delete operation indicator** | Users expect to see removals | Low | ✓ Already implemented |
| **Animation duration 100-500ms** | Industry standard for feedback animations | Low | Current: configurable; recommended 200-300ms |
| **Distinct visual per operation type** | Color coding expected (green=create, yellow=modify, red=delete) | Low | Enhance existing flash with operation-specific colors |
| **Real-time feedback (<300ms)** | Perceived instantaneous performance requirement | Medium | Chokidar provides this for writes; reads need separate mechanism |
| **Accessibility: reduced motion support** | UX best practice (prefers-reduced-motion) | Low | Not currently implemented - should add |
| **Simple, purposeful animations** | Animations enhance UX, don't distract | Low | Already achieved with flash effects |

## Differentiators

Features that set this product apart. Not expected, but highly valuable for Claude Code integration.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Read operation visualization** | NO other file watcher shows reads; critical for AI assistant understanding | High | chokidar cannot do this; requires OS-level tracking or IDE hooks |
| **Operation source attribution** | Show WHO (Claude vs user vs system) triggered operation | High | Requires Claude Code MCP integration or hook injection |
| **Synchronized AI operation feedback** | Visual confirmation that matches Claude's actual file access | Medium-High | WebSocket + MCP protocol integration |
| **Larger, brighter flash effects** | More visible than typical subtle IDE indicators | Low | User explicitly requested; enhance existing implementation |
| **Activity trails through graph** | ✓ Implemented; shows operation flow visually | Low | Already shipped in v1.3 |
| **Follow-active camera mode** | ✓ Implemented; auto-navigate to changed files | Low | Already shipped in v1.3 |
| **Heat map for file activity** | ✓ Implemented; GitHub-style contribution visualization | Low | Already shipped in v1.1 |
| **Real-time activity feed panel** | ✓ Implemented; scrolling log of all operations | Low | Already shipped in v1.1 |
| **Operation replay timeline** | ✓ Implemented; scrub through past activity | Medium | Already shipped in v1.1 |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Audit every file read system-wide** | Performance nightmare; system resource exhaustion (chokidar warning) | Scope to project directory only; filter by relevance |
| **Log all read operations indefinitely** | Storage bloat; privacy concerns; compliance issues (GLP audit trail complexity) | Time-bound retention; focus on recent activity; user controls |
| **Block/intercept file operations** | Breaks workflows; requires invasive permissions; security risks | Passive monitoring only; visualization, not control |
| **Complex animations >500ms** | Slows perceived performance; becomes annoying (UX guideline) | Keep under 300ms; prefer 200ms for feedback |
| **Full-screen takeovers** | Distracts from actual work; defeats "ambient awareness" purpose | Subtle indicators; overlay, don't replace |
| **Continuous polling for reads** | CPU waste; battery drain; anti-pattern (chokidar philosophy) | Event-driven architecture; native OS hooks or IDE integration |
| **Edit files within viewer** | Scope creep; opens editor externally is sufficient | Maintain viewer-only philosophy (PROJECT.md constraint) |

## Feature Dependencies

### Existing Foundation (v1.0 - v1.3)
```
chokidar file watching
  ├─> Flash animations (create/modify/delete)
  ├─> Heat map visualization
  ├─> Activity trails
  ├─> Follow-active camera mode
  └─> Real-time activity feed

Electron IPC
  ├─> File system operations
  └─> External editor launching
```

### New v1.4 Capabilities Required
```
READ OPERATION DETECTION (critical gap)
  ├─> Cannot use chokidar (only detects writes)
  ├─> Option A: OS-level tracking (strace, inotify, lsof)
  │    ├─> Linux: inotify + auditing framework
  │    ├─> macOS: FSEvents API (writes only) + DTrace
  │    └─> Windows: File access auditing (Event ID 4656/4663)
  ├─> Option B: IDE integration (recommended)
  │    ├─> VS Code extension API: onDidOpenTextDocument
  │    ├─> Claude Code MCP server file operations hooks
  │    └─> LSP protocol file access notifications
  └─> Option C: Process monitoring
       └─> Track Claude Code process file handles (lsof, Process Monitor)

CLAUDE CODE INTEGRATION
  ├─> MCP protocol WebSocket transport
  ├─> File operations tools (readFile, editFile, bash)
  ├─> Real-time event streaming
  └─> Operation metadata (source attribution)

ENHANCED VISUAL FEEDBACK
  ├─> Bigger flash radius (user requirement)
  ├─> Brighter glow intensity
  ├─> Operation-specific colors
  │    ├─> Read: Blue/Cyan (non-destructive, passive)
  │    ├─> Create: Green (new, additive)
  │    ├─> Modify: Yellow/Orange (change, caution)
  │    └─> Delete: Red (destructive, removal)
  └─> Duration: 200-300ms (UX best practice)
```

## Read vs Write Operation Patterns

### Ecosystem Conventions

**Write Operations (standard visualization)**
- All tools detect these (Gource, Git visualization, chokidar)
- Color: Yellow/Orange for modifications
- Shown as commits, saves, changes
- High confidence: file system emits events natively

**Read Operations (rare visualization)**
- Almost NO tools visualize reads
- Reason: File systems don't emit read events (chokidar limitation)
- Exception: Audit/security tools (Teramind, file access monitoring)
- Requires: Explicit auditing configuration or process monitoring

### Recommended Approach for GSD Viewer

**Asymmetric visualization is acceptable:**
- Write operations: Instant flash (chokidar event)
- Read operations: Delayed flash (Claude MCP event or process monitoring)
- Users understand AI assistant reading takes time
- Visual confirmation more important than exact timing

**Color coding recommendation:**
| Operation | Color | Rationale |
|-----------|-------|-----------|
| Read | Blue/Cyan | Non-destructive, passive, informational |
| Create | Green | Positive, additive, new |
| Modify | Yellow/Orange | Caution, change, update |
| Delete | Red | Destructive, removal, warning |

**Animation timing:**
| Trigger | Duration | Intensity |
|---------|----------|-----------|
| Read | 200ms | Medium (subtle acknowledgment) |
| Create | 300ms | High (important event) |
| Modify | 250ms | Medium-High (standard change) |
| Delete | 300ms | High (destructive action) |

## MVP Recommendation for v1.4

### Must Have (Table Stakes + Critical Differentiators)

1. **Claude Code MCP Integration** (HIGH value)
   - WebSocket server in Electron main process
   - Listen for Claude file operations (readFile, editFile)
   - Map operations to graph nodes
   - Trigger flash animations with source="claude"

2. **Operation-Specific Visual Indicators** (HIGH value)
   - Blue flash for reads
   - Green flash for creates
   - Yellow flash for modifies
   - Red flash for deletes
   - Configurable intensity/duration per operation type

3. **Enhanced Flash Effects** (MEDIUM value, user requirement)
   - Larger glow radius (current + 50%)
   - Brighter intensity (current + 25%)
   - Configurable in settings panel

4. **Source Attribution** (MEDIUM value)
   - Badge or indicator showing operation source
   - "Claude Code" vs "File System" vs "Git"
   - Display in activity feed and on flash

### Nice to Have (Defer to post-v1.4)

- OS-level read detection (strace/inotify) — complex, platform-specific
- VS Code extension for non-Claude read tracking — separate project
- Accessibility: reduced motion support — should add, not blocking
- Read operation heat map — interesting but secondary
- Operation filtering by source — useful for large projects

### Explicitly Defer

- Full audit trail with indefinite retention — anti-feature
- System-wide file monitoring — performance nightmare
- Blocking/intercepting operations — out of scope
- Built-in file editing — violates viewer-only constraint

## Known Limitations & Workarounds

### Limitation 1: chokidar Cannot Detect Reads
**Problem:** File system watchers only emit events for writes (create/modify/delete), not reads.
**Evidence:** [chokidar documentation](https://github.com/paulmillr/chokidar) explicitly states "ignores accessTime updates caused by read operations"
**Workaround:** Claude Code MCP integration provides explicit read notifications via protocol
**Confidence:** HIGH (verified with official source)

### Limitation 2: Cross-Platform Read Tracking Complexity
**Problem:** OS-level read detection requires platform-specific implementations
- Linux: inotify + audit framework
- macOS: DTrace (complex, requires admin)
- Windows: File access auditing Event 4656/4663
**Evidence:** [Linux audit framework](https://linux-audit.com/monitor-file-access-by-linux-processes/), [Windows file auditing](https://www.varonis.com/blog/windows-file-system-auditing)
**Workaround:** Focus on Claude Code integration first; OS-level tracking is phase 2 if needed
**Confidence:** MEDIUM (multiple sources agree on complexity)

### Limitation 3: Async Nature of AI Operations
**Problem:** Claude may read file, process content, then write — delay between operations
**Evidence:** CodeGPT shows "reading files, weighing options, suggesting edits" with visible delays
**Workaround:** Accept asynchronous visualization; show read flash when notified, write flash when saved
**Confidence:** MEDIUM (inferred from AI assistant behavior patterns)

### Limitation 4: Performance at Scale
**Problem:** Watching 1000+ files with enhanced flash effects may degrade performance
**Evidence:** chokidar warnings about resource exhaustion, VS Code performance considerations
**Workaround:** Debounce rapid operations; batch flash animations; configurable intensity
**Confidence:** MEDIUM (general best practice, not specific testing)

## Feature Comparison: GSD Viewer vs Ecosystem

| Feature | GSD Viewer (v1.4 target) | Gource | VS Code | File Activity Watch | Git Visualization |
|---------|-------------------------|--------|---------|---------------------|-------------------|
| Write operations | ✓ (chokidar) | ✓ (git commits) | ✓ (gutter indicators) | ✓ (audit) | ✓ (commits) |
| Read operations | ✓ (MCP integration) | ✗ | ✓ (onDidOpen events) | ✓ (audit) | ✗ |
| AI assistant specific | ✓ (Claude Code) | ✗ | Partial (Copilot telemetry) | ✗ | ✗ |
| Real-time (<300ms) | ✓ | ✗ (batch commits) | ✓ | ✓ | ✗ (historical) |
| 3D visualization | ✓ | ✓ | ✗ | ✗ | Partial |
| Source attribution | ✓ (planned) | ✓ (author) | Partial | ✓ (process) | ✓ (author) |
| Activity heat map | ✓ | ✗ | Partial (extensions) | ✗ | ✓ (GitHub style) |
| Operation replay | ✓ | ✓ | ✗ | ✗ | ✓ |

**Competitive advantage:** Only tool combining 3D visualization + AI assistant integration + read operation tracking + real-time feedback

## Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP protocol instability | Medium | High | Version lock MCP dependencies; graceful degradation if unavailable |
| Read detection accuracy | Medium | Medium | Accept best-effort; focus on Claude operations, not all reads |
| Performance degradation | Low | High | Configurable effects; debouncing; performance testing with 1000+ files |
| Platform compatibility | Low | Medium | Test on macOS/Linux/Windows; document limitations per platform |
| Flash fatigue (too many) | Medium | Medium | User controls: disable, reduce intensity, filter by operation type |

## Research Gaps & Open Questions

### Gap 1: MCP File Operation Event Schema
**What's unknown:** Exact event payload structure from Claude Code MCP server
**Why it matters:** Need to parse operation type, file path, timestamp, source
**Resolution:** Check MCP protocol documentation or Claude Code source code
**Confidence impact:** Currently MEDIUM, could be HIGH with official docs

### Gap 2: Read Operation Frequency
**What's unknown:** How often does Claude Code read files vs write?
**Why it matters:** If Claude reads 100x more than writes, constant flashing may overwhelm
**Resolution:** Prototype and observe; implement filtering/throttling if needed
**Confidence impact:** LOW confidence on user experience without testing

### Gap 3: VS Code Extension Viability
**What's unknown:** Could VS Code extension provide read events for non-Claude editors?
**Why it matters:** Broader applicability beyond Claude Code
**Resolution:** Investigate onDidOpenTextDocument API and workspace events
**Confidence impact:** LOW confidence; interesting but not v1.4 scope

## Sources

### High Confidence (Official Documentation)
- [Visual Studio Code Extension API - File System](https://code.visualstudio.com/api/extension-guides/virtual-documents)
- [VS Code API - Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [chokidar GitHub Repository](https://github.com/paulmillr/chokidar)
- [Language Server Protocol Official Page](https://microsoft.github.io/language-server-protocol/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- [NN/g: Animation Duration Guidelines](https://www.nngroup.com/articles/animation-duration/)

### Medium Confidence (Verified Multiple Sources)
- [FileActivityWatch for Windows](https://www.nirsoft.net/utils/file_activity_watch.html)
- [Linux File Access Monitoring](https://linux-audit.com/monitor-file-access-by-linux-processes/)
- [Windows File System Auditing - Varonis](https://www.varonis.com/blog/windows-file-system-auditing)
- [Gource Visualization Tool](https://gource.io/)
- [Ultimate Guide to UX Animation - AltexSoft](https://altexsoft.com/blog/uxdesign/ultimate-guide-to-ux-animation)
- [Claude Code MCP Setup Guide](https://mcp.harishgarg.com/use/filesystem/mcp-server/with/claude-code)
- [Top 10 Essential MCP Servers for Claude Code (2026)](https://apidog.com/blog/top-10-mcp-servers-for-claude-code/)

### Low Confidence (Web Search Only, Needs Verification)
- Various blog posts on micro-interactions and animation timing
- Stack Overflow discussions on file monitoring
- Community examples of activity visualization

### Contradictions Found
- **Timing recommendations:** Some sources say 100-500ms, others say 200-300ms, NN/g says "shortest possible without jarring"
  - **Resolution:** Use 200-300ms as safe middle ground; make configurable
- **Read operation detection:** Some tools claim "real-time" but use polling or batch processing
  - **Resolution:** Define "real-time" as <300ms perceived latency, accept async for reads
