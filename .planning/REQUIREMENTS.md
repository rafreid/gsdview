# Requirements: GSD Viewer

**Defined:** 2026-01-22 (v1.0), 2026-01-23 (v1.1)
**Core Value:** Make the invisible structure of a GSD project visible and navigable

## v1.0 Requirements (Validated)

*Shipped and verified in v1.0 release.*

### Graph Core
- [x] **GRF-01**: Graph renders as 3D force-directed layout using 3d-force-graph library
- [x] **GRF-02**: Nodes are color-coded by type (phases, plans, tasks, requirements, files)
- [x] **GRF-03**: Node size scales based on connection count
- [x] **GRF-04**: Edges visually connect related nodes with appropriate styling

### GSD Structure
- [x] **STR-01**: Phase -> Plan -> Task hierarchy is visualized as connected nodes
- [x] **STR-02**: Requirements -> Phases mapping is visualized
- [x] **STR-03**: File dependency relationships are detected and shown
- [x] **STR-04**: Directory tree of .planning/ folder is represented as nodes

### State Display
- [x] **STA-01**: Current/active phase is highlighted with glow or pulse effect
- [x] **STA-02**: Nodes colored by progress: completed (green), in-progress (yellow), pending (gray)
- [x] **STA-03**: Blocked items shown with red connection indicators

### Navigation
- [x] **NAV-01**: User can orbit (rotate) view by click-dragging
- [x] **NAV-02**: User can zoom in/out with scroll wheel
- [x] **NAV-03**: User can pan view with right-click drag
- [x] **NAV-04**: Clicking a node smoothly flies camera to focus on it

### Interactions
- [x] **INT-01**: Clicking a node shows details panel with contents/metadata
- [x] **INT-02**: Hovering over a node shows tooltip with quick info
- [x] **INT-03**: User can open file in external editor from node

### Live Updates
- [x] **LIV-01**: App watches .planning/ folder for file changes
- [x] **LIV-02**: Graph automatically updates when files change
- [x] **LIV-03**: Manual refresh button available to reload graph

### App
- [x] **APP-01**: User can select project folder via open dialog
- [x] **APP-02**: Recent projects are remembered for quick access
- [x] **APP-03**: Window size and position persist across sessions

### Enhanced (Quick Tasks)
- [x] **ENH-01**: File tree panel with bidirectional graph synchronization
- [x] **ENH-02**: 2D/3D toggle switch for graph view mode
- [x] **ENH-03**: Flash animations on file changes
- [x] **ENH-04**: Comprehensive file extension color coding (39+ extensions)
- [x] **ENH-05**: Distinct visual shapes for directories vs files

---

## v1.1 Requirements (Active)

Requirements for milestone v1.1: Real-time Activity Visualization.

### Expanded File Scope

- [x] **EXP-01**: Graph includes files from both `.planning/` and `src/` directories
- [x] **EXP-02**: Tree panel shows combined `.planning/` + `src/` structure
- [x] **EXP-03**: File watcher monitors both directories for changes

### Activity Feed

- [x] **FED-01**: Live activity feed panel displays file changes as they happen
- [x] **FED-02**: Each activity entry shows timestamp, file path, and change type
- [x] **FED-03**: Activity feed scrolls automatically to show newest entries
- [x] **FED-04**: Clicking an activity entry navigates to that node in the graph

### Heat Map Visualization

- [ ] **HET-01**: Recently changed files display hot color (red/orange glow)
- [ ] **HET-02**: File heat color cools down over time (red → orange → yellow → normal)
- [ ] **HET-03**: User can configure heat decay rate (how fast files cool down)

### Git Integration

- [ ] **GIT-01**: Nodes show indicator for uncommitted changes (modified files)
- [ ] **GIT-02**: Staged files are visually distinguished from unstaged files
- [ ] **GIT-03**: Recent commits appear as nodes in the graph
- [ ] **GIT-04**: Current branch name is displayed in the UI

### Change Type Indicators

