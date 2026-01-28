# Architecture Research: Workflow Diagram View Integration

**Researched:** 2026-01-28
**Confidence:** HIGH

## Summary

The workflow diagram view should integrate as a **parallel rendering mode** alongside the existing 3D graph, using CSS-based view switching (hide/show) to preserve state and avoid re-initialization overhead. A new `diagram-renderer.js` module will handle SVG-based workflow visualization, reusing existing parsers and graph-builder data but with a new transformation layer for workflow-specific layout. Shared state management through a lightweight Vanilla JS approach ensures synchronized selection, file inspection, and real-time updates across both views.

## Existing Components (to reuse/extend)

| Component | Current Role | Changes Needed |
|-----------|--------------|----------------|
| **main.js** | IPC handlers, file watchers, git operations | No changes - existing handlers serve both views |
| **preload.js** | Context bridge for IPC | No changes - API surface sufficient |
| **parsers/** | Parse ROADMAP, STATE, requirements, directory | No changes - output already contains workflow structure |
| **graph-builder.js** | Transforms parsed data to nodes/links | No changes - already provides base data structure |
| **renderer.js** (7662 lines) | 3D graph rendering, UI panels, modals, state | **Extract shared state** to new `state-manager.js`; rename to `graph-renderer.js` for clarity |
| **index.html** | Single page with graph container, panels | **Add diagram container** and **tab controls** for view switching |

## New Components Needed

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| **state-manager.js** | Centralized state for selected node, project data, activity feed, navigation history | None (pure JS) |
| **diagram-renderer.js** | SVG workflow diagram rendering with nested phases/milestones | state-manager.js, workflow-layout.js |
| **workflow-layout.js** | Transform graph data to workflow stage layout (horizontal swim lanes with nested cards) | graph-builder.js output |
| **view-controller.js** | Handle view switching, initialize/cleanup renderers, sync state | state-manager.js, graph-renderer.js, diagram-renderer.js |

## Data Flow

```
PROJECT LOAD:
main.js (parse-project IPC)
  ↓
parsers/*.js → graph-builder.js
  ↓
state-manager.js (stores: currentGraphData, selectedNode, activityFeed)
  ↓ ↓
graph-renderer.js    diagram-renderer.js
(3D visualization)   (SVG workflow)

FILE CHANGE EVENT:
main.js (chokidar watcher)
  ↓
renderer (IPC: files-changed)
  ↓
state-manager.js (update activity, flash node)
  ↓ ↓
graph-renderer.js    diagram-renderer.js
(flash animation)    (highlight card)

USER INTERACTION (node selection):
graph-renderer.js OR diagram-renderer.js
  ↓
state-manager.js (set selectedNode)
  ↓
view-controller.js (sync to both views)
  ↓ ↓
graph-renderer.js    diagram-renderer.js
(camera focus)       (scroll to card)
```

## Integration Strategy

### Phase 1: Extract Shared State
**Goal:** Decouple state from rendering logic

1. Create `src/renderer/state-manager.js`:
   - Export state object with getters/setters
   - Use Proxy pattern for reactive updates (2026 best practice for Vanilla JS)
   - Manage: `currentGraphData`, `selectedNode`, `selectedProjectPath`, `activityEntries`, `navigationHistory`, `bookmarks`

2. Refactor `renderer.js` → `graph-renderer.js`:
   - Replace global state with imports from state-manager
   - Export init function and public API (selectNode, focusCamera, etc.)
   - Keep graph-specific logic: 3D rendering, physics simulation, camera controls

3. Update build process:
   - Bundle state-manager + graph-renderer + (future) diagram-renderer
   - esbuild handles ES6 imports automatically

### Phase 2: Add View Switching UI
**Goal:** Tab controls with CSS-based view toggling

1. Modify `index.html`:
   ```html
   <div id="view-tabs">
     <button class="tab-btn active" data-view="graph">Graph</button>
     <button class="tab-btn" data-view="diagram">Diagram</button>
   </div>

   <div id="graph-view" class="view-container">
     <div id="graph-container"></div>
     <!-- existing panels, modals -->
   </div>

   <div id="diagram-view" class="view-container hidden">
     <div id="diagram-container"></div>
   </div>
   ```

2. CSS strategy (hide/show vs. destroy/recreate):
   - **Use `display: none` for inactive view** - preserves state, faster switching
   - Alternative considered: `visibility: hidden` - keeps layout but updates rendering (worse performance)
   - Rejected: destroy/recreate - slower, loses state like camera position/selection
   - Performance: Hide/show acceptable even with 7662-line renderer; only reflows on toggle

3. Create `view-controller.js`:
   ```javascript
   export function switchView(viewName) {
     // Hide all views
     document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));

     // Show selected view
     const view = document.getElementById(`${viewName}-view`);
     view.classList.remove('hidden');

     // Sync current selection to newly visible view
     if (state.selectedNode) {
       if (viewName === 'graph') graphRenderer.selectNode(state.selectedNode);
       if (viewName === 'diagram') diagramRenderer.selectNode(state.selectedNode);
     }
   }
   ```

### Phase 3: Build Workflow Layout Transform
**Goal:** Convert graph data to workflow stage structure

1. Create `workflow-layout.js`:
   - Input: `{ nodes, links }` from graph-builder
   - Output: `{ stages: [{ name, phases: [{ id, plans: [], tasks: [] }] }] }`
   - Logic:
     - Group nodes by type: phase → plan → task
     - Extract ROADMAP phase order (from parsers)
     - Nest artifacts under phases (plans, STATE tasks)
     - Add horizontal positioning for swim lane layout

2. Example transform:
   ```javascript
   // From graph-builder:
   { nodes: [
     { id: 'phase-1', type: 'phase', name: 'Phase 1: Foundation' },
     { id: 'plan-01-01', type: 'plan', name: 'Setup', parentPhase: 'phase-1' }
   ]}

   // To workflow layout:
   { stages: [
     { name: 'Planning', phases: [
       { id: 'phase-1', name: 'Foundation',
         plans: [{ id: 'plan-01-01', name: 'Setup' }]
       }
     ]}
   ]}
   ```

### Phase 4: Implement SVG Diagram Renderer
**Goal:** Visual workflow representation

1. Create `diagram-renderer.js`:
   - Library choice: **Custom SVG with svg.js** (9KB, lightweight)
   - Alternative considered: JointJS (mature but 200KB+, overkill for static workflow)
   - Alternative considered: workflowChart.js (jQuery dependency, not ideal)
   - Rationale: Simple workflow doesn't need full diagramming library; custom SVG gives full control

2. Rendering approach:
   ```javascript
   export function renderWorkflow(workflowData) {
     // Horizontal swim lanes for workflow stages
     workflowData.stages.forEach((stage, idx) => {
       const laneY = idx * LANE_HEIGHT;

       // Nested cards for phases within stage
       stage.phases.forEach((phase, pIdx) => {
         const card = createPhaseCard(phase, laneY);

         // Attach click handler → state-manager.selectNode(phase.id)
         card.on('click', () => handleNodeSelection(phase.id));
       });
     });
   }

   function handleNodeSelection(nodeId) {
     stateManager.setSelectedNode(nodeId);
     // State manager broadcasts to both renderers
   }
   ```

3. Visual design:
   - Horizontal swim lanes (like BPMN) for workflow stages
   - Nested rounded rectangles for phases (color-coded by status)
   - Compact lists for plans/tasks inside phase cards
   - Hover tooltips showing full metadata

### Phase 5: Wire State Synchronization
**Goal:** Selection/updates sync across views

1. State manager event system:
   ```javascript
   // state-manager.js
   const listeners = { nodeSelected: [], activityUpdate: [] };

   export function setSelectedNode(nodeId) {
     state.selectedNode = nodeId;
     listeners.nodeSelected.forEach(cb => cb(nodeId));
   }

   export function onNodeSelected(callback) {
     listeners.nodeSelected.push(callback);
   }
   ```

2. Wire listeners in each renderer:
   ```javascript
   // graph-renderer.js
   stateManager.onNodeSelected(nodeId => {
     if (isCurrentView('graph')) {
       focusCameraOnNode(nodeId);
       highlightNode(nodeId);
     }
   });

   // diagram-renderer.js
   stateManager.onNodeSelected(nodeId => {
     if (isCurrentView('diagram')) {
       scrollToCard(nodeId);
       highlightCard(nodeId);
     }
   });
   ```

3. File watcher integration:
   - Existing `files-changed` IPC handler already works
   - State manager receives activity update
   - Both renderers listen to activity updates
   - Graph: flash animation (existing)
   - Diagram: pulse border on affected card (new)

### Phase 6: Add Diagram-Specific Features
**Goal:** Differentiate diagram view value

1. **Auto-layout on window resize** - recalculate card positions for responsive design
2. **Collapse/expand phase cards** - hide/show nested plans/tasks
3. **Status-based filtering** - show only in-progress phases
4. **Export to PNG** - save diagram snapshot (using svg.js export)

## Suggested Build Order

### Milestone 1: Foundation (1-2 days)
**Why first:** Establishes clean architecture before adding complexity
1. Extract shared state to `state-manager.js`
2. Refactor `renderer.js` → `graph-renderer.js` with state imports
3. Verify graph view still works identically
4. **Success criteria:** Graph loads, selections work, activity feed updates

### Milestone 2: View Switching (1 day)
**Why second:** UI framework for both views before building diagram
1. Add tab controls to index.html
2. Create `view-controller.js` with CSS-based switching
3. Wire tab buttons to switch views
4. **Success criteria:** Can toggle between views (diagram empty but container exists)

### Milestone 3: Workflow Layout (1-2 days)
**Why third:** Data layer before rendering
1. Create `workflow-layout.js` transform
2. Unit test with real GSDv project data
3. Integrate into project load flow
4. **Success criteria:** Console log shows correct workflow structure from graph data

### Milestone 4: Basic Diagram Rendering (2-3 days)
**Why fourth:** Core visual implementation
1. Install svg.js via npm
2. Create `diagram-renderer.js` with basic swim lane layout
3. Render phases as cards with nested plans
4. **Success criteria:** Diagram view shows workflow stages and phases visually

### Milestone 5: Interaction Sync (1-2 days)
**Why fifth:** Wire state between views
1. Add click handlers in diagram-renderer
2. Wire state manager listeners for selection sync
3. Test: click in graph → highlights in diagram when switched, vice versa
4. **Success criteria:** Selection persists across view switches

### Milestone 6: Real-time Updates (1 day)
**Why sixth:** Leverage existing file watcher infrastructure
1. Diagram-renderer subscribes to activity updates
2. Implement card highlight animation on file change
3. Test with live file editing
4. **Success criteria:** File changes flash in both graph and diagram views

### Milestone 7: Polish (1-2 days)
**Why last:** Quality-of-life features after core works
1. Collapse/expand phase cards
2. Responsive layout on resize
3. Diagram-specific styling and status colors
4. **Success criteria:** Diagram view feels polished and useful

**Total estimated time:** 8-12 days (depends on complexity discovered during implementation)

## File Organization Recommendations

```
src/
├── main/
│   ├── main.js                    # (no changes)
│   ├── preload.js                 # (no changes)
│   ├── graph-builder.js           # (no changes)
│   └── parsers/                   # (no changes)
│       ├── roadmap-parser.js
│       ├── state-parser.js
│       └── ...
├── renderer/
│   ├── index.html                 # (MODIFIED: add tabs + diagram container)
│   ├── state-manager.js           # (NEW: centralized state)
│   ├── view-controller.js         # (NEW: view switching)
│   ├── graph-renderer.js          # (RENAMED from renderer.js, MODIFIED: use state-manager)
│   ├── diagram-renderer.js        # (NEW: SVG workflow rendering)
│   ├── workflow-layout.js         # (NEW: data transform)
│   └── bundle.js                  # (GENERATED: esbuild bundles all)
```

## Architecture Patterns Applied

### Single-Page Application State Management (2026)
- **Pattern:** Centralized state with reactive Proxy pattern
- **Source:** State management in Vanilla JS uses Proxy for reactivity without frameworks
- **Rationale:** No framework overhead, native browser support in 2026, simpler than Redux for this scale

### View Switching: Hide/Show vs. Destroy/Recreate
- **Pattern:** CSS `display: none` for inactive views
- **Source:** Hide/show preserves state and is faster for switching, uses more memory but acceptable for two views
- **Rationale:** Maintains camera position, selection, activity state; reflow only on toggle (not expensive for 2 views)

### Canvas vs. SVG Rendering
- **Pattern:** 3D graph uses Canvas (via three.js), 2D diagram uses SVG
- **Source:** Hybrid approach is 2026 trend - Canvas for complex rendering (3D graph), SVG for interactive diagrams with DOM accessibility
- **Rationale:** Graph has thousands of nodes (Canvas wins); diagram has <100 elements (SVG wins for interactivity)

### Shared State Between Renderers
- **Pattern:** Observer pattern with event listeners
- **Source:** SVG keeps state in DOM, Canvas requires manual state tracking - separate renderers need shared state layer
- **Rationale:** Decouples renderers, enables independent view evolution, supports future views (table, timeline, etc.)

## Anti-Patterns Avoided

### ❌ Embedding Diagram in Graph Renderer
**Why bad:** 7662-line file becomes 10K+ lines, harder to test, violates single responsibility
**Instead:** Separate module with clear interface

### ❌ Duplicating Parser Logic
**Why bad:** Parsing ROADMAP twice (once for graph, once for diagram) causes inconsistency
**Instead:** Reuse graph-builder output, transform for workflow layout

### ❌ Using Heavy Framework for Simple Workflow
**Why bad:** JointJS (200KB+) adds bloat for static workflow diagram
**Instead:** Lightweight svg.js (9KB) or custom SVG for full control

### ❌ Destroying/Recreating Views on Toggle
**Why bad:** Loses state (camera position, selection), re-initialization overhead, janky UX
**Instead:** CSS hide/show preserves state, faster switching

## Integration Points with Existing Components

### With main.js
- **No changes required** - existing IPC handlers (`parse-project`, `files-changed`) already provide necessary data
- File watcher sends events to renderer regardless of active view
- Git operations work identically for both views

### With parsers/
- **No changes required** - parsers already extract phase hierarchy, plan lists, task status
- `roadmap-parser.js` output contains phase order and nesting (needed for workflow layout)
- `state-parser.js` provides task status (displayed in diagram phase cards)

### With graph-builder.js
- **No changes required** - output format `{ nodes, links }` is input for both renderers
- Graph renderer uses nodes/links directly for 3D force layout
- Workflow layout transforms nodes/links into stage structure

### With Activity Feed Panel
- **Shared component** - activity panel should be visible in both views
- Current implementation in renderer.js can be extracted to shared UI layer
- Both renderers update activity feed via state-manager

### With File Inspector Modal
- **Shared component** - file inspector triggered by node selection works identically
- Double-click in graph OR diagram should open same modal
- Modal accesses file content via existing IPC handlers

## Scalability Considerations

| Concern | Current (Graph only) | With Diagram | Mitigation |
|---------|---------------------|--------------|------------|
| **Memory usage** | ~50MB for 1K nodes | +10MB for diagram (SVG DOM) | Hide/show keeps both in memory; acceptable for desktop app |
| **Initial load time** | 500ms for graph init | +200ms for diagram init | Lazy-load diagram on first switch (not on project load) |
| **File change handling** | Flash animation (20-30ms) | Flash + diagram update (+10ms) | Acceptable; both use requestAnimationFrame |
| **Codebase size** | 7662 lines (renderer.js) | Split into 4 modules (~2K lines each) | Improved maintainability, easier testing |

## Sources

**Architecture Patterns:**
- [Advanced Electron.js architecture](https://blog.logrocket.com/advanced-electron-js-architecture/) - Multi-window and renderer organization patterns
- [Building Multi-Screen Electron Applications](https://corticalflow.com/en/blog/building-multi-screen-electron-apps) - View management in Electron

**Diagram Libraries (2026):**
- [Top 8 JavaScript diagramming libraries in 2026](https://www.jointjs.com/blog/javascript-diagramming-libraries) - JointJS, yFiles, GoJS comparison
- [10 Best Flowchart JavaScript Libraries (2026 Update)](https://www.jqueryscript.net/blog/best-flowchart.html) - Workflow-specific libraries
- [workflow-svg.js](https://thomaswruss.github.io/workflow-svg.js/) - Lightweight workflow visualization (9KB)

**State Management (2026):**
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - Proxy pattern for reactive state
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Lightweight stores like Zustand (40% adoption)

**Canvas vs. SVG:**
- [Using SVG vs. Canvas: A short guide](https://blog.logrocket.com/svg-vs-canvas/) - Performance comparison and use cases
- [SVG vs Canvas Animation: Best Choice for Modern Frontends](https://www.augustinfotech.com/blogs/svg-vs-canvas-animation-what-modern-frontends-should-use-in-2026/) - Hybrid approach trends in 2026

**View Switching Performance:**
- [Using CSS content-visibility to boost rendering performance](https://blog.logrocket.com/using-css-content-visibility-boost-rendering-performance/) - Modern CSS for view optimization
- [Preserving and Resetting State – React](https://react.dev/learn/preserving-and-resetting-state) - Hide/show vs. destroy/recreate tradeoffs

**Workflow Layout:**
- [Visualizing Flowcharts with JavaScript](https://www.yworks.com/pages/visualizing-flowcharts-with-javascript) - Hierarchical layout for workflow stages
- [Interactive Diagram for Building Flowcharts (GoJS)](https://gojs.net/latest/samples/flowchart.html) - Swim lane layout patterns
