# Requirements: GSD Viewer

**Defined:** 2026-01-22 (v1.0), 2026-01-23 (v1.1), 2026-01-24 (v1.2, v1.3)
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

## v1.1 Requirements (Complete)

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

- [x] **HET-01**: Recently changed files display hot color (red/orange glow)
- [x] **HET-02**: File heat color cools down over time (red → orange → yellow → normal)
- [x] **HET-03**: User can configure heat decay rate (how fast files cool down)

### Git Integration

- [x] **GIT-01**: Nodes show indicator for uncommitted changes (modified files)
- [x] **GIT-02**: Staged files are visually distinguished from unstaged files
- [x] **GIT-03**: Recent commits appear as nodes in the graph
- [x] **GIT-04**: Current branch name is displayed in the UI

### Change Type Indicators

- [x] **CHG-01**: File creation triggers green pulse animation
- [x] **CHG-02**: File modification triggers yellow/orange pulse animation
- [x] **CHG-03**: File deletion triggers red pulse animation and node fade-out

### Activity Statistics

- [x] **STS-01**: Statistics panel shows most frequently edited files
- [x] **STS-02**: Statistics panel shows change count per file
- [x] **STS-03**: Activity over time chart visualizes editing patterns

### Diff Preview

- [x] **DIF-01**: Details panel shows file diff for recently changed files
- [x] **DIF-02**: Diff display highlights added lines (green) and removed lines (red)
- [x] **DIF-03**: Diff compares current state with last known/committed state

### Timeline

- [x] **TML-01**: Timeline scrubber allows navigating through recent activity history
- [x] **TML-02**: Timeline can replay file changes over time
- [x] **TML-03**: Timeline has pause/play controls for activity replay

---

## v1.2 Requirements (Complete)

Requirements for milestone v1.2: File Deep Dive.

### Modal Core

- [x] **MOD-01**: Double-clicking a file node opens the file inspector modal
- [x] **MOD-02**: Modal has collapsible sections for diff, structure, and context
- [x] **MOD-03**: Esc key closes the modal
- [x] **MOD-04**: Ctrl+F opens search within modal

### Diff Editor

- [x] **DFE-01**: Diff editor shows file content with syntax highlighting
- [x] **DFE-02**: Diff editor is collapsible (expand/collapse toggle)
- [x] **DFE-03**: User can toggle between git diff (vs HEAD) and session diff (vs last viewed)
- [x] **DFE-04**: Line numbers displayed with click-to-jump functionality
- [x] **DFE-05**: Added lines highlighted in green, removed lines in red

### Structure Tree

- [x] **TRE-01**: Structure tree parses markdown files (headers, lists, code blocks)
- [x] **TRE-02**: Structure tree parses code files (functions, classes, imports, exports)
- [x] **TRE-03**: Structure tree parses config files (JSON/YAML keys and nested structure)
- [x] **TRE-04**: Tree nodes are collapsible/expandable
- [x] **TRE-05**: Clicking a tree node scrolls diff editor to that location

### File Context

- [x] **CTX-01**: Metadata header shows file path, size, last modified date, and git status
- [x] **CTX-02**: Quick actions bar with "Open in Editor" button
- [x] **CTX-03**: Quick actions bar with "Copy Path" button
- [x] **CTX-04**: Quick actions bar with "Copy Content" button
- [x] **CTX-05**: Search input filters/highlights content in diff view
- [x] **CTX-06**: Recent activity section shows this file's changes from activity log
- [x] **CTX-07**: Related files section shows files that import/reference this file

---

## v1.3 Requirements (Active)

Requirements for milestone v1.3: Enhanced Navigation + Smooth Activity.

### Smart Camera

- [ ] **CAM-01**: Camera automatically follows node when file changes are detected (follow-active)
- [ ] **CAM-02**: Zoom preset buttons for overview, focus, and detail levels
- [ ] **CAM-03**: Orbit mode auto-rotates camera around current focus for presentations
- [ ] **CAM-04**: Path animation smoothly flies camera through selected nodes

### Bookmarks & History

- [ ] **BKM-01**: User can save named bookmarks (camera position + selected node)
- [ ] **BKM-02**: Back/forward buttons navigate through recently visited nodes
- [ ] **BKM-03**: Recent nodes dropdown shows last 10 visited nodes for quick return
- [ ] **BKM-04**: Keyboard shortcuts (1-9) jump to saved bookmarks

### Minimap

- [ ] **MAP-01**: Minimap panel shows bird's-eye overview of entire graph
- [ ] **MAP-02**: Current viewport position is indicated on minimap
- [ ] **MAP-03**: Clicking on minimap navigates to that position

### Breadcrumb Trail

- [ ] **BRD-01**: Breadcrumb trail shows hierarchy path from root to current node
- [ ] **BRD-02**: Clicking breadcrumb segment navigates to that ancestor node

### Smooth Activity Updates