- [x] **CHG-01**: File creation triggers green pulse animation
- [x] **CHG-02**: File modification triggers yellow/orange pulse animation
- [x] **CHG-03**: File deletion triggers red pulse animation and node fade-out

### Activity Statistics

- [ ] **STS-01**: Statistics panel shows most frequently edited files
- [ ] **STS-02**: Statistics panel shows change count per file
- [ ] **STS-03**: Activity over time chart visualizes editing patterns

### Diff Preview

- [ ] **DIF-01**: Details panel shows file diff for recently changed files
- [ ] **DIF-02**: Diff display highlights added lines (green) and removed lines (red)
- [ ] **DIF-03**: Diff compares current state with last known/committed state

### Timeline

- [ ] **TML-01**: Timeline scrubber allows navigating through recent activity history
- [ ] **TML-02**: Timeline can replay file changes over time
- [ ] **TML-03**: Timeline has pause/play controls for activity replay

---

## v2 Requirements (Future)

Deferred to future releases.

### Search & Filter
- **SRC-01**: User can search for nodes by name
- **SRC-02**: User can filter graph to show only certain node types
- **SRC-03**: User can highlight path between two nodes

### Visual Enhancements
- **VIS-01**: Multiple graph layout options (tree, radial, force)
- **VIS-02**: Dark/light theme toggle
- **VIS-03**: Export graph as image (PNG/SVG)

### Keyboard Navigation
- **KEY-01**: Keyboard shortcuts for common actions
- **KEY-02**: Focus mode (isolate selected node and connections)

### Performance
- **PRF-01**: Virtual scrolling for large file trees
- **PRF-02**: Lazy loading for big projects (1000+ files)

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app | Desktop-first, Electron only |
| Web deployment | Local app, not hosted service |
| In-app file editing | Viewer only, opens editor externally |
| Non-GSD projects | Specifically designed for GSD .planning/ structure |
| Full project scan | Limited to .planning/ + src/ for performance |
| Real-time collaboration | Single-user tool |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.1 Requirement Mapping

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXP-01 | Phase 7 | Complete |
| EXP-02 | Phase 7 | Complete |
| EXP-03 | Phase 7 | Complete |
| FED-01 | Phase 8 | Complete |
| FED-02 | Phase 8 | Complete |
| FED-03 | Phase 8 | Complete |
| FED-04 | Phase 8 | Complete |
| CHG-01 | Phase 8 | Complete |
| CHG-02 | Phase 8 | Complete |
| CHG-03 | Phase 8 | Complete |
| HET-01 | Phase 9 | Pending |
| HET-02 | Phase 9 | Pending |
| HET-03 | Phase 9 | Pending |
| GIT-01 | Phase 10 | Pending |
| GIT-02 | Phase 10 | Pending |
| GIT-03 | Phase 10 | Pending |
| GIT-04 | Phase 10 | Pending |
| STS-01 | Phase 11 | Pending |
| STS-02 | Phase 11 | Pending |
| STS-03 | Phase 11 | Pending |
| DIF-01 | Phase 11 | Pending |
| DIF-02 | Phase 11 | Pending |
| DIF-03 | Phase 11 | Pending |
| TML-01 | Phase 12 | Pending |
| TML-02 | Phase 12 | Pending |
| TML-03 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 26 total
- Mapped to phases: 26 (100% coverage)
- Unmapped: 0

**Breakdown by Phase:**
- Phase 7 (Expanded File Scope): 3 requirements
- Phase 8 (Activity Feed & Change Indicators): 7 requirements
- Phase 9 (Heat Map Visualization): 3 requirements
- Phase 10 (Git Integration): 4 requirements
- Phase 11 (Statistics & Diff Preview): 6 requirements
- Phase 12 (Timeline Replay): 3 requirements

---
*Requirements defined: 2026-01-22 (v1.0), 2026-01-23 (v1.1)*
*Last updated: 2026-01-23 after v1.1 roadmap creation*
