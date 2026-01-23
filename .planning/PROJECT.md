# GSD Viewer

## What This Is

A desktop application that visualizes GSD project structure as an interactive 3D force-directed graph. Users can fly through their project's phases, plans, tasks, requirements, and files — seeing relationships, progress, and blockers at a glance. Built with Electron and the 3d-force-graph library.

## Core Value

Make the invisible structure of a GSD project visible and navigable — so users always know where they are, what's connected, and what's blocked.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 3D force-directed graph visualization using 3d-force-graph library
- [ ] Unified view showing phases, plans, tasks, requirements, and files in one space
- [ ] Directory tree representation of .planning/ folder
- [ ] Phase → Plan → Task hierarchy visualization
- [ ] Requirements → Phases relationship mapping
- [ ] File dependency connections
- [ ] Color-coded nodes by type (phases, plans, tasks, requirements, files)
- [ ] Node sizing based on connection count (more connections = larger)
- [ ] Current phase highlighting (glow/pulse effect)
- [ ] Progress coloring: completed (green), in-progress (yellow), pending (gray)
- [ ] Blocked item indicators with red connections
- [ ] 3D navigation (fly through/around the graph)
- [ ] Click node to show details panel with contents/metadata
- [ ] Click node to zoom/focus camera on that node
- [ ] Click node to open file in external editor
- [ ] Real-time file watching with live graph updates
- [ ] Electron desktop application packaging

### Out of Scope

- Mobile app — desktop-first, Electron only
- Web deployment — local app, not hosted service
- Editing files within the app — viewer only, opens editor externally
- Non-GSD projects — specifically designed for GSD .planning/ structure

## Context

**Inspiration:** beads_viewer graphical interface — particularly the 3D navigation and spatial exploration of connected data.

**Target users:** Developers using GSD workflow who want visual understanding of their project state, especially during complex multi-phase development.

**Technical foundation:**
- 3d-force-graph library (https://github.com/vasturiano/3d-force-graph) for graph rendering
- Electron for desktop packaging
- File system watchers for real-time updates

**GSD structure to visualize:**
- `.planning/PROJECT.md` — project definition
- `.planning/ROADMAP.md` — phase structure
- `.planning/REQUIREMENTS.md` — requirement definitions
- `.planning/STATE.md` — current progress
- `.planning/phases/*/PLAN.md` — individual phase plans
- Directory tree of entire project

## Constraints

- **Library**: Must use 3d-force-graph — user requirement
- **Platform**: Electron app — must work on macOS, Linux, Windows
- **Data source**: GSD .planning/ folder structure — follows GSD conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single unified graph vs. multiple views | User preference for seeing everything in one 3D space | — Pending |
| 3d-force-graph library | User specified; mature library with good 3D navigation | — Pending |
| Electron packaging | Cross-platform desktop app requirement | — Pending |

---
*Last updated: 2026-01-22 after initialization*
