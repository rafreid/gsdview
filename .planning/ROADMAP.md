# Roadmap: GSD Viewer

## Overview

Transform a GSD project's .planning/ folder into an explorable 3D force-directed graph. The journey starts with a working Electron shell displaying a basic graph, progresses through GSD-specific parsing and state visualization, adds rich interactions, and finishes with live updates and app polish. Each phase delivers a verifiable capability that builds toward the core value: making project structure visible and navigable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### v1.0 (Completed)

- [x] **Phase 1: Foundation** - Electron app with basic 3d-force-graph rendering and navigation
- [x] **Phase 2: Graph Rendering** - Color-coded nodes, connection-based sizing, styled edges
- [x] **Phase 3: GSD Parsing** - Parse .planning/ structure into hierarchical nodes
- [x] **Phase 4: State Visualization** - Progress colors, current phase highlight, blocker indicators
- [x] **Phase 5: Interactions** - Details panel, tooltips, fly-to navigation, external editor launch
- [x] **Phase 6: Polish** - Live file watching, recent projects, window state persistence

### v1.1 (Complete)

- [x] **Phase 7: Expanded File Scope** - Include src/ directory in graph and file watcher
- [x] **Phase 8: Activity Feed & Change Indicators** - Live activity feed with change type animations
- [x] **Phase 9: Heat Map Visualization** - Recent changes glow hot, cool down over time
- [x] **Phase 10: Git Integration** - Show uncommitted/staged changes and recent commits
- [x] **Phase 11: Statistics & Diff Preview** - Activity analytics and file diffs
- [x] **Phase 12: Timeline Replay** - Scrub through activity history with playback controls

### v1.2 (Active)

- [x] **Phase 13: Modal Foundation** - Double-click file nodes to open inspector modal with collapsible sections
- [x] **Phase 14: Diff Editor** - Syntax-highlighted diff view with git/session toggle and line navigation
- [x] **Phase 15: Structure Tree** - Parse file structure (headers, functions, classes) with click-to-jump
- [ ] **Phase 16: File Context & Metadata** - Metadata header, quick actions, activity history, related files
- [ ] **Phase 17: Search & Polish** - Keyboard shortcuts (Esc, Ctrl+F) and content search/highlighting

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

---

### Phase 7: Expanded File Scope
**Goal**: User can visualize both .planning/ and src/ directories in the graph with live file tracking
**Depends on**: Phase 6 (v1.0 foundation)
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):
  1. Graph displays nodes from both .planning/ and src/ directories
  2. File tree panel shows combined .planning/ + src/ structure
  3. File watcher detects and updates graph when files change in either directory
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Multi-directory parsing with source markers
- [x] 07-02-PLAN.md — Extended file watcher for both directories
- [x] 07-03-PLAN.md — Visual differentiation and unified tree panel

### Phase 8: Activity Feed & Change Indicators
**Goal**: User sees real-time feed of file changes with distinct visual cues for create/modify/delete
**Depends on**: Phase 7
**Requirements**: FED-01, FED-02, FED-03, FED-04, CHG-01, CHG-02, CHG-03
**Success Criteria** (what must be TRUE):
  1. Live activity feed panel shows each file change with timestamp and change type
  2. Feed auto-scrolls to show newest changes at the top
  3. Clicking an activity entry navigates camera to that node in the graph
  4. Created files pulse green, modified files pulse yellow/orange, deleted files pulse red and fade out
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — Activity feed panel UI with collapsible toggle and badge
- [x] 08-02-PLAN.md — Activity state management and change-type animations
- [x] 08-03-PLAN.md — Entry interactions, auto-scroll, and hover-to-highlight

### Phase 9: Heat Map Visualization
**Goal**: User can visually identify recently active files by heat color that decays over time
**Depends on**: Phase 8
**Requirements**: HET-01, HET-02, HET-03
**Success Criteria** (what must be TRUE):
  1. Recently changed files glow with hot colors (red/orange)
  2. File heat color transitions smoothly from hot to cool over time (red -> orange -> yellow -> normal)
  3. User can adjust heat decay rate to control how fast files cool down
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — Heat state tracking, color gradient, and decay animation loop
- [x] 09-02-PLAN.md — Heat decay slider UI and persistence

### Phase 10: Git Integration
**Goal**: User can see git status directly in the graph (uncommitted, staged, commits, branch)
**Depends on**: Phase 7 (independent of activity features)
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04
**Success Criteria** (what must be TRUE):
  1. File nodes show indicator for uncommitted changes (modified files)
  2. Staged files are visually distinct from unstaged files
  3. Recent commits appear as nodes in the graph showing bundled changes
  4. Current git branch name is visible in the UI header
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md — Git backend operations and IPC API
- [x] 10-02-PLAN.md — Git status visual indicators on file nodes
- [x] 10-03-PLAN.md — Commit nodes and branch display

### Phase 11: Statistics & Diff Preview
**Goal**: User can analyze activity patterns and see what changed in files
**Depends on**: Phase 8 (needs activity data)
**Requirements**: STS-01, STS-02, STS-03, DIF-01, DIF-02, DIF-03
**Success Criteria** (what must be TRUE):
  1. Statistics panel displays most frequently edited files with change counts
  2. Activity over time chart shows editing patterns
  3. Details panel shows file diff for recently changed files
  4. Diff display highlights added lines in green and removed lines in red
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Statistics panel with file ranking and activity chart
- [x] 11-02-PLAN.md — Git diff preview in details panel

