# GSD Viewer

## What This Is

A desktop application that visualizes GSD project structure as an interactive 3D force-directed graph. Users can fly through their project's phases, plans, tasks, requirements, and files — seeing relationships, progress, and blockers at a glance. Built with Electron and the 3d-force-graph library.

## Core Value

Make the invisible structure of a GSD project visible and navigable — so users always know where they are, what's connected, and what's blocked.

## Current Milestone: v1.1 Real-time Activity Visualization

**Goal:** Make GSD's file operations visible and understandable in real-time, so users can see exactly what's happening as Claude writes, updates, and changes files.

**Target features:**
- Expanded file graph showing `.planning/` + `src/` directories
- Live activity feed panel showing each file change as it happens
- Heat map visualization (recently changed files glow hot, cool down over time)
- Git integration (uncommitted changes, staged files, recent commits visible)
- Change type indicators (create/modify/delete with distinct colors)
- Activity statistics (most edited files, change frequency)
- File diff preview for recently changed files
- Timeline scrubber to replay recent activity
- Commit nodes showing what was bundled together

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

### Active

*v1.1 scope:*

- [ ] Expanded file graph showing `.planning/` + `src/` directories
- [ ] Live activity feed panel with scrolling file change log
- [ ] Heat map visualization for recently changed files
- [ ] Git integration showing uncommitted and staged files
- [ ] Change type indicators (create/modify/delete)
- [ ] Activity statistics panel
- [ ] File diff preview for changed files
- [ ] Timeline scrubber for activity replay
- [ ] Commit nodes in graph

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
*Last updated: 2026-01-23 after v1.1 milestone start*
