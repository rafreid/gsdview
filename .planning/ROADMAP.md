# Roadmap: GSD Viewer

## Overview

Transform a GSD project's .planning/ folder into an explorable 3D force-directed graph. The journey starts with a working Electron shell displaying a basic graph, progresses through GSD-specific parsing and state visualization, adds rich interactions, and finishes with live updates and app polish. Each phase delivers a verifiable capability that builds toward the core value: making project structure visible and navigable.

## Completed Milestones

| Version | Name | Phases | Archive |
|---------|------|--------|---------|
| v1.0 | Initial Release | 1-6 | [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) |
| v1.1 | Real-time Activity Visualization | 7-12 | [v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md) |
| v1.2 | File Deep Dive | 13-17 | [v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md) |
| v1.3 | Enhanced Navigation + Smooth Activity | 18-25 | [v1.3-ROADMAP.md](./milestones/v1.3-ROADMAP.md) |

## Current Milestone: v1.4 Live Activity Sync

**Milestone Goal:** Make file activity animations highly visible and synchronized with real-time Claude Code operations, so users can see exactly what's happening as files are read, written, created, and deleted.

**Phases:** 26-29
**Requirements:** 12 (CCI-01 through CCI-05, FLX-04 through FLX-07, EVT-01 through EVT-03)

### Phase 26: Hook Infrastructure

**Goal**: Claude Code hooks fire on file operations and write event files to watched directory

**Depends on**: Phase 25

**Requirements**: CCI-01, CCI-02

**Success Criteria** (what must be TRUE):
  1. Claude Code PostToolUse hooks execute bash script on Read/Write/Edit operations
  2. Hook script writes structured event files to `.gsd-viewer/events/` directory
  3. Event files contain operation type, file path, and timestamp
  4. Hook script exits immediately without blocking Claude operations

**Plans**: 1 plan

Plans:
- [x] 26-01-PLAN.md — Set up Claude Code hooks and bash observer script to write event files

### Phase 27: Chokidar Extension & IPC

**Goal**: Event files detected by watcher and forwarded to renderer process via IPC

**Depends on**: Phase 26

**Requirements**: CCI-03, CCI-05, EVT-01, EVT-02, EVT-03

**Success Criteria** (what must be TRUE):
  1. Chokidar watcher detects new event files in `.gsd-viewer/events/` directory
  2. Event data parsed and enriched with graph node ID before forwarding
  3. IPC channel `claude-operation` delivers events to renderer process
  4. Event deduplication prevents duplicate hook fires from creating multiple animations
  5. Serial queue processing preserves operation ordering

**Plans**: 1 plan

Plans:
- [x] 27-01-PLAN.md — Extend chokidar watcher, implement event pipeline with deduplication, add IPC channel

### Phase 28: Enhanced Flash Effects

**Goal**: Claude operations trigger distinct, highly visible flash animations with operation-specific colors

**Depends on**: Phase 27

**Requirements**: CCI-04, FLX-04, FLX-05, FLX-06

**Success Criteria** (what must be TRUE):
  1. Read operations display distinct blue flash animation (not possible from file watchers alone)
  2. Flash glow radius is significantly larger than v1.3 (user can see from any zoom level)
  3. Flash intensity is brighter than v1.3 with configurable maximum
  4. Different operation types show distinct colors (blue=read, yellow=write, green=create, red=delete)
  5. Source attribution distinguishes Claude operations from file system events

**Plans**: 1 plan

Plans:
- [ ] 28-01-PLAN.md — Add read operation color, enhance flash visibility, subscribe to Claude operation IPC

### Phase 29: Performance & Polish

**Goal**: Rapid operation bursts handled smoothly without overwhelming animation system

**Depends on**: Phase 28

**Requirements**: FLX-07

**Success Criteria** (what must be TRUE):
  1. Rapid successive operations (e.g., git commits with 50+ files) are batched for smooth animation
  2. Animation frame rate stays at 60fps during operation bursts
  3. User receives notification if hooks are not configured correctly
  4. Debug mode shows Claude operation traffic for troubleshooting

**Plans**: TBD

Plans:
- [ ] 29-01: TBD

## Progress Summary

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 | 6 | 23 | Shipped 2026-01-22 |
| v1.1 | 6 | 14 | Shipped 2026-01-23 |
| v1.2 | 5 | 7 | Shipped 2026-01-24 |
| v1.3 | 8 | 17 | Shipped 2026-01-25 |
| v1.4 | 4 | TBD | In progress |
| **Total** | **29** | **61+** | |

## v1.4 Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 26. Hook Infrastructure | 1/1 | Complete | 2026-01-25 |
| 27. Chokidar Extension & IPC | 1/1 | Complete | 2026-01-25 |
| 28. Enhanced Flash Effects | 0/1 | Not started | - |
| 29. Performance & Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-25 (Phase 28 planned)*
