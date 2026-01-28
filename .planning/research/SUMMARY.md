# Project Research Summary

**Project:** GSD Viewer v1.5 - Workflow Diagram View
**Domain:** Developer tools visualization (Electron desktop app extension)
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

The v1.5 Workflow Diagram feature adds a second visualization mode to GSD Viewer, providing a stage-oriented view of the GSD workflow (Initialize → Discuss → Plan → Execute → Verify → Complete) alongside the existing 3D graph. Research across stack, features, architecture, and pitfalls dimensions reveals that this is primarily an **integration challenge** rather than a greenfield feature. The existing 7600-line renderer.js requires careful extraction of shared state before adding diagram capabilities to avoid memory leaks, stale closures, and race conditions.

The recommended approach uses **D3.js for SVG rendering** with **@dagrejs/dagre for layout computation**. Both libraries are lightweight, actively maintained, and well-suited for the target scale (50-100 nodes). The diagram will use a **separate DOM container with CSS-based view switching** (hide/show) to preserve state between toggles. Critical architecture decision: **extract state-manager.js first** to centralize selection, project data, and activity feed before building diagram-renderer.js, preventing the stale closure and synchronization pitfalls documented in research.

Key risks center on **multi-view state synchronization** (selection, file updates, animations) and **rendering context conflicts** (Three.js WebGL + SVG). Prevention strategies include explicit lifecycle methods (mount/unmount), centralized keyboard shortcuts with view-aware routing, and atomic file watcher updates with view routing. The most critical pitfall—memory leaks from incomplete cleanup—must be addressed in Phase 1 before diagram features are built.

## Key Findings

### Recommended Stack

The workflow diagram feature integrates into the existing Electron renderer process using SVG-based rendering separate from the 3D graph's Canvas/WebGL approach. Research strongly recommends avoiding deprecated or unmaintained libraries (dagre-d3, d3-dag, leader-line) and framework-heavy solutions (React Flow, JointJS) in favor of lightweight, actively maintained tools.

**Core technologies:**
- **D3.js (^7.9.0)**: SVG manipulation and DOM selection — already in dependency tree via 3d-force-graph, provides excellent interactivity for <5000 elements (well within 50-100 node target)
- **@dagrejs/dagre (^2.0.0)**: Hierarchical graph layout computation — industry standard for directed graphs, actively maintained (Nov 2025 release), perfect for workflow stage hierarchy
- **svg.js (^3.2.5) OPTIONAL**: Enhanced SVG API if D3 feels too low-level — lightweight (15KB gzipped), only add if needed during implementation

**What NOT to add:**
- React Flow (requires framework, adds bundle size)
- dagre-d3 (deprecated since 2017)
- d3-dag (light maintenance mode)
- Flowy.js (XSS vulnerabilities, no npm package)
- leader-line (archived April 2025)
- Mermaid.js (text-based generation, not interactive)

**SVG vs Canvas decision:** SVG chosen for diagram because it provides native DOM events for interactivity, CSS styling for states, and accessibility for screen readers. Performance is excellent for <5000 elements. Canvas rejected because it requires manual hit detection and is harder to style. This creates a hybrid architecture: Canvas (3D graph) + SVG (2D diagram) in separate containers.

### Expected Features

Research identified clear patterns from CI/CD pipeline visualizations (GitHub Actions, GitLab CI), kanban boards, and swimlane diagrams. Feature set divided into table stakes, differentiators, and anti-features.

**Must have (table stakes):**
- Left-to-right pipeline flow with stage containers (Initialize → Complete)
- Color-coded status indicators per stage (green/yellow/gray)
- Artifact blocks nested within stages
- Connection lines showing sequential flow
- Click to select artifact (opens inspector, syncs with graph)
- Hover tooltips with metadata
- Expand/collapse stage detail (progressive disclosure)
- Current stage highlighting based on STATE.md
- Scroll/pan support for horizontal layout
- Live file updates via existing watcher

**Should have (differentiators):**
- Two-way sync with 3D graph (click in diagram → fly to node in graph)
- "Why it works" visual indicators (context usage, parallel lanes, commit markers)
- Context window usage bars per stage
- Parallel agent swimlanes showing concurrent work
- Atomic commit markers in Execute stage
- Timeline replay updates diagram state
- Phase bookmarks (reuse existing 1-9 shortcuts)
- Diagram export (SVG/PNG)

**Defer (v2+):**
- Timeline replay in diagram view (complex historical state)
- Parallel agent swimlanes (requires multi-agent execution detection)
- Progress rings per stage (polish feature)
- Minimap adaptation (existing minimap works for graph)

