# Requirements: GSD Viewer v1.5

**Defined:** 2026-01-28
**Core Value:** Make the invisible structure of a GSD project visible and navigable — now including workflow-oriented visualization

## v1.5 Requirements

Requirements for workflow diagram view. Each maps to roadmap phases.

### Architecture Foundation ✓

- [x] **ARCH-01**: State-manager.js centralizes selection, project data, and activity state
- [x] **ARCH-02**: Renderer.js refactored to graph-renderer.js with state imports
- [x] **ARCH-03**: Explicit lifecycle methods (mount/unmount) for view management
- [x] **ARCH-04**: Animation frame cleanup patterns prevent memory leaks

### View Switching

- [ ] **VIEW-01**: User can toggle between Graph and Diagram views via tab controls
- [ ] **VIEW-02**: Selection persists across view switches
- [ ] **VIEW-03**: Keyboard shortcuts route correctly per active view
- [ ] **VIEW-04**: File watcher updates route to both views without race conditions

### Diagram Layout

- [ ] **DIAG-01**: Pipeline shows 6 GSD stages (Initialize → Discuss → Plan → Execute → Verify → Complete)
- [ ] **DIAG-02**: Stages display as distinct containers with status indicators
- [ ] **DIAG-03**: Connection lines show sequential workflow flow
- [ ] **DIAG-04**: Layout supports horizontal scroll/pan for navigation
- [ ] **DIAG-05**: "Why it works" context usage bars show utilization per stage
- [ ] **DIAG-06**: Parallel agent lanes visualize concurrent research/execution work

### Artifact Visualization

- [ ] **ARTF-01**: Artifact blocks nest within stage containers (CONTEXT.md, RESEARCH.md, PLANs, SUMMARYs)
- [ ] **ARTF-02**: Each artifact shows completion status (done/in-progress/missing)
- [ ] **ARTF-03**: Status colors: green (done), yellow (in-progress), gray (missing)
- [ ] **ARTF-04**: Current stage/phase highlighted based on STATE.md
- [ ] **ARTF-05**: Execute stage shows atomic commit markers on completed tasks

### Interactivity

- [ ] **INTR-01**: Click artifact opens file inspector modal
- [ ] **INTR-02**: Hover shows tooltip with file metadata
- [ ] **INTR-03**: Click stage header to expand/collapse artifact detail
- [ ] **INTR-04**: Two-way sync: select in diagram → highlights corresponding node in graph
- [ ] **INTR-05**: Two-way sync: select in graph → highlights corresponding artifact in diagram
- [ ] **INTR-06**: Bookmark shortcuts (1-9) work in diagram view for quick phase navigation

### Real-Time Updates

- [ ] **LIVE-01**: File changes detected via existing watcher trigger diagram updates
- [ ] **LIVE-02**: Flash animation highlights changed artifacts in diagram
- [ ] **LIVE-03**: Activity feed shows changes from both views

## Future Requirements (v2+)

### Advanced Visualization

- **VIS-01**: Timeline replay updates diagram state (historical view)
- **VIS-02**: Progress rings showing percentage complete per stage
- **VIS-03**: Minimap adaptation for diagram view

### Export

- **EXP-01**: Export diagram as SVG
- **EXP-02**: Export diagram as PNG

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editable diagram | GSD workflow is fixed, not user-customizable |
| Freeform flowchart editor | Adds complexity without value; viewer-only app |
| Vertical swimlanes per file | Too many lanes = visual noise |
| Heavy transition animations | Distracts from information display |
| Everything expanded by default | Overwhelming; progressive disclosure preferred |
| Detailed content preview inline | Use existing inspector modal instead |
| Diagram zoom in/out | Horizontal scroll/pan sufficient for 2D layout |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 30 | Complete |
| ARCH-02 | Phase 30 | Complete |
| ARCH-03 | Phase 30 | Complete |
| ARCH-04 | Phase 30 | Complete |
| VIEW-01 | Phase 31 | Pending |
| VIEW-02 | Phase 31 | Pending |
| VIEW-03 | Phase 31 | Pending |
| VIEW-04 | Phase 31 | Pending |
| DIAG-01 | Phase 32 | Pending |
| DIAG-02 | Phase 32 | Pending |
| DIAG-03 | Phase 32 | Pending |
| DIAG-04 | Phase 32 | Pending |
| DIAG-05 | Phase 35 | Pending |
| DIAG-06 | Phase 35 | Pending |
| ARTF-01 | Phase 32 | Pending |
| ARTF-02 | Phase 32 | Pending |
| ARTF-03 | Phase 32 | Pending |
| ARTF-04 | Phase 32 | Pending |
| ARTF-05 | Phase 35 | Pending |
| INTR-01 | Phase 33 | Pending |
| INTR-02 | Phase 33 | Pending |
| INTR-03 | Phase 33 | Pending |
| INTR-04 | Phase 33 | Pending |
| INTR-05 | Phase 33 | Pending |
| INTR-06 | Phase 33 | Pending |
| LIVE-01 | Phase 34 | Pending |
| LIVE-02 | Phase 34 | Pending |
| LIVE-03 | Phase 34 | Pending |

**Coverage:**
- v1.5 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 (Phase 30 requirements complete)*
