# Pitfalls Research: Adding Workflow Diagram View to GSD Viewer

## Summary

Adding a second visualization view (workflow diagram) to an existing complex application with 7600+ lines of renderer code, real-time file watching, and multiple coordinated UI components creates high risk for memory leaks, state synchronization bugs, and rendering conflicts. The most critical risks are: incomplete cleanup when switching views causing memory accumulation, stale closures capturing outdated state, and race conditions when file watcher events update both views simultaneously.

## Critical Pitfalls

### 1. Memory Leaks from Incomplete View Cleanup

**Risk:** When switching between Graph and Diagram views, the inactive view's resources (Three.js objects, event listeners, animation frames) remain in memory if not explicitly destroyed. With 94+ instances of `addEventListener` and `requestAnimationFrame` in the current codebase, each view switch without proper cleanup compounds memory usage.

**Warning Signs:**
- Memory usage increases each time user toggles views
- Browser DevTools heap snapshots show detached DOM trees
- Application becomes sluggish after 5-10 view switches
- `MaxListenersExceededWarning` in console
- Three.js objects appear in memory profiler after view is hidden

**Prevention:**
- Create explicit lifecycle methods for each view: `mountView()` and `unmountView()`
- Track all event listeners in arrays: `this.viewEventListeners = []` with cleanup loop
- Cancel all animation frames: store `animationFrameId = requestAnimationFrame()` and call `cancelAnimationFrame(animationFrameId)`
- Dispose Three.js objects explicitly: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`
- Remove DOM event listeners: match each `addEventListener` with `removeEventListener` in cleanup
- Test view switching 20+ times in DevTools Memory panel to verify no accumulation

**Phase to Address:** Phase 1 (Architecture Foundation) - establish cleanup contract before building diagram view

**Confidence:** HIGH - Verified by Electron memory leak documentation and Three.js forum discussions

### 2. Stale Closures in Event Handlers Across Views

**Risk:** Event handlers (keyboard shortcuts, file watcher callbacks, IPC handlers) capture view state at registration time. When views switch, handlers still reference old view state, causing updates to apply to wrong view or use outdated node references. React's `useEffectEvent` (React 19.2) addresses this, but vanilla JS requires manual patterns.

**Warning Signs:**
- Keyboard shortcut "jump to node" jumps in wrong view
- File changes flash in diagram view even when graph view is active
- Selection sync goes to wrong view after toggle
- Inspector modal shows stale data when opened from diagram
- Console errors about undefined nodes after view switch

**Prevention:**
- Use function references with current state lookup: `() => getCurrentView().selectedNode` instead of closure-captured `selectedNode`
- Implement view context object that updates on switch: `activeViewContext = { type: 'graph', nodes: [...] }`
- Re-register file watcher callbacks on view switch (or use shared callback with view routing)
- Pass state as parameters rather than capturing: `handleNodeClick(nodeId, viewType)` instead of `handleNodeClick(nodeId)`
- Use `useRef` pattern (or vanilla equivalent) for latest value: `viewRef.current = activeView`
- Test: switch views, trigger keyboard shortcuts, verify correct view responds

**Phase to Address:** Phase 1 (Architecture Foundation) - establish state management pattern before handlers multiply

**Confidence:** HIGH - React stale closure documentation and recent useEffectEvent discussions (Jan 2026)

### 3. Race Conditions in File Watcher Updates to Multiple Views

**Risk:** File watcher emits events on separate threads. When a file changes, both graph and diagram update handlers may execute simultaneously, causing: (1) partial updates if they share state, (2) render conflicts if both redraw concurrently, (3) animation collisions if both trigger flash effects. The existing ~3.5x emissive flash effect could double-trigger.

**Warning Signs:**
- Inconsistent node highlighting between views after file changes
- Flash animations sometimes missing or double-flashing
- Graph shows updated file but diagram shows stale version (or vice versa)
- Console warnings: "Modify event occurred but file contents empty"
- Activity feed shows duplicate entries for same file change

**Prevention:**
- Centralize file change handling with view routing: `onFileChange(path) { updateGraphView(path); updateDiagramView(path); }`
- Use debouncing for watcher events: 50-100ms delay to batch rapid changes
- Add update queue with atomic processing: `fileUpdateQueue.push(change); processQueue()`
- Implement view-specific update flags: `graphNeedsUpdate = true` checked in render loop
- Ensure thread-safe state updates (avoid concurrent modification of shared `currentGraphData`)
- Add sequence numbers to updates to detect out-of-order processing
- Test: rapid file changes (10+ files in 1 second), verify both views update correctly without duplication

**Phase to Address:** Phase 2 (View Switching) - before connecting file watcher to diagram view

**Confidence:** HIGH - Electron file watcher race conditions and thread safety documentation

### 4. Uncanceled Animation Frames from Both Views Running Simultaneously

**Risk:** The 3D graph runs a continuous `requestAnimationFrame` loop for rendering. If diagram view also uses animation (for layout transitions or flash effects), and both loops run simultaneously, they compete for frame budget. Worse, if view switching doesn't cancel the inactive view's animation loop, multiple loops accumulate (hot-reload bug compounds this).

**Warning Signs:**
- "Violation: requestAnimationFrame handler took Xms" warnings in console
- Frame rate drops from 60fps to 30fps or lower after view toggle
- CPU usage increases with each view switch
- Both views rendering in background (check Chrome DevTools Rendering panel)
- Battery drain on laptops during idle

**Prevention:**
- Maintain single source of truth for active animation loop: `activeAnimationFrameId`
- Cancel previous loop before starting new one: `if (activeAnimationFrameId) cancelAnimationFrame(activeAnimationFrameId)`
- Pause inactive view's render loop: `if (currentView !== 'graph') return;` at top of animation function
- Use conditional animation: only request next frame if view is active
- Consider shared render loop with view-specific branches instead of separate loops
- Track animation frame IDs in view objects: `graphView.animationFrameId` for targeted cleanup
- Test: switch views rapidly, check DevTools Performance profiler for multiple concurrent loops

**Phase to Address:** Phase 1 (Architecture Foundation) - establish animation contract before diagram animations added

**Confidence:** HIGH - requestAnimationFrame collision GitHub issues and performance documentation

### 5. Layout Thrashing During View Resize/Switch

**Risk:** Switching from Graph to Diagram view may change container dimensions. If both views read layout properties (`offsetWidth`) and write styles in rapid succession without batching, browser forces synchronous reflows (layout thrashing). With existing minimap, breadcrumb, activity feed, and tree panels, adding diagram compounds this.

**Warning Signs:**
- Visible stuttering/jank during view switch animation
- DevTools Performance panel shows "Forced reflow" warnings in purple
- Layout shift (CLS) metrics spike during toggle
- Diagram appears at wrong size for 1-2 frames then corrects
- Resize events firing excessively (10+ times for single window resize)

**Prevention:**
- Batch all reads then all writes: read dimensions first, then apply styles
- Use ResizeObserver instead of polling for dimension changes
- Debounce resize handlers: 100-150ms delay to avoid excessive recalculations
- Cache layout dimensions: `const width = container.offsetWidth;` read once per frame
- Apply CSS transitions for smooth view switching instead of JS animations
- Use `transform` and `opacity` for animations (GPU-accelerated) instead of layout properties
- Trigger diagram layout calculation only after view is visible: `requestAnimationFrame(() => diagram.resize())`
- Test: DevTools Performance recording during view switch, verify no forced reflows

**Phase to Address:** Phase 2 (View Switching) - implement during toggle mechanism

**Confidence:** MEDIUM - CSS layout shift documentation and viewport resize behavior research

### 6. Keyboard Shortcut Conflicts Between Views

**Risk:** Graph view has 94+ event listeners including bookmarks (keys 1-9), navigation (arrow keys, space), search (Ctrl/Cmd+F), and zoom controls. Diagram view will need its own shortcuts (expand/collapse, pan, zoom). If both register handlers, they conflict or fire in wrong view.

**Warning Signs:**
- Pressing "1" bookmarks both graph node AND diagram phase
- Search shortcut (Cmd+F) opens two search panels
- Arrow keys pan both graph and diagram simultaneously
- Escape key closes inspector but also deselects diagram node
- Keyboard focus unclear (user doesn't know which view receives input)

**Prevention:**
- Centralized keyboard manager with view-aware routing: `KeyboardManager.registerShortcut('1', () => activeView.handleBookmark(1))`
- Unregister previous view's handlers on switch: `oldView.unregisterShortcuts(); newView.registerShortcuts()`
- Add visual keyboard focus indicator on active view container
- Prevent event propagation after handling: `event.stopPropagation()` and `event.preventDefault()`
- Use view-scoped key maps: `graphKeyMap = {...}; diagramKeyMap = {...}` with single dispatcher
- Document overlapping shortcuts and resolve conflicts (e.g., graph uses 1-9, diagram uses Shift+1-9)
- Test: switch views and try all keyboard shortcuts, verify only active view responds

**Phase to Address:** Phase 3 (Keyboard Integration) - after both view basics work, before keyboard shortcuts proliferate

**Confidence:** MEDIUM - React keyboard event handler conflict documentation and SPA keyboard management articles

### 7. Shared Inspector Modal State Leaking Between Views

**Risk:** Inspector modal currently shows file details when double-clicking graph nodes. If diagram view also opens inspector on artifact clicks, the modal state (selected file, diff mode, scroll position, search query) can leak between views. Clicking graph node, opening inspector, switching to diagram, clicking artifact may show previous graph file or corrupt state.

**Warning Signs:**
- Inspector shows wrong file after view switch
- Diff toggle stuck in wrong mode
- Search query from graph view persists in diagram context
- Scroll position jumps to middle of file instead of top
- Related files section shows graph neighbors instead of diagram relationships

**Prevention:**
- Reset inspector state on view switch: `inspector.reset()` before switching views
- Pass complete context when opening inspector: `openInspector({ file, view: 'diagram', relatedContext: [...] })`
- Use view-scoped inspector configurations: `inspectorConfig[currentView]` to store per-view settings
- Clear search and scroll state explicitly: `inspector.searchQuery = ''; inspector.scrollTop = 0;`
- Add view indicator in inspector header so user knows source context
- Store inspector open state per-view: `graphInspectorState` and `diagramInspectorState` for restoration
- Test: open inspector in graph, switch to diagram, open different file, verify no cross-contamination

**Phase to Address:** Phase 4 (Inspector Integration) - when connecting diagram artifacts to inspector

**Confidence:** MEDIUM - View UI component state persistence documentation and modal state management articles

### 8. Diagram Library Integration: SVG vs Canvas Performance Collision

**Risk:** Graph view uses WebGL (Three.js/3d-force-graph) rendering to Canvas. Most diagram libraries use SVG (D3, Mermaid, Cytoscape) or separate Canvas. Running both on same page creates: (1) performance degradation (SVG DOM manipulation + Canvas pixel pushing), (2) z-index layering conflicts, (3) different coordinate systems for click detection.

**Warning Signs:**
- Frame rate drops when both views rendered (even if one hidden with `display: none`)
- Diagram slower to render than expected (3-5 second layout calculation)
- Click detection misses nodes (coordinates off by offset)
- SVG elements visible over graph view or vice versa
- Memory usage higher than sum of individual view sizes

**Prevention:**
- Hide inactive view with `display: none` or `visibility: hidden` to stop rendering
- Choose Canvas-based diagram library if possible (better performance pairing with Three.js)
- If using SVG: render only when view is active, destroy DOM elements when switching
- Isolate rendering contexts: dedicated container elements with no shared state
- Use separate coordinate systems: normalize click coordinates per-view
- Consider view-specific rendering optimizations: Canvas for 3D, SVG for 2D
- Benchmark both approaches: SVG vs Canvas for diagram to match existing graph performance
- Test: DevTools Performance profiler with both views existing (hidden) vs only active view mounted

**Phase to Address:** Phase 1 (Architecture Foundation) - choose diagram library with performance in mind

**Confidence:** HIGH - SVG vs Canvas performance comparisons and multi-rendering context documentation (2025-2026)

### 9. State Synchronization: Selection Across Views

**Risk:** User selects node in graph view, switches to diagram, expects corresponding artifact highlighted. Mapping between graph nodes (files, phases, plans) and diagram elements (pipeline stages, artifact blocks) is many-to-many. Naive sync causes: (1) selecting wrong element, (2) no selection in new view, (3) bidirectional update loops.

**Warning Signs:**
- Selecting graph node, switching to diagram shows no selection
- Selecting diagram artifact, switching to graph highlights multiple unrelated nodes
- Selection flickers or toggles rapidly (update loop)
- Console errors about missing node IDs
- Activity feed selection doesn't sync to either view

**Prevention:**
- Create explicit mapping layer: `selectionMapper.graphToDiagram(nodeId)` and reverse
- Handle unmappable selections gracefully: clear selection if no equivalent exists
- Add selection change timestamps to prevent loops: `if (timestamp > lastSyncTimestamp) sync()`
- Use event-based architecture: `emit('selectionChanged', { view, id })` with single handler
- Store canonical selection: `selectedEntity = { type, id, sourceView }` independent of view
- Implement "soft sync": highlight related elements without forcing exact match
- Test: select various node types, switch views, verify sensible highlighting behavior

**Phase to Address:** Phase 5 (Selection Sync) - after both views have stable selection mechanisms

**Confidence:** MEDIUM - State synchronization trap documentation and multi-view state management articles

### 10. Real-Time Updates: Diagram Layout Recalculation Cost

**Risk:** Graph view uses incremental updates (node property changes only, no full rebuild). Diagram view may require full layout recalculation when artifact status changes (flowchart positions shift to accommodate new elements). If file watcher triggers frequent updates, continuous layout thrashing freezes UI.

**Warning Signs:**
- Diagram view freezes for 2-3 seconds after file change
- Rapid file changes cause diagram to lag behind graph updates
- Layout "bounces" or repositions multiple times for single change
- CPU spikes visible in Activity Monitor during file operations
- User sees intermediate layout states (visual flicker)

**Prevention:**
- Implement incremental diagram updates where possible: change artifact color without relayout
- Debounce layout recalculations: batch multiple file changes into single layout update
- Use dirty flags: mark layout as needing update, recalculate on next render frame
- Add loading state: show spinner during layout calculation instead of frozen UI
- Consider stable layout algorithm: fixed positions for pipeline stages, only artifacts move
- Cache layout results: if structure unchanged, preserve positions
- Show animations during layout transitions to communicate progress
- Test: create/modify/delete 10 files rapidly, measure diagram responsiveness

**Phase to Address:** Phase 6 (Real-Time Sync) - when connecting file watcher to diagram layout

**Confidence:** MEDIUM - Flowchart layout algorithm performance and file watcher synchronization research

## Integration-Specific Concerns

### Existing Codebase Complexity

The current `renderer.js` is 7600+ lines with tightly coupled components (graph, tree, activity feed, minimap, inspector, bookmarks, breadcrumbs). Adding diagram view without refactoring creates:

1. **Monolithic file growth**: Risk of 10,000+ line renderer.js becoming unmaintainable
2. **Implicit dependencies**: Diagram code may accidentally depend on graph-specific state
3. **Testing difficulty**: No unit testing possible without extracting modules

**Mitigation:**
- Refactor into modules FIRST: `GraphView.js`, `DiagramView.js`, `ViewSwitcher.js`, `SharedState.js`
- Establish clear interfaces: `View` class with `mount()`, `unmount()`, `update()`, `getSelection()` methods
- Extract shared utilities: file watcher handler, inspector state, selection manager
- Add integration tests for view switching before building diagram

### File Watcher Fan-Out

Current watcher sends events to: graph updater, activity feed, flash animator, heat map, git status checker. Adding diagram creates 6th consumer. Risk: event processing time multiplies, watcher buffer overflows.

**Mitigation:**
- Create event bus architecture: watcher publishes to bus, consumers subscribe
- Add backpressure handling: if processing queue > 50 events, pause watcher
- Prioritize updates: graph/diagram before heat map/git status
- Consider view-specific watchers: diagram only watches `.planning/`, graph watches both

### Animation System Collision

Graph has 4 animation systems: (1) force simulation, (2) flash effects, (3) activity trails, (4) camera movement. Diagram will add: (5) layout transitions, (6) expand/collapse animations. Risk: 6 concurrent animation loops.

**Mitigation:**
- Unified animation scheduler: single `requestAnimationFrame` with per-system tick callbacks
- Disable inactive view animations: graph trails pause when diagram active
- Share animation utilities: flash effect function reused for both views
- Budget frame time: allocate 16ms budget across active animations, skip if exceeded

### Dual Rendering Contexts: Three.js + Diagram Library

**Problem:** Three.js creates WebGL context for graph. Diagram library (likely SVG-based like D3/Mermaid) creates separate rendering context. Browser limits on simultaneous contexts, coordinate system conflicts.

**Specific Risks:**
- WebGL context lost when switching views (mobile browsers especially)
- SVG event handlers interfere with Three.js raycasting
- Z-index battles between Canvas and SVG overlays
- Memory duplication for shared data (both maintain node lists)

**Mitigation:**
- Use `display: none` on inactive view to release rendering resources
- Implement context restoration handlers: `canvas.addEventListener('webglcontextlost', handleContextLost)`
- Deduplicate data: single source of truth for nodes, views consume read-only
- Test on mobile browsers (Chrome Android) for WebGL context limits

## Sources

**Memory Leaks & Cleanup:**
- [Viacheslav Eremin - Memory Leaks in Electron application](https://www.vb-net.com/AngularElectron/MemoryLeaks.htm)
- [Diagnosing and Fixing Memory Leaks in Electron Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/frameworks-and-libraries/diagnosing-and-fixing-memory-leaks-in-electron-applications.html)
- [Vue.js - Avoiding Memory Leaks](https://v2.vuejs.org/v2/cookbook/avoiding-memory-leaks.html?redirect=true)
- [MaxListenersExceededWarning: Possible EventEmitter memory leak detected](https://github.com/electron/remote/issues/139)

**State Synchronization:**
- [Avoid the State Synchronization Trap](https://ondrejvelisek.github.io/avoid-state-synchronization-trap/)
- [State Management 2025: React, Server State, URL State, Dapr & Agent Sync](https://medium.com/@QuarkAndCode/state-management-2025-react-server-state-url-state-dapr-agent-sync-d8a1f6c59288)
- [Synchronizing Application State Across Browser Frames](https://engineering.squarespace.com/blog/2021/synchronizing-application-state-across-browser-frames)

**Animation Conflicts:**
- [Code refresh results in multiple requestAnimationFrame running in parallel](https://github.com/codesandbox/codesandbox-client/issues/6413)
- [Applying the cancelAnimationFrame() Method](https://reintech.io/blog/tutorial-applying-cancelanimationframe-method)
- [Window: requestAnimationFrame() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

**Keyboard Events:**
- [React Keyboard Shortcuts: Boost App Performance Using React-Keyhub](https://dev.to/xenral/react-keyboard-shortcuts-boost-app-performance-using-react-keyhub-25co)
- [Lessons about React, Keyboard Input, Forms, Event Listeners and Debugging](https://alexbostock.medium.com/lessons-about-react-keyboard-input-forms-event-listeners-and-debugging-e79016c20ef1)

**Layout & Resize:**
- [Mastering CSS - Solutions to Common Layout Shift Challenges](https://moldstud.com/articles/p-mastering-css-solutions-to-common-layout-shift-challenges-for-web-developers)
- [viewport-resize-behavior explainer](https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md)

**Stale Closures:**
- [Understanding React's useEffectEvent: A Complete Guide to Solving Stale Closures](https://peterkellner.net/2026/01/09/understanding-react-useeffectevent-vs-useeffect/)
- [Be Aware of Stale Closures when Using React Hooks](https://dmitripavlutin.com/react-hooks-stale-closures/)
- [Hooks, Dependencies and Stale Closures](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures)

**Canvas vs SVG:**
- [SVG vs Canvas vs WebGL: Choosing the Right Graphics Tech in 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [From SVG to Canvas – part 1: making Felt faster](https://felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster)
- [Performance of canvas versus SVG](https://smus.com/canvas-vs-svg-performance/)

**File Watcher Race Conditions:**
- [File watcher race condition where Modify event occurs and file contents are empty](https://github.com/denoland/deno/issues/13035)
- [Race conditions when watching the file system](https://github.com/atom/github/issues/345)
- [Query Synchronization | Watchman](https://facebook.github.io/watchman/docs/cookies)

**Modal & Component State:**
- [Opening Modals in Another Component in Angular: Complete Guide with Best Practices 2026](https://copyprogramming.com/howto/proper-way-to-call-modal-dialog-from-another-component-in-angular)
- [Fixing Persistent Component State Issues in View UI Applications](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/fixing-persistent-component-state-issues-in-view-ui-applications.html)

**Three.js Multi-View:**
- [Render multiple views - three.js forum](https://discourse.threejs.org/t/render-multiple-views/57999)
- [What is best choice for manage 2D and 3D at the same time?](https://discourse.threejs.org/t/what-is-best-choice-for-manage-2d-and-3d-at-the-same-time/85452)

**Modern JavaScript Integration:**
- [JavaScript Frameworks - Heading into 2026](https://dev.to/this-is-learning/javascript-frameworks-heading-into-2026-2hel)
- [JavaScript in 2026: What We Stopped Using](https://medium.com/front-end-weekly/javascript-in-2026-what-we-stopped-using-and-why-it-matters-da5664709c46)
