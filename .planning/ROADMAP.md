# Roadmap: GSD Viewer

## Overview

Transform a GSD project's .planning/ folder into an explorable 3D force-directed graph. The journey starts with a working Electron shell displaying a basic graph, progresses through GSD-specific parsing and state visualization, adds rich interactions, and finishes with live updates and app polish. Each phase delivers a verifiable capability that builds toward the core value: making project structure visible and navigabe.

## Completed Milestones

| Version | Name | Phases | Archive |
|---------|------|--------|---------|
| v1.0 | Initial Release | 1-6 | [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) |
| v1.1 | Real-time Activity Visualization | 7-12 | [v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md) |
| v1.2 | File Deep Dive | 13-17 | [v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md) |
| v1.3 | Enhanced Navigation + Smooth Activity | 18-25 | [v1.3-ROADMAP.md](./milestones/v1.3-ROADMAP.md) |
| v1.4 | Live Activity Sync | 26-29 | [v1.4-ROADMAP.md](./milestones/v1.4-ROADMAP.md) |
| v1.5 | GSD Workflow Diagram | 30-35 | [v1.5-ROADMAP.md](./milestones/v1.5-ROADMAP.md) |

## Current Milestone: v1.6 Live Activity Intelligence

**Goal:** Provide real-time visibility into what's happening when GSD is cooking. Users see Claude's activity patterns, file hotspots, operation flow, and context window status through dedicated visualization modes.

### Phase 36: Live Dashboard View

**Goal:** User sees real-time activity status showing what Claude is doing right now

**Dependencies:** None (extends existing activity tracking)

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06

**Success Criteria:**
1. User sees current operation indicator (reading/writing/thinking/idle) updating in real-time
2. User sees active file highlighted with pulsing animation distinct from history flashes
3. User sees rolling sparkline chart showing last 5 minutes of operation frequency
4. User sees session statistics dashboard (files touched, operations count, time active)
5. User can toggle Dashboard view via tab controls and it preserves state when switching back

---

### Phase 37: File Heatmap View

**Goal:** User can visualize which files are receiving the most attention through spatial heatmap

**Dependencies:** Phase 36 (shares activity data infrastructure)

**Requirements:** HEAT-01, HEAT-02, HEAT-03, HEAT-04, HEAT-05, HEAT-06

**Success Criteria:**
1. User sees treemap visualization where rectangle size represents file size
2. User sees color intensity showing activity frequency (red=hot files, blue=cold files)
3. User can click directory rectangles to drill down and explore subdirectories
4. User can filter heatmap by time range (last hour / this session / all time)
5. User sees file details and recent operations list on hover tooltip

---

### Phase 38: Operation Flow Timeline

**Goal:** User can scrub through operation history to understand Claude's workflow patterns

**Dependencies:** Phase 37 (builds on activity data model)

**Requirements:** TIME-01, TIME-02, TIME-03, TIME-04, TIME-05, TIME-06

**Success Criteria:**
1. User sees horizontal timeline with all GSD operations in chronological order
2. User sees color-coded operation blocks (blue=read, amber=write, green=create, red=delete)
3. User sees operations grouped by file in swimlanes for pattern recognition
4. User can scrub timeline to see file state at any historical moment
5. User sees pattern detection highlights showing read-then-write sequences
6. User can zoom in/out on timeline to focus on specific time ranges

---

### Phase 39: Context Window Meter

**Goal:** User can see estimated context window usage and what files might fall out

**Dependencies:** Phase 38 (requires operation history for context estimation)

**Requirements:** CNTX-01, CNTX-02, CNTX-03, CNTX-04

**Success Criteria:**
1. User sees progress bar showing estimated context usage percentage
2. User sees list of files currently "in context" based on recent read/write activity
3. User sees warning indicator when estimated context usage approaches limits
4. User sees predictions of which files might fall out of context next

---

### Phase 40: Smart Notifications

**Goal:** User receives intelligent alerts for significant GSD activity events

**Dependencies:** Phase 39 (uses activity pattern detection)

**Requirements:** NOTF-01, NOTF-02, NOTF-03, NOTF-04

**Success Criteria:**
1. User sees toast notifications for significant activity events (file creation bursts, rapid edits)
2. User sees "Claude created N new files in X directory" notifications
3. User sees "Rapid activity in X directory" alerts during intensive work
4. User can configure which notification types to show via settings panel

---

### Phase 41: Session Recording

**Goal:** User can record, replay, and export GSD sessions for review and sharing

**Dependencies:** Phase 40 (completes activity intelligence foundation)

**Requirements:** SESS-01, SESS-02, SESS-03, SESS-04, SESS-05

**Success Criteria:**
1. User can start/stop session recording via prominent record button
2. System captures all file operations with timestamps during active recording
3. User can playback recorded sessions at variable speeds (1x, 2x, 4x, 8x)
4. User can export session as markdown report summarizing activity
5. User can view list of saved recordings and select one to replay

---

## Progress Summary

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 | 6 | 23 | Shipped 2026-01-22 |
| v1.1 | 6 | 14 | Shipped 2026-01-23 |
| v1.2 | 5 | 7 | Shipped 2026-01-24 |
| v1.3 | 8 | 17 | Shipped 2026-01-25 |
| v1.4 | 4 | 5 | Shipped 2026-01-25 |
| v1.5 | 6 | 14 | Shipped 2026-01-28 |
| v1.6 | 6 | 6 | Shipped 2026-01-28 |
| **Total** | **41** | **86** | |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-28 (v1.6 COMPLETE)*