### Phase 12: Timeline Replay
**Goal**: User can scrub through activity history and replay file changes over time
**Depends on**: Phase 11 (needs full activity tracking)
**Requirements**: TML-01, TML-02, TML-03
**Success Criteria** (what must be TRUE):
  1. Timeline scrubber allows navigating backward/forward through activity history
  2. Graph state updates to reflect file state at selected point in time
  3. Timeline has play/pause controls for automatic activity replay
**Plans**: 1 plan

Plans:
- [x] 12-01-PLAN.md — Timeline UI, playback controls, and graph state filtering

---

### Phase 13: Modal Foundation
**Goal**: User can double-click any file node to open a dedicated inspector modal with collapsible sections
**Depends on**: Phase 12 (v1.1 foundation)
**Requirements**: MOD-01, MOD-02
**Success Criteria** (what must be TRUE):
  1. Double-clicking any file node opens the file inspector modal
  2. Modal displays with basic structure: header, collapsible diff section, collapsible structure section, collapsible context section
  3. Modal appears centered on screen with overlay backdrop
  4. Each section can be independently expanded or collapsed
**Plans**: 1 plan

Plans:
- [x] 13-01-PLAN.md — Modal structure, double-click handler, and collapsible sections

### Phase 14: Diff Editor
**Goal**: User can view file content with syntax highlighting, toggle diff modes, and navigate by line numbers
**Depends on**: Phase 13
**Requirements**: DFE-01, DFE-02, DFE-03, DFE-04, DFE-05
**Success Criteria** (what must be TRUE):
  1. Diff section shows file content with language-appropriate syntax highlighting
  2. User can toggle between git diff (vs HEAD) and session diff (vs last viewed)
  3. Line numbers appear in left gutter and are clickable for jump-to-line
  4. Added lines display with green background, removed lines with red background
  5. Diff section can be collapsed to hide content or expanded to fill modal height
**Plans**: 1 plan

Plans:
- [x] 14-01-PLAN.md — Diff mode toggle, session storage, line numbers, and syntax highlighting

### Phase 15: Structure Tree
**Goal**: User can see parsed file structure (headers, functions, classes) and click to jump to locations
**Depends on**: Phase 14
**Requirements**: TRE-01, TRE-02, TRE-03, TRE-04, TRE-05
**Success Criteria** (what must be TRUE):
  1. Markdown files show parsed structure: headers (H1-H6), lists, code block boundaries
  2. Code files show parsed structure: functions, classes, imports, exports
  3. Config files (JSON/YAML) show nested key structure
  4. Tree nodes can be collapsed/expanded to show or hide nested elements
  5. Clicking any tree node scrolls the diff editor to that location in the file
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md — File structure parsing (markdown, code, config)
- [x] 15-02-PLAN.md — Structure tree rendering and click-to-scroll

### Phase 16: File Context & Metadata
**Goal**: User can see file metadata, perform quick actions, view activity history, and discover related files
**Depends on**: Phase 15
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-06, CTX-07
**Success Criteria** (what must be TRUE):
  1. Metadata header displays: full file path, file size, last modified timestamp, git status
  2. Quick actions bar has "Open in Editor" button that launches external editor
  3. Quick actions bar has "Copy Path" button that copies file path to clipboard
  4. Quick actions bar has "Copy Content" button that copies file content to clipboard
  5. Recent activity section shows all changes to this file from the activity log
  6. Related files section shows other files that import or reference this file (for code files)
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — Metadata header and quick actions (CTX-01-04)
- [ ] 16-02-PLAN.md — Recent activity and related files (CTX-06-07)

### Phase 17: Search & Polish
**Goal**: User can search within modal content and use keyboard shortcuts for efficient navigation
**Depends on**: Phase 16
**Requirements**: MOD-03, MOD-04, CTX-05
**Success Criteria** (what must be TRUE):
  1. Pressing Esc key closes the modal from any focused element
  2. Pressing Ctrl+F opens search input and focuses cursor
  3. Search input filters/highlights matching text in the diff view
  4. Search highlights update in real-time as user types
  5. Search shows match count (e.g., "3 of 12 matches")
**Plans**: 0 plans (pending)

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17

### v1.0 (Complete)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-22 |
| 2. Graph Rendering | 3/3 | Complete | 2026-01-22 |
| 3. GSD Parsing | 4/4 | Complete | 2026-01-22 |
| 4. State Visualization | 4/4 | Complete | 2026-01-22 |
| 5. Interactions | 4/4 | Complete | 2026-01-22 |
| 6. Polish | 5/5 | Complete | 2026-01-22 |

### v1.1 (Complete)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Expanded File Scope | 3/3 | Complete | 2026-01-23 |
| 8. Activity Feed & Change Indicators | 3/3 | Complete | 2026-01-23 |
| 9. Heat Map Visualization | 2/2 | Complete | 2026-01-23 |
| 10. Git Integration | 3/3 | Complete | 2026-01-23 |
| 11. Statistics & Diff Preview | 2/2 | Complete | 2026-01-23 |
| 12. Timeline Replay | 1/1 | Complete | 2026-01-23 |

### v1.2 (Active)

| Phase | Plans Complete | Status | Target |
|-------|----------------|--------|--------|
| 13. Modal Foundation | 1/1 | Complete | MOD-01, MOD-02 |
| 14. Diff Editor | 1/1 | Complete | DFE-01-05 |
| 15. Structure Tree | 2/2 | Complete | TRE-01-05 |
| 16. File Context & Metadata | 0/2 | Pending | CTX-01-04, CTX-06-07 |
| 17. Search & Polish | 0/? | Pending | MOD-03-04, CTX-05 |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-24 (Phase 16 plans created)*
