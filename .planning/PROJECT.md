# GSD Viewer

## What This Is

A desktop application that visualizes GSD project structure as an interactive 3D force-directed graph. Users can fly through their project's phases, plans, tasks, requirements, and files — seeing relationships, progress, and blockers at a glance. Built with Electron and the 3d-force-graph library.

## Core Value

Make the invisible structure of a GSD project visible and navigable — so users always know where they are, what's connected, and what's blocked.

## Current Milestone: v1.5 GSD Workflow Diagram

**Goal:** Add a workflow-oriented diagram view that maps the `.planning/` folder onto the GSD process model, showing both how the workflow operates and why it's effective through visual indicators.

**Target features:**
- Flowchart pipeline view (Initialize → Discuss → Plan → Execute → Verify → Complete)
- Nested phase blocks showing actual project artifacts (CONTEXT.md, RESEARCH.md, PLANs, SUMMARYs)
- Artifact completion status (done/in-progress/missing) per phase
- Interactive — click to expand phases, open inspector, sync with graph selection
- "Why it works" visual indicators: context window usage, parallel agent lanes, atomic commit markers
- Toggle between Graph view and Diagram view

## Current State

**Shipped:** v1.4 Live Activity Sync (2026-01-25)

Claude Code operations now trigger highly visible flash animations synchronized with real-time file operations. Read operations display distinct blue flash (0x4488FF), enhanced visibility (3.5x emissive, 1.8x scale), animation batching for 60fps during rapid operations, and hook status notification with debug mod

## Requirements

### Validated

*Shipped in v1.0:*

- [x] 3D force-directed graph visualization using 3d-force-graph library
- [x] Unified view showing phases, plans, tasks, requirements, and files in one space
- [x] Directory tree representation of .planning/ folder
- [x] Phase -> Plan -> Task hierarchy visualization
- [x] Requirements -> Phases relationship mapping
- [x] Color-coded nodes by type (phases, plans, tasks, requirements, files)
- [x] Node sizing based on connection count (more connections = larger)
- [x] Current phase highlighting (glow/pulse effect)
- [x] Progress coloring: completed (green), in-progress (yellow), pending (gray)
- [x] Blocked item indicators with red connections
- [x] 3D navigation (fly through/around the graph)
- [x] Click node to show details panel with contents/metadata
- [x] Click node to zoom/focus camera on that node
- [x] Click node to open file in external editor
- [x] Real-time file watching with live graph updates
- [x] Electron desktop application packaging
- [x] File tree panel with bidirectional graph sync
- [x] 2D/3D toggle switch
- [x] Flash animations on file changes
- [x] Comprehensive file extension color coding (39+ extensions)

*Shipped in v1.1:*

- [x] Expanded file graph showing `.planning/` + `src/` directories
- [x] Live activity feed panel with scrolling file change log
- [x] Heat map visualization for recently changed files
- [x] Git integration showing uncommitted and staged files
- [x] Change type indicators (create/modify/delete)
- [x] Activity statistics panel
- [x] File diff preview for changed files
- [x] Timeline scrubber for activity replay
- [x] Commit nodes in graph

*Shipped in v1.2:*

- [x] Double-click file node opens inspector modal
- [x] Collapsible diff editor with syntax highlighting
- [x] Toggle between git diff and session diff
- [x] Structural breakdown tree for all text files
- [x] File metadata header
- [x] Quick actions bar
- [x] Search within file
- [x] Line numbers with jump-to-line
- [x] Keyboard shortcuts
- [x] Recent activity for selected file
- [x] Related files section

*Shipped in v1.3:*

- [x] Incremental graph updates (no full rebuild on file changes)
- [x] Camera position preserved when files change
- [x] Stronger flash effects with configurable duration/intensity
- [x] Activity trails showing change flow through graph
- [x] Follow-active camera mode
- [x] Zoom presets (overview/focus/detail)
- [x] Named bookmarks with keyboard shortcuts (1-9)
- [x] Back/forward navigation buttons
- [x] Recent nodes dropdown
- [x] Breadcrumb trail showing hierarchy to current node
- [x] Minimap panel with click-to-navigate
- [x] Orbit mode for presentations
- [x] Path animation through bookmarks

*Shipped in v1.4:*

- [x] Claude Code integration via PostToolUse hooks
- [x] Read operation detection with distinct blue flash
- [x] Enhanced flash effects (3.5x emissive, 1.8x scale)
- [x] Operation-specific visual indicators (blue=read, amber=write, green=create, red=delete)
- [x] Animation batching for 60fps during rapid operations
- [x] Hook status notification and debug mode panel

### Active

*v1.5 — GSD Workflow Diagram:*

- [ ] Diagram view toggle (switch between Graph and Diagram views)
- [ ] Workflow pipeline layout (Initialize → Discuss → Plan → Execute → Verify → Complete)
- [ ] Phase artifact blocks (CONTEXT.md, RESEARCH.md, PLANs, SUMMARYs grouped by phase)
- [ ] Artifact completion status indicators (done/in-progress/missing)
- [ ] Click to expand/collapse phase blocks
- [ ] Click artifact to open file inspector
- [ ] Sync selection between diagram and graph views
- [ ] Context window usage visualization (bars showing % utilization)
- [ ] Parallel agent lanes during research/execute stages
- [ ] Atomic commit markers on executed tasks
- [ ] Real-time updates when artifacts change

### Out of Scope

- Mobile app — desktop-first, Electron only
- Web deployment — local app, not hosted service
- Editing files within the app — viewer only, opens editor externally
- Non-GSD projects — specifically designed for GSD .planning/ structure
- Full project scan — limited to .planning/ + src/ for performance

## Context

**Inspiration:** beads_viewer graphical interface — particularly the 3D navigation and spatial exploration of connected data.

**Target users:** Developers using GSD workflow who want visual understanding of their project state, especially during complex multi-phase development.

**Technical foundation:**
- 3d-force-graph library (https://github.com/vasturiano/3d-force-graph) for graph rendering
- Electron for desktop packaging
- chokidar for file system watchers
- electron-store for persistence
- simple-git or native git commands for git integration

**GSD structure to visualize:**
- `.planning/PROJECT.md` — project definition
- `.planning/ROADMAP.md` — phase structure
- `.planning/REQUIREMENTS.md` — requirement definitions
- `.planning/STATE.md` — current progress
- `.planning/phases/*/PLAN.md` — individual phase plans
- `src/` — source code files

## Constraints

- **Library**: Must use 3d-force-graph — user requirement
- **Platform**: Electron app — must work on macOS, Linux, Windows
- **Data source**: GSD .planning/ + src/ folders
- **Performance**: Must handle projects with 1000+ files smoothly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single unified graph vs. multiple views | User preference for seeing everything in one 3D space | ✓ Good |
| 3d-force-graph library | User specified; mature library with good 3D navigation | ✓ Good |
| Electron packaging | Cross-platform desktop app requirement | ✓ Good |
| chokidar for file watching | Robust cross-platform file watcher | ✓ Good |
| esbuild for bundling | Fast ES module bundling for browser | ✓ Good |
| Limit scope to .planning/ + src/ | Performance and relevance balance | — Pending |

---
*Last updated: 2026-01-28 after v1.5 milestone started*
