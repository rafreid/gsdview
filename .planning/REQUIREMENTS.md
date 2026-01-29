# Requirements: GSD Viewer v1.6

**Defined:** 2026-01-28
**Core Value:** Real-time visibility into what's happening when GSD is cooking

## v1.6 Requirements

Requirements for Live Activity Intelligence. Each maps to roadmap phases.

### Live Dashboard View

- [ ] **DASH-01**: User sees current operation indicator (reading/writing/thinking/idle)
- [ ] **DASH-02**: User sees active file highlight with pulsing animation
- [ ] **DASH-03**: User sees rolling activity sparkline (last 5 minutes)
- [ ] **DASH-04**: User sees session statistics (files touched, operations count, time active)
- [ ] **DASH-05**: User sees operation breakdown (pie chart: reads vs writes vs creates)
- [ ] **DASH-06**: User can toggle Dashboard view via tab controls

### File Heatmap View

- [ ] **HEAT-01**: User sees treemap visualization where rectangle size = file size
- [ ] **HEAT-02**: User sees color intensity representing activity frequency (red=hot, blue=cold)
- [ ] **HEAT-03**: User can click to drill down into directories
- [ ] **HEAT-04**: User can filter by time range (last hour / this session / all time)
- [ ] **HEAT-05**: User sees file details and recent operations on hover
- [ ] **HEAT-06**: User can toggle Heatmap view via tab controls

### Operation Flow Timeline

- [ ] **TIME-01**: User sees horizontal timeline of all GSD operations
- [ ] **TIME-02**: User sees color-coded blocks (blue=read, amber=write, green=create, red=delete)
- [ ] **TIME-03**: User sees operations grouped by file in swimlanes
- [ ] **TIME-04**: User can scrub timeline to see file state at any moment
- [ ] **TIME-05**: User sees pattern detection highlights (read-then-write sequences)
- [ ] **TIME-06**: User can zoom in/out on time ranges

### Context Window Meter

- [ ] **CNTX-01**: User sees progress bar showing estimated context usage percentage
- [ ] **CNTX-02**: User sees list of files currently "in context" (recently read/written)
- [ ] **CNTX-03**: User sees warning indicator when approaching context limits
- [ ] **CNTX-04**: User sees prediction of what files might fall out of context

### Smart Notifications

- [ ] **NOTF-01**: User sees toast notifications for significant activity events
- [ ] **NOTF-02**: User sees "Claude created N new files in X" notifications
- [ ] **NOTF-03**: User sees "Rapid activity in X directory" alerts
- [ ] **NOTF-04**: User can configure which notification types to show

### Session Recording

- [ ] **SESS-01**: User can start/stop session recording
- [ ] **SESS-02**: System captures all file operations with timestamps during recording
- [ ] **SESS-03**: User can playback recorded sessions at 1x, 2x, 4x, 8x speed
- [ ] **SESS-04**: User can export session report as markdown summary
- [ ] **SESS-05**: User can view list of saved recordings

## Future Requirements (v2+)

### Advanced Analysis

- **ANLZ-01**: Machine learning pattern detection across sessions
- **ANLZ-02**: Anomaly detection (unusual activity patterns)
- **ANLZ-03**: Productivity metrics and insights

### Collaboration

- **COLB-01**: Share session recordings with team
- **COLB-02**: Real-time multi-viewer mode

## Out of Scope

| Feature | Reason |
|---------|--------|
| Actual context window API | Claude doesn't expose this; must estimate |
| File content in timeline | Privacy/performance; show metadata only |
| Cross-project analytics | Single project focus for v1.6 |
| Cloud sync of recordings | Local-first app philosophy |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 36 | Pending |
| DASH-02 | Phase 36 | Pending |
| DASH-03 | Phase 36 | Pending |
| DASH-04 | Phase 36 | Pending |
| DASH-05 | Phase 36 | Pending |
| DASH-06 | Phase 36 | Pending |
| HEAT-01 | Phase 37 | Pending |
| HEAT-02 | Phase 37 | Pending |
| HEAT-03 | Phase 37 | Pending |
| HEAT-04 | Phase 37 | Pending |
| HEAT-05 | Phase 37 | Pending |
| HEAT-06 | Phase 37 | Pending |
| TIME-01 | Phase 38 | Pending |
| TIME-02 | Phase 38 | Pending |
| TIME-03 | Phase 38 | Pending |
| TIME-04 | Phase 38 | Pending |
| TIME-05 | Phase 38 | Pending |
| TIME-06 | Phase 38 | Pending |
| CNTX-01 | Phase 39 | Pending |
| CNTX-02 | Phase 39 | Pending |
| CNTX-03 | Phase 39 | Pending |
| CNTX-04 | Phase 39 | Pending |
| NOTF-01 | Phase 40 | Pending |
| NOTF-02 | Phase 40 | Pending |
| NOTF-03 | Phase 40 | Pending |
| NOTF-04 | Phase 40 | Pending |
| SESS-01 | Phase 41 | Pending |
| SESS-02 | Phase 41 | Pending |
| SESS-03 | Phase 41 | Pending |
| SESS-04 | Phase 41 | Pending |
| SESS-05 | Phase 41 | Pending |

**Coverage:**
- v1.6 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after initial definition*
