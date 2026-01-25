# Requirements: GSD Viewer

**Defined:** 2026-01-25
**Core Value:** Make the invisible structure of a GSD project visible and navigable

## v1.4 Requirements

Requirements for milestone v1.4: Live Activity Sync.

### Claude Code Integration

- [x] **CCI-01**: App configures Claude Code PostToolUse hooks to emit file operation events
- [x] **CCI-02**: Bash observer script writes operation events to a watched file
- [ ] **CCI-03**: Chokidar watcher detects event file changes and parses operation data
- [ ] **CCI-04**: Read operations from Claude Code trigger visual feedback (not possible with file watchers)
- [ ] **CCI-05**: Event deduplication handles duplicate hook fires without double-animating

### Enhanced Flash Effects

- [ ] **FLX-04**: Read operations display distinct blue flash/glow animation
- [ ] **FLX-05**: Flash glow radius is significantly larger (more visible from any zoom level)
- [ ] **FLX-06**: Flash intensity is brighter by default with higher configurable max
- [ ] **FLX-07**: Rapid successive operations are batched for smooth animation

### Event Processing

- [ ] **EVT-01**: IPC channel forwards Claude operations from main to renderer process
- [ ] **EVT-02**: Operation events include file path, operation type, and timestamp
- [ ] **EVT-03**: Serial queue processing preserves event ordering

## Future Requirements

Deferred to post-v1.4 releases.

### OS-Level Read Detection
- **RD-01**: Linux inotify/audit integration for non-Claude reads
- **RD-02**: macOS DTrace integration for non-Claude reads
- **RD-03**: Windows Event 4656/4663 integration for non-Claude reads

### Advanced Features
- **ADV-01**: Source attribution (Claude vs File System vs Git)
- **ADV-02**: Activity feed integration showing operation source
- **ADV-03**: Filter activity by source

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| VS Code extension for reads | High complexity, defer to future |
| Sound effects | User selected bigger/brighter, not audio |
| Particle effects | User selected bigger/brighter, not particles |
| OS-level read tracking | Platform-specific complexity, defer |
| Historical operation replay | Defer to v1.5+ |
| Multi-Electron-instance support | Edge case, defer |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CCI-01 | Phase 26 | Complete |
| CCI-02 | Phase 26 | Complete |
| CCI-03 | Phase 27 | Pending |
| CCI-04 | Phase 28 | Pending |
| CCI-05 | Phase 27 | Pending |
| FLX-04 | Phase 28 | Pending |
| FLX-05 | Phase 28 | Pending |
| FLX-06 | Phase 28 | Pending |
| FLX-07 | Phase 29 | Pending |
| EVT-01 | Phase 27 | Pending |
| EVT-02 | Phase 27 | Pending |
| EVT-03 | Phase 27 | Pending |

**Coverage:**
- v1.4 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

**100% coverage verified**

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after v1.4 roadmap creation*
