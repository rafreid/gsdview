# Requirements: GSD Viewer

**Defined:** 2026-01-22
**Core Value:** Make the invisible structure of a GSD project visible and navigable

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Graph Core

- [ ] **GRF-01**: Graph renders as 3D force-directed layout using 3d-force-graph library
- [ ] **GRF-02**: Nodes are color-coded by type (phases, plans, tasks, requirements, files)
- [ ] **GRF-03**: Node size scales based on connection count
- [ ] **GRF-04**: Edges visually connect related nodes with appropriate styling

### GSD Structure

- [ ] **STR-01**: Phase → Plan → Task hierarchy is visualized as connected nodes
- [ ] **STR-02**: Requirements → Phases mapping is visualized
- [ ] **STR-03**: File dependency relationships are detected and shown
- [ ] **STR-04**: Directory tree of .planning/ folder is represented as nodes

### State Display

- [ ] **STA-01**: Current/active phase is highlighted with glow or pulse effect
- [ ] **STA-02**: Nodes colored by progress: completed (green), in-progress (yellow), pending (gray)
- [ ] **STA-03**: Blocked items shown with red connection indicators

### Navigation

- [ ] **NAV-01**: User can orbit (rotate) view by click-dragging
- [ ] **NAV-02**: User can zoom in/out with scroll wheel
- [ ] **NAV-03**: User can pan view with right-click drag
- [ ] **NAV-04**: Clicking a node smoothly flies camera to focus on it

### Interactions

- [ ] **INT-01**: Clicking a node shows details panel with contents/metadata
- [ ] **INT-02**: Hovering over a node shows tooltip with quick info
- [ ] **INT-03**: User can open file in external editor from node

### Live Updates

- [ ] **LIV-01**: App watches .planning/ folder for file changes
- [ ] **LIV-02**: Graph automatically updates when files change
- [ ] **LIV-03**: Manual refresh button available to reload graph

### App

- [ ] **APP-01**: User can select project folder via open dialog
- [ ] **APP-02**: Recent projects are remembered for quick access
- [ ] **APP-03**: Window size and position persist across sessions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

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

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app | Desktop-first, Electron only |
| Web deployment | Local app, not hosted service |
| In-app file editing | Viewer only, opens editor externally |
| Non-GSD projects | Specifically designed for GSD .planning/ structure |
| Real-time collaboration | Single-user tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRF-01 | Phase 1 | Pending |
| GRF-02 | Phase 1 | Pending |
| GRF-03 | Phase 1 | Pending |
| GRF-04 | Phase 1 | Pending |
| STR-01 | Phase 2 | Pending |
| STR-02 | Phase 2 | Pending |
| STR-03 | Phase 2 | Pending |
| STR-04 | Phase 2 | Pending |
| STA-01 | Phase 3 | Pending |
| STA-02 | Phase 3 | Pending |
| STA-03 | Phase 3 | Pending |
| NAV-01 | Phase 4 | Pending |
| NAV-02 | Phase 4 | Pending |
| NAV-03 | Phase 4 | Pending |
| NAV-04 | Phase 4 | Pending |
| INT-01 | Phase 5 | Pending |
| INT-02 | Phase 5 | Pending |
| INT-03 | Phase 5 | Pending |
| LIV-01 | Phase 6 | Pending |
| LIV-02 | Phase 6 | Pending |
| LIV-03 | Phase 6 | Pending |
| APP-01 | Phase 7 | Pending |
| APP-02 | Phase 7 | Pending |
| APP-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after initial definition*