- [x] **UPD-01**: Graph updates incrementally (add/remove nodes without full rebuild)
- [x] **UPD-02**: Camera position is preserved when files change (never reset)
- [x] **UPD-03**: Graph layout maintains stability when nodes are added/removed

### Enhanced Flash Effects

- [x] **FLX-01**: Flash effects use brighter, more visible pulse/glow animations
- [x] **FLX-02**: Flash duration and intensity are configurable
- [x] **FLX-03**: Different flash patterns for create/modify/delete events

### Activity Trails

- [x] **TRL-01**: Visual trails show recent activity flow through graph
- [x] **TRL-02**: Trail intensity fades over time (recent = bright, older = dim)
- [x] **TRL-03**: User can toggle activity trails on/off

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
| HET-01 | Phase 9 | Complete |
| HET-02 | Phase 9 | Complete |
| HET-03 | Phase 9 | Complete |
| GIT-01 | Phase 10 | Complete |
| GIT-02 | Phase 10 | Complete |
| GIT-03 | Phase 10 | Complete |
| GIT-04 | Phase 10 | Complete |
| STS-01 | Phase 11 | Complete |
| STS-02 | Phase 11 | Complete |
| STS-03 | Phase 11 | Complete |
| DIF-01 | Phase 11 | Complete |
| DIF-02 | Phase 11 | Complete |
| DIF-03 | Phase 11 | Complete |
| TML-01 | Phase 12 | Complete |
| TML-02 | Phase 12 | Complete |
| TML-03 | Phase 12 | Complete |

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

### v1.2 Requirement Mapping

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOD-01 | Phase 13 | Complete |
| MOD-02 | Phase 13 | Complete |
| MOD-03 | Phase 17 | Complete |
| MOD-04 | Phase 17 | Complete |
| DFE-01 | Phase 14 | Complete |
| DFE-02 | Phase 14 | Complete |
| DFE-03 | Phase 14 | Complete |
| DFE-04 | Phase 14 | Complete |
| DFE-05 | Phase 14 | Complete |
| TRE-01 | Phase 15 | Complete |
| TRE-02 | Phase 15 | Complete |
| TRE-03 | Phase 15 | Complete |
| TRE-04 | Phase 15 | Complete |
| TRE-05 | Phase 15 | Complete |
| CTX-01 | Phase 16 | Complete |
| CTX-02 | Phase 16 | Complete |
| CTX-03 | Phase 16 | Complete |
| CTX-04 | Phase 16 | Complete |
| CTX-05 | Phase 17 | Complete |
| CTX-06 | Phase 16 | Complete |
| CTX-07 | Phase 16 | Complete |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18 (100% coverage)
- Unmapped: 0

**Breakdown by Phase:**
- Phase 13 (Modal Foundation): 2 requirements
- Phase 14 (Diff Editor): 5 requirements
- Phase 15 (Structure Tree): 5 requirements
- Phase 16 (File Context & Metadata): 6 requirements
- Phase 17 (Search & Polish): 3 requirements

### v1.3 Requirement Mapping

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPD-01 | Phase 18 | Complete |
| UPD-02 | Phase 18 | Complete |
| UPD-03 | Phase 18 | Complete |
| FLX-01 | Phase 19 | Complete |
| FLX-02 | Phase 19 | Complete |
| FLX-03 | Phase 19 | Complete |
| TRL-01 | Phase 20 | Complete |
| TRL-02 | Phase 20 | Complete |
| TRL-03 | Phase 20 | Complete |
| CAM-01 | Phase 21 | Pending |
| CAM-02 | Phase 21 | Pending |
| BKM-01 | Phase 22 | Pending |
| BKM-02 | Phase 22 | Pending |
| BKM-03 | Phase 22 | Pending |
| BKM-04 | Phase 22 | Pending |
| BRD-01 | Phase 23 | Pending |
| BRD-02 | Phase 23 | Pending |
| MAP-01 | Phase 24 | Pending |
| MAP-02 | Phase 24 | Pending |
| MAP-03 | Phase 24 | Pending |
| CAM-03 | Phase 25 | Pending |
| CAM-04 | Phase 25 | Pending |

**Coverage:**
- v1.3 requirements: 22 total
- Mapped to phases: 22 (100% coverage)
- Unmapped: 0

**Breakdown by Phase:**
- Phase 18 (Smooth Activity Updates): 3 requirements
- Phase 19 (Enhanced Flash Effects): 3 requirements
- Phase 20 (Activity Trails): 3 requirements
- Phase 21 (Smart Camera Core): 2 requirements
- Phase 22 (Bookmarks & History): 4 requirements
- Phase 23 (Breadcrumb Trail): 2 requirements
- Phase 24 (Minimap): 3 requirements
- Phase 25 (Advanced Camera): 2 requirements

---
*Requirements defined: 2026-01-22 (v1.0), 2026-01-23 (v1.1), 2026-01-24 (v1.2, v1.3)*
*Last updated: 2026-01-24 (v1.3 phase mappings added)*