**Anti-features (deliberately NOT build):**
- Editable diagram (GSD workflow is fixed, not user-customizable)
- Freeform flowchart editor (adds complexity without value)
- Vertical swimlanes per file (too many lanes = visual noise)
- Animation-heavy transitions (distracts from information)
- Everything expanded by default (overwhelming)
- Detailed content preview inline (use inspector modal)
- Zoom in/out (scroll/pan sufficient for 2D)

### Architecture Approach

The diagram integrates as a **parallel rendering mode** using CSS-based view switching to preserve state and avoid re-initialization overhead. A new diagram-renderer.js handles SVG rendering while reusing existing parsers and graph-builder data through a new workflow-layout.js transform layer.

**Major components:**

1. **state-manager.js (NEW)** — Centralized state using Proxy pattern for reactivity; manages currentGraphData, selectedNode, activityEntries, bookmarks; replaces global state scattered in renderer.js
2. **graph-renderer.js (REFACTOR from renderer.js)** — Extract 3D-specific logic, import state from state-manager, export public API (selectNode, focusCamera); keep existing graph/physics/camera code
3. **view-controller.js (NEW)** — Handle view switching with CSS hide/show, sync current selection to newly visible view, coordinate keyboard shortcuts per view
4. **workflow-layout.js (NEW)** — Transform graph-builder output to workflow stage structure (stages → phases → artifacts), extract ROADMAP phase order, add horizontal positioning
5. **diagram-renderer.js (NEW)** — SVG workflow rendering using D3 + dagre, nested phase cards with artifact lists, click handlers route through state-manager, subscribe to activity updates

**Integration strategy:**
- Phase 1: Extract shared state (decouple before adding complexity)
- Phase 2: Add view switching UI (tab controls, CSS containers)
- Phase 3: Build workflow layout transform (data layer before rendering)
- Phase 4: Implement SVG diagram renderer (visual implementation)
- Phase 5: Wire state synchronization (selection, file updates)
- Phase 6: Add diagram-specific features (collapse, export)

**Data flow:**
```
PROJECT LOAD: main.js → parsers → graph-builder → state-manager → [graph-renderer | diagram-renderer]
FILE CHANGE: main.js watcher → state-manager (update + flash) → both renderers
USER SELECTION: either renderer → state-manager → view-controller → sync both views
```

**Architecture decisions:**
- Separate DOM containers (graph uses Canvas/WebGL, diagram uses SVG)
- Hide/show with display:none (preserves state, faster than destroy/recreate)
- Shared state via Proxy pattern (2026 best practice for Vanilla JS)
- View-specific animation loops with cancel on switch
- Atomic file watcher updates with view routing to prevent race conditions

### Critical Pitfalls

Research identified 10 pitfalls specific to adding multi-view rendering to complex Electron apps. Top 5 critical risks:

1. **Memory leaks from incomplete view cleanup** — With 94+ event listeners and continuous animation frames in graph view, switching without explicit mount/unmount lifecycle causes memory accumulation. Prevention: track listeners in arrays, cancel animation frames, dispose Three.js objects, test 20+ view switches in DevTools Memory panel. **Address in Phase 1.**

2. **Stale closures in event handlers** — Keyboard shortcuts, file watcher callbacks, and IPC handlers capture view state at registration time. After view switch, handlers reference outdated state. Prevention: use function references with current state lookup `() => getCurrentView().selectedNode`, re-register callbacks on switch, pass state as parameters. **Address in Phase 1.**

3. **Race conditions in file watcher updates** — File watcher emits on separate threads; simultaneous updates to graph and diagram cause partial updates, render conflicts, animation collisions. Prevention: centralize file change handling with view routing, debounce 50-100ms, use update queue with atomic processing. **Address in Phase 2.**

4. **Uncanceled animation frames from both views** — Graph runs continuous requestAnimationFrame loop. If diagram adds animations and both run simultaneously, they compete for frame budget and accumulate on hot-reload. Prevention: maintain single activeAnimationFrameId, cancel previous loop before starting new one, pause inactive view's render loop. **Address in Phase 1.**

5. **Layout thrashing during view resize/switch** — Switching views changes container dimensions. If both views read/write layout properties in rapid succession, browser forces synchronous reflows. Prevention: batch reads then writes, use ResizeObserver, debounce resize handlers 100-150ms, use transform/opacity for GPU-accelerated animations. **Address in Phase 2.**

Additional concerns: keyboard shortcut conflicts (centralized manager needed), shared inspector modal state leaking between views (reset on switch), Canvas/SVG performance collision (hide inactive view), selection mapping complexity (many-to-many), diagram layout recalculation cost (debounce, use dirty flags).

