# Roadmap: GSD Viewer

## Overview

Transform a GSD project's .planning/ folder into an explorable 3D force-directed graph. The journey starts with a working Electron shell displaying a basic graph, progresses through GSD-specific parsing and state visualization, adds rich interactions, and finishes with live updates and app polish. Each phase delivers a verifiable capability that builds toward the core value: making project structure visible and navigable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Electron app with basic 3d-force-graph rendering and navigation
- [x] **Phase 2: Graph Rendering** - Color-coded nodes, connection-based sizing, styled edges
- [x] **Phase 3: GSD Parsing** - Parse .planning/ structure into hierarchical nodes
- [x] **Phase 4: State Visualization** - Progress colors, current phase highlight, blocker indicators
- [x] **Phase 5: Interactions** - Details panel, tooltips, fly-to navigation, external editor launch
- [x] **Phase 6: Polish** - Live file watching, recent projects, window state persistence

## Phase Details

### Phase 1: Foundation
**Goal**: User can open a project folder and see a basic 3D graph they can navigate
**Depends on**: Nothing (first phase)
**Requirements**: APP-01, GRF-01, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. User can launch the Electron app and see a window
  2. User can select a project folder via file dialog
  3. App displays a 3D force-directed graph (placeholder nodes acceptable)
  4. User can orbit, zoom, and pan the graph view
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Electron app scaffold with basic window
- [x] 01-02-PLAN.md — 3d-force-graph integration with placeholder data
- [x] 01-03-PLAN.md — Project folder selection dialog

### Phase 2: Graph Rendering
**Goal**: Graph nodes are visually distinct by type, size reflects importance, edges show relationships
**Depends on**: Phase 1
**Requirements**: GRF-02, GRF-03, GRF-04
**Success Criteria** (what must be TRUE):
  1. Different node types (phases, plans, tasks, requirements, files) have distinct colors
  2. Nodes with more connections appear larger than isolated nodes
  3. Edges connect related nodes with visible lines
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Enhanced color palette and color legend
- [x] 02-02-PLAN.md — Dynamic node sizing by connection count
- [x] 02-03-PLAN.md — Edge styling and directional indicators

### Phase 3: GSD Parsing
**Goal**: App understands GSD .planning/ structure and renders it as connected nodes
**Depends on**: Phase 2
**Requirements**: STR-01, STR-02, STR-03, STR-04
**Success Criteria** (what must be TRUE):
  1. Phase nodes connect to their Plan nodes, which connect to Task nodes
  2. Requirement nodes connect to the Phases they map to
  3. File dependency relationships appear as edges
  4. Directory tree of .planning/ folder is represented as navigable nodes
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Parse ROADMAP.md for phase/plan hierarchy
- [x] 03-02-PLAN.md — Parse REQUIREMENTS.md and link to phases
- [x] 03-03-PLAN.md — Directory tree parsing for .planning/ folder
- [x] 03-04-PLAN.md — Graph builder and renderer integration

### Phase 4: State Visualization
**Goal**: User can see project progress, current focus, and blockers at a glance
**Depends on**: Phase 3
**Requirements**: STA-01, STA-02, STA-03
**Success Criteria** (what must be TRUE):
  1. Current/active phase node has a visible glow or pulse effect
  2. Completed items are green, in-progress are yellow, pending are gray
  3. Blocked items have red connection indicators visible from any zoom level
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Parse STATE.md for current position and blockers
- [x] 04-02-PLAN.md — Progress-based node coloring (green/yellow/gray)
- [x] 04-03-PLAN.md — Current phase highlighting with glow/pulse effect
- [x] 04-04-PLAN.md — Blocker visualization with red connection indicators

### Phase 5: Interactions
**Goal**: User can inspect nodes, get quick info, fly to items of interest, and open files externally
**Depends on**: Phase 4
**Requirements**: NAV-04, INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Clicking a node flies camera smoothly to focus on it
  2. Clicking a node opens a details panel showing contents/metadata
  3. Hovering over a node shows tooltip with quick summary
  4. User can open the underlying file in their external editor from any node
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Click-to-fly navigation
- [x] 05-02-PLAN.md — Details panel component
- [x] 05-03-PLAN.md — Hover tooltips
- [x] 05-04-PLAN.md — External editor integration

### Phase 6: Polish
**Goal**: App feels responsive with live updates and remembers user preferences
**Depends on**: Phase 5
**Requirements**: LIV-01, LIV-02, LIV-03, APP-02, APP-03
**Success Criteria** (what must be TRUE):
  1. Editing a file in .planning/ causes the graph to update automatically
  2. Manual refresh button reloads graph data on demand
  3. Recent projects appear in menu/list for quick access
  4. Closing and reopening app restores previous window size and position
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — File system watcher for .planning/
- [x] 06-02-PLAN.md — Auto-refresh on file changes
- [x] 06-03-PLAN.md — Manual refresh button
- [x] 06-04-PLAN.md — Recent projects storage and UI
- [x] 06-05-PLAN.md — Window state persistence

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-22 |
| 2. Graph Rendering | 3/3 | Complete | 2026-01-22 |
| 3. GSD Parsing | 4/4 | Complete | 2026-01-22 |
| 4. State Visualization | 4/4 | Complete | 2026-01-22 |
| 5. Interactions | 4/4 | Complete | 2026-01-22 |
| 6. Polish | 5/5 | Complete | 2026-01-22 |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-22*
