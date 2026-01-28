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

## Current Milestone: v1.5 GSD Workflow Diagram

**Goal:** Add a workflow-oriented diagram view that maps the .planning/ folder onto the GSD process model, showing both how the workflow operates and why it's effective through visual indicators.

### Phase 30: Architecture Foundation ✓

**Goal:** Establish clean separation and lifecycle patterns to prevent memory leaks, stale closures, and animation conflicts

**Dependencies:** None (refactors existing code)

**Requirements:** ARCH-01, ARCH-02, ARCH-03, ARCH-04

**Plans:** 3 plans ✓

Plans:
- [x] 30-01-PLAN.md — Create state-manager.js with centralized state
- [x] 30-02-PLAN.md — Refactor renderer.js to graph-renderer.js with lifecycle methods
- [x] 30-03-PLAN.md — Verification checkpoint

**Success Criteria:**
1. ✓ User sees graph view working identically after state-manager extraction
2. ✓ Developer can verify all selection state flows through single state-manager.js module
3. ✓ Developer can mount/unmount graph renderer without memory leaks (verified by 20+ view switches in DevTools)
4. ✓ Animation frame IDs properly canceled when switching away from graph view

**Completed:** 2026-01-28

---

### Phase 31: View Switching ✓

**Goal:** User can toggle between Graph and Diagram views while preserving selection and keyboard shortcuts

**Dependencies:** Phase 30 (requires state-manager.js)

**Requirements:** VIEW-01, VIEW-02, VIEW-03, VIEW-04

**Plans:** 3 plans ✓

Plans:
- [x] 31-01-PLAN.md — View infrastructure (tab controls, diagram container, view-controller.js)
- [x] 31-02-PLAN.md — Selection persistence and keyboard routing
- [x] 31-03-PLAN.md — Verification checkpoint

**Success Criteria:**
1. ✓ User can click tab controls to switch between Graph and Diagram views
2. ✓ User sees their selected node remains highlighted when switching between views
3. ✓ User presses keyboard shortcuts (1-9 bookmarks, arrow navigation) and correct view responds
4. ✓ Developer sees file watcher updates route to both views without render conflicts
5. ✓ User experiences smooth transitions without layout stuttering or flashing

**Completed:** 2026-01-28

---

### Phase 32: Diagram Layout + Artifact Visualization ✓

**Goal:** User sees workflow pipeline layout with nested phase artifacts showing completion status

**Dependencies:** Phase 31 (requires view containers)

**Requirements:** DIAG-01, DIAG-02, DIAG-03, DIAG-04, ARTF-01, ARTF-02, ARTF-03, ARTF-04

**Plans:** 2 plans ✓

Plans:
- [x] 32-01-PLAN.md — Foundation: Dependencies + Parser + Renderer Skeleton
- [x] 32-02-PLAN.md — SVG Pipeline Layout + Artifact Blocks

**Success Criteria:**
1. ✓ User sees 6 GSD stages (Initialize → Discuss → Plan → Execute → Verify → Complete) in left-to-right pipeline
2. ✓ User sees stage containers display with distinct status indicators (green/yellow/gray)
3. ✓ User sees connection lines showing sequential workflow flow
4. ✓ User can scroll/pan horizontally to navigate the full pipeline
5. ✓ User sees artifact blocks (CONTEXT.md, RESEARCH.md, PLANs, SUMMARYs) nested within stage containers
6. ✓ User sees each artifact shows completion status using color coding (green=done, yellow=in-progress, gray=missing)
7. ✓ User sees current stage/phase highlighted based on STATE.md

**Completed:** 2026-01-28

---

### Phase 33: Interactivity ✓

**Goal:** User can interact with diagram artifacts and sync selection between diagram and graph views

**Dependencies:** Phase 32 (requires diagram rendering)

**Requirements:** INTR-01, INTR-02, INTR-03, INTR-04, INTR-05, INTR-06

**Plans:** 2 plans ✓

Plans:
- [x] 33-01-PLAN.md — Diagram click, hover tooltip, stage expand/collapse
- [x] 33-02-PLAN.md — Two-way selection sync and bookmark navigation

**Success Criteria:**
1. ✓ User clicks artifact in diagram and file inspector modal opens showing file contents
2. ✓ User hovers over artifact and sees tooltip with file metadata (name, size, modified date)
3. ✓ User clicks stage header and sees artifact detail expand/collapse smoothly
4. ✓ User clicks artifact in diagram and corresponding node highlights in graph view
5. ✓ User clicks node in graph view and corresponding artifact highlights in diagram view
6. ✓ User presses bookmark shortcuts (1-9) in diagram view and camera flies to bookmarked phase

**Completed:** 2026-01-28

---

### Phase 34: Real-Time Updates ✓

**Goal:** Diagram view updates automatically when files change, with flash animations showing what changed

**Dependencies:** Phase 33 (requires interactive diagram)

**Requirements:** LIVE-01, LIVE-02, LIVE-03

**Plans:** 1 plan ✓

Plans:
- [x] 34-01-PLAN.md — File change handler with re-render and flash animations

**Success Criteria:**
1. ✓ User sees file changes detected by existing watcher trigger immediate diagram updates
2. ✓ User sees flash animation highlighting changed artifacts in diagram (matching graph flash colors)
3. ✓ User sees activity feed shows changes from both Graph and Diagram views
4. ✓ User experiences smooth updates even during rapid file changes (debounced layout recalculation)

**Completed:** 2026-01-28

---

### Phase 35: Advanced Features & Polish

**Goal:** Add workflow efficiency indicators showing why GSD process works (context usage, parallel lanes, commit markers)

**Dependencies:** Phase 34 (requires stable diagram with updates)

**Requirements:** DIAG-05, DIAG-06, ARTF-05

**Plans:** 3 plans

Plans:
- [ ] 35-01-PLAN.md — Context usage bars + responsive layout polish
- [ ] 35-02-PLAN.md — Parallel agent lanes + atomic commit markers
- [ ] 35-03-PLAN.md — Verification checkpoint (final v1.5 verification)

**Success Criteria:**
1. User sees "Why it works" context usage bars showing utilization percentage per stage
2. User sees parallel agent lanes visualizing concurrent research/execution work during multi-agent stages
3. User sees atomic commit markers on executed tasks in Execute stage
4. User experiences polished diagram with responsive layout adjustments
5. Developer verifies no performance degradation with advanced features enabled

---

## Progress Summary

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 | 6 | 23 | Shipped 2026-01-22 |
| v1.1 | 6 | 14 | Shipped 2026-01-23 |
| v1.2 | 5 | 7 | Shipped 2026-01-24 |
| v1.3 | 8 | 17 | Shipped 2026-01-25 |
| v1.4 | 4 | 5 | Shipped 2026-01-25 |
| v1.5 | 6 | 14 | Phase 35 planning |
| **Total** | **35** | **80** | |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-28 (Phase 35 planned)*