## Implications for Roadmap

Based on research, the feature requires **architectural foundation before visual implementation**. Dependencies dictate a 6-phase approach with state management and cleanup patterns established first to avoid pitfalls. Total estimated time: 8-12 days.

### Phase 1: Architecture Foundation (1-2 days)
**Rationale:** Establishes clean separation and lifecycle patterns before adding diagram complexity. Prevents memory leaks, stale closures, and animation conflicts identified as critical pitfalls.

**Delivers:** state-manager.js with centralized state, renderer.js refactored to graph-renderer.js with state imports, explicit lifecycle methods (mount/unmount), animation frame cleanup patterns.

**Addresses:** Pitfalls 1, 2, 4 (memory leaks, stale closures, animation conflicts)

**Avoids:** Building diagram on top of tightly-coupled monolithic renderer.js

**Success criteria:** Graph view works identically after refactor, state centralized, lifecycle methods tested

### Phase 2: View Switching UI (1 day)
**Rationale:** UI framework for both views before building diagram. Implements CSS-based hide/show strategy to preserve state between toggles.

**Delivers:** Tab controls in index.html, view-controller.js with CSS switching, keyboard shortcut routing per view, centralized file watcher handler with view routing.

**Uses:** D3.js (already installed), CSS transitions

**Addresses:** Pitfalls 3, 5 (race conditions, layout thrashing)

**Success criteria:** Can toggle between views (diagram empty but container exists), no layout stuttering, keyboard shortcuts route correctly

### Phase 3: Workflow Layout Transform (1-2 days)
**Rationale:** Data layer before rendering. Transforms graph-builder output into workflow stage structure needed for diagram.

**Delivers:** workflow-layout.js transform, unit tests with real GSDv project data, integration into project load flow.

**Implements:** Workflow stage mapping (Initialize → Discuss → Plan → Execute → Verify → Complete), phase/artifact nesting

**Success criteria:** Console log shows correct workflow structure from graph data

### Phase 4: Basic Diagram Rendering (2-3 days)
**Rationale:** Core visual implementation using recommended stack (D3 + dagre + SVG).

**Delivers:** diagram-renderer.js with SVG rendering, dagre layout computation, horizontal swim lanes for stages, nested phase cards with artifact lists, basic status colors.

**Uses:** D3.js ^7.9.0, @dagrejs/dagre ^2.0.0

**Implements:** Table stakes features (stage containers, artifact blocks, connection lines, status indicators)

**Success criteria:** Diagram view shows workflow stages and phases visually, layout responds to window resize

### Phase 5: Interaction Sync (1-2 days)
**Rationale:** Wire state between views to enable two-way selection sync and file updates.

**Delivers:** Click handlers in diagram-renderer routing through state-manager, selection sync between views, hover tooltips, inspector modal integration, activity feed updates to both views.

**Implements:** Two-way sync pattern (click diagram → highlight graph, vice versa)

**Addresses:** Pitfall 7, 9 (inspector state leaking, selection sync complexity)

**Success criteria:** Selection persists across view switches, inspector opens correct file from both views

### Phase 6: Real-Time Updates (1 day)
**Rationale:** Leverage existing file watcher infrastructure to update diagram on file changes.

**Delivers:** Diagram subscribes to activity updates, card highlight animation on file change, debounced layout recalculation for structure changes.

**Implements:** Live file updates (table stakes feature)

**Addresses:** Pitfall 10 (layout recalculation cost)

**Success criteria:** File changes flash in both views, rapid changes don't freeze diagram

### Phase 7: Diagram-Specific Features (1-2 days)
**Rationale:** Quality-of-life features after core works. Adds differentiators from feature research.

**Delivers:** Expand/collapse phase cards, current stage highlighting, responsive layout polish, diagram-specific styling, optional SVG export.

**Implements:** Progressive disclosure (expand/collapse), should-have differentiators

**Success criteria:** Diagram view feels polished, expand/collapse smooth, export works

### Phase Ordering Rationale

- **State management first** prevents architecture debt from compounding when diagram is added
- **View switching second** establishes container structure before rendering logic
- **Data transform third** decouples diagram layout from rendering implementation
- **Rendering fourth** allows visual iteration without affecting state/sync logic
- **Interaction sync fifth** builds on stable rendering foundation
- **Real-time updates sixth** adds complexity after basic interactions work
- **Polish last** adds nice-to-haves without blocking core functionality

This ordering explicitly avoids the "build everything at once" anti-pattern that leads to debugging nightmares when state, rendering, and interactions interfere. Each phase has clear success criteria and can be tested independently.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Diagram Rendering):** Dagre layout configuration for nested hierarchy needs experimentation with real GSD project structure to determine optimal rankdir, ranksep, nodesep parameters
- **Phase 5 (Interaction Sync):** Selection mapping between graph nodes and diagram artifacts is many-to-many; may need phase-specific research to handle edge cases (selecting plan vs. task vs. file)

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Architecture Foundation):** State management with Proxy pattern is well-documented in 2026 Vanilla JS resources
- **Phase 2 (View Switching):** CSS hide/show and view controller patterns are standard SPA approaches
- **Phase 3 (Workflow Layout):** Data transformation is straightforward mapping, no special patterns needed
- **Phase 6 (Real-Time Updates):** File watcher integration already exists, extension is incremental
- **Phase 7 (Diagram-Specific Features):** Expand/collapse and export are standard SVG techniques

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | D3 and dagre have official docs, active development, verified maintenance; svg.js is optional fallback; no deprecated libraries recommended |
| Features | HIGH | Extensive research into CI/CD visualizations, workflow diagrams, and developer tool UX patterns; clear table stakes vs. differentiators |
| Architecture | HIGH | Separate rendering modes with shared state is proven pattern; hide/show vs. destroy/recreate trade-offs well-documented; hybrid Canvas+SVG approach validated |
| Pitfalls | HIGH | Multi-view state synchronization, memory leaks, and animation conflicts have extensive documentation and real-world examples; prevention strategies concrete |

**Overall confidence:** HIGH

Research covered all dimensions thoroughly with recent sources (2025-2026), official documentation, and real-world examples. The main unknowns are implementation-specific (dagre layout parameters, selection mapping edge cases) which can be resolved during execution.

### Gaps to Address

- **Dagre layout parameters:** Research provides library recommendation but not specific rankdir/ranksep/nodesep values for nested GSD workflow. Address during Phase 4 implementation with experimentation.

- **Selection mapping complexity:** Many-to-many relationship between graph nodes (files, phases, plans) and diagram elements (stages, artifacts) needs detailed mapping table. Address during Phase 5 with test cases covering all node types.

- **Performance under extreme load:** Research assumes 50-100 nodes (typical GSD project). If project has 500+ files/phases, SVG may need virtual rendering. Address during Phase 6 with large project testing.

- **Mobile/touch support:** Research focused on desktop Electron app. If mobile browser access added later, diagram needs touch gesture handlers. Defer to post-v1.5.

- **Accessibility:** SVG provides natural DOM structure for screen readers, but research didn't verify ARIA label best practices for workflow diagrams. Address during Phase 7 with WCAG compliance check.

## Sources

### Primary (HIGH confidence)
- Official D3.js documentation (d3js.org) — SVG manipulation, transitions, selections
- Dagre GitHub repository (github.com/dagrejs/dagre) — Layout algorithms, API, recent releases
- Electron performance guide (electronjs.org/docs/latest/tutorial/performance) — Renderer process optimization, memory management
- Three.js forum discussions (discourse.threejs.org) — Multi-view rendering, WebGL context management
- MDN Web Docs (developer.mozilla.org) — requestAnimationFrame, ResizeObserver, Proxy pattern
- React documentation on stale closures (react.dev) — useEffectEvent patterns applicable to vanilla JS

### Secondary (MEDIUM confidence)
- JavaScript diagramming libraries comparison (jointjs.com/blog, jqueryscript.net) — 2026 ecosystem survey, library trade-offs
- GitHub Actions workflow visualization (docs.github.com/actions) — UX patterns for pipeline visualizations
- GitLab CI pipeline editor (docs.gitlab.com/ci) — Multi-level hierarchy patterns, dependency visualization
- State management in Vanilla JS (medium.com/@chirag.dave, nucamp.co) — 2026 trends, Proxy pattern adoption
- SVG vs Canvas performance (blog.logrocket.com, augustinfotech.com) — Use case comparison, hybrid approaches
- Canvas vs SVG animation benchmarks (smus.com, apache.github.io/echarts-handbook) — Performance characteristics

### Tertiary (LOW confidence, validated with multiple sources)
- Electron memory leak diagnostics (vb-net.com, mindfulchase.com) — Memory profiling techniques
- File watcher race conditions (github.com/denoland/deno/issues, github.com/atom/github/issues) — Concurrency patterns
- Keyboard shortcut conflicts (dev.to/xenral, alexbostock.medium.com) — React keyboard handling (patterns applicable to vanilla)

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
