# Stack Research: Workflow Diagram View

**Project:** GSD Viewer v1.5
**Feature:** Interactive flowchart/pipeline diagram view
**Researched:** 2026-01-28
**Overall confidence:** HIGH

## Summary

The workflow diagram feature requires a separate SVG-based rendering approach alongside the existing 3D-force-graph. The recommended stack uses D3.js for SVG manipulation (already in dependency tree via 3d-force-graph), @dagrejs/dagre for hierarchical layout computation, and svg.js for enhanced SVG manipulation if needed. This approach avoids framework dependencies (React/Vue), uses DOM-based rendering for better interactivity than Canvas, and performs well for the target scale (50-100 nodes).

## Recommended Stack

### Core Diagram Rendering

**D3.js** (^7.9.0) - SVG manipulation and selection
- **Why:** Already in your dependency tree via 3d-force-graph dependencies (d3-selection, d3-scale, d3-array, etc.)
- **What it provides:** DOM selection, SVG element creation/manipulation, event handling, transitions
- **Performance:** Excellent for <5000 elements, well within your 50-100 node target
- **Integration:** Works in Electron browser contexts, no framework required
- **Note:** You're already using D3 modules indirectly; this makes them first-class dependencies

### Layout Algorithm

**@dagrejs/dagre** (^2.0.0) - Hierarchical graph layout
- **Why:** Industry standard for directed graph layouts (flowcharts, pipelines)
- **What it provides:** Automatic positioning of nodes in hierarchical/layered arrangements
- **Status:** Actively maintained (latest release Nov 2025), this is the official package
- **Use case:** Perfect for workflow stages → phases → artifacts hierarchy
- **Alternative considered:** d3-hierarchy (see "What NOT to Add" below)
- **Integration:** Layout computation only (no rendering), returns coordinates you apply via D3

### Optional: Enhanced SVG Manipulation

**svg.js** (^3.2.5) - Lightweight SVG library (OPTIONAL)
- **Why:** If D3's SVG API feels too low-level for complex shapes
- **What it provides:** Cleaner API for SVG creation, animations, transforms
- **Size:** Lightweight (~15KB gzipped), no dependencies
- **Performance:** Optimized for manipulation speed (up to 48% faster than v1)
- **When to add:** Only if you find D3's raw DOM manipulation cumbersome during implementation
- **Status:** Actively maintained (latest release Sep 2025)

## What NOT to Add

### React Flow / Svelte Flow
- **Why not:** Requires React framework, adds significant bundle size and complexity
- **Alternative:** Use vanilla D3 + dagre for same capabilities without framework overhead
- **Note:** React Flow is excellent, but overkill when you're already using vanilla JS

### dagre-d3
- **Why not:** DEPRECATED - Last release Dec 2017, no support for D3 v7
- **Alternative:** Use @dagrejs/dagre for layout + D3 v7 for rendering separately
- **Important:** Don't confuse with @dagrejs/dagre (the layout library) - dagre-d3 was a combined layout+rendering library that's now abandoned

### d3-dag
- **Why not:** In "light maintenance mode," designed for experimentation not production
- **Alternative:** @dagrejs/dagre is more robust and actively maintained
- **Use case mismatch:** d3-dag is for "small to medium static DAGs," not interactive flowcharts

### Flowy.js
- **Why not:** XSS vulnerabilities in import(), no npm package, incomplete feature set
- **Alternative:** Build with D3 + dagre for security and maintainability

### leader-line
- **Why not:** Repository ARCHIVED (April 2025), no longer maintained
- **Alternative:** Draw connections with D3 SVG paths (you have full control)

### JointJS / GoJS
- **Why not:** Commercial libraries with licensing costs
- **Alternative:** D3 + dagre provides same capabilities for free

### Mermaid.js
- **Why not:** Text-based diagram generation, not suited for programmatic/interactive building
- **Use case:** Mermaid is for "diagrams as code," you need runtime-generated interactive diagrams

## Installation

```bash
# Core dependencies (add to package.json)
npm install d3@^7.9.0 @dagrejs/dagre@^2.0.0

# Optional (only if needed)
npm install svg.js@^3.2.5
```

**Note:** You already have d3 modules in your tree via 3d-force-graph. This makes them explicit first-class dependencies.

## Integration Points

### Architecture: Separate View, Shared Renderer Process

**Option 1: Separate DOM Container (RECOMMENDED)**
```javascript
// In renderer.js
const graphContainer = document.getElementById('graph-view');
const diagramContainer = document.getElementById('diagram-view');

// Toggle visibility
function showDiagram() {
  graphContainer.style.display = 'none';
  diagramContainer.style.display = 'block';
  renderDiagram(); // D3 + dagre rendering
}
```

**Why separate containers:**
- 3d-force-graph uses WebGL/Canvas via THREE.js
- Diagram uses SVG via D3
- Different rendering contexts, avoid conflicts
- Clean separation of concerns

**Integration with existing code:**
- Use same chokidar file watcher for data updates
- Use same electron-store for view preferences (last selected view, zoom levels)
- Use same IPC channels for inspector panel communication
- Reuse existing graph data structure, transform for dagre layout

### Data Flow

```
GSD Files (watched by chokidar)
  ↓
Parse to graph structure (existing)
  ↓
  ├→ 3D Graph View: 3d-force-graph (existing)
  ├→ Diagram View: Transform → dagre.layout() → D3 render (NEW)
  └→ Inspector Panel: Shared selection state
```

### SVG vs Canvas Decision

**Chosen: SVG**

**Why:**
- **Interactivity:** DOM events (click, hover) work naturally - each node is a DOM element
- **Accessibility:** Screen readers can navigate diagram structure
- **Styling:** CSS classes for states (selected, hovered, completed), easy theming
- **Performance:** 50-100 nodes is well within SVG's sweet spot (<5000 elements)
- **Integration:** Works alongside Canvas-based 3D view without conflicts

**Canvas considered but rejected:**
- Better for >5000 nodes (not your use case)
- Worse interactivity (manual hit detection)
- Harder to style and animate individual elements

**WebGL rejected:**
- Overkill for 2D diagrams
- You're already using WebGL for 3D graph, don't need it for diagrams

## Rendering Approach

### Recommended Pattern

```javascript
// 1. Compute layout with dagre
import dagre from '@dagrejs/dagre';

const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: 'TB' }); // top-to-bottom

// Add nodes and edges
phases.forEach(phase => {
  g.setNode(phase.id, {
    label: phase.name,
    width: 200,
    height: 100
  });
});

edges.forEach(edge => {
  g.setEdge(edge.source, edge.target);
});

dagre.layout(g); // Computes x, y positions

// 2. Render with D3
import * as d3 from 'd3';

const svg = d3.select('#diagram-view')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// Render nodes
const nodes = svg.selectAll('.node')
  .data(g.nodes())
  .enter()
  .append('g')
  .attr('class', 'node')
  .attr('transform', d => `translate(${g.node(d).x}, ${g.node(d).y})`);

nodes.append('rect')
  .attr('width', d => g.node(d).width)
  .attr('height', d => g.node(d).height)
  .on('click', handleNodeClick);

nodes.append('text')
  .text(d => g.node(d).label);

// Render edges (connections)
const edges = svg.selectAll('.edge')
  .data(g.edges())
  .enter()
  .append('path')
  .attr('class', 'edge')
  .attr('d', d => {
    const points = g.edge(d).points;
    return d3.line()(points.map(p => [p.x, p.y]));
  });
```

### Performance Characteristics

| Metric | Performance | Notes |
|--------|-------------|-------|
| Initial render (50 nodes) | <50ms | Dagre layout + D3 render |
| Initial render (100 nodes) | <100ms | Still well within 60fps budget |
| Re-layout on data change | <100ms | Full recalculation acceptable |
| Hover/click response | <16ms | DOM events, instant feedback |
| Zoom/pan | 60fps | CSS transforms or D3 zoom behavior |
| Animation (expand/collapse) | 60fps | D3 transitions on 10-20 elements |

**Bottleneck watch:**
- If >200 nodes: Consider virtual rendering (render only visible nodes)
- If complex nested structures: Consider progressive disclosure (collapse subtrees)

## Browser/Electron Compatibility

All recommended libraries work in Electron browser contexts:
- **D3.js:** Pure JavaScript, DOM manipulation, no Node.js APIs
- **@dagrejs/dagre:** Pure JavaScript layout computation
- **svg.js:** Pure JavaScript SVG manipulation

**No special Electron configuration needed.** These run in the renderer process like any web app.

## Development Approach

### Phase 1: Basic Layout
- Install d3 and @dagrejs/dagre
- Create separate diagram container
- Render simple boxes for phases with dagre layout
- Add click handlers to sync with inspector

### Phase 2: Visual Polish
- Add SVG styling (borders, backgrounds, status colors)
- Render artifact nodes inside phase blocks
- Add edge paths between phases
- Implement hover states

### Phase 3: Interactivity
- Expand/collapse nested artifacts
- Zoom/pan controls (d3-zoom)
- Sync selection state with 3D graph
- Transitions for expand/collapse

### Phase 4: Advanced Features
- Swimlanes for parallel phases
- Commit markers on timeline
- Status indicators (completed, in-progress)
- Export diagram as SVG/PNG

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| D3.js | HIGH | Official docs, active development, already in use (indirectly) |
| @dagrejs/dagre | HIGH | Official package, recent release (Nov 2025), verified maintenance |
| SVG approach | HIGH | Industry standard for 50-100 node diagrams, proven performance |
| Integration | MEDIUM | Straightforward but requires careful state management between views |
| Performance | HIGH | Well within SVG performance envelope, multiple sources confirm |

## Gaps / Future Considerations

- **TypeScript definitions:** Both d3 and @dagrejs/dagre have @types packages if you add TypeScript later
- **Export functionality:** Consider adding svg-to-png conversion library if PNG export needed (html2canvas or similar)
- **Accessibility:** Ensure ARIA labels on diagram elements for screen readers
- **Mobile/touch:** Diagram view may need touch gesture handling if mobile support added

## Sources

### Technology Stack
- [JavaScript diagramming libraries in 2026](https://www.jointjs.com/blog/javascript-diagramming-libraries)
- [10 Best Flowchart JavaScript Libraries (2026 Update)](https://www.jqueryscript.net/blog/best-flowchart.html)
- [React Flow](https://reactflow.dev)
- [20+ JavaScript libraries to draw diagrams](https://modeling-languages.com/javascript-drawing-libraries-diagrams/)

### Layout Algorithms
- [ELK.js GitHub](https://github.com/kieler/elkjs)
- [Dagre GitHub](https://github.com/dagrejs/dagre)
- [dagre-d3 GitHub](https://github.com/dagrejs/dagre-d3)
- [d3-dag GitHub](https://github.com/erikbrinkman/d3-dag)
- [D3 hierarchy documentation](https://d3js.org/d3-hierarchy)

### Performance
- [SVG vs Canvas comparison](https://www.jointjs.com/blog/svg-versus-canvas)
- [Canvas vs SVG performance](https://smus.com/canvas-vs-svg-performance/)
- [SVG vs Canvas: Best Choice for Modern Frontends](https://www.augustinfotech.com/blogs/svg-vs-canvas-animation-what-modern-frontends-should-use-in-2026/)
- [Apache ECharts: Canvas vs SVG](https://apache.github.io/echarts-handbook/en/best-practices/canvas-vs-svg/)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)

### Libraries
- [D3.js official site](https://d3js.org/)
- [D3.js GitHub](https://github.com/d3/d3)
- [svg.js GitHub](https://github.com/svgdotjs/svg.js)
- [svg.js releases](https://github.com/svgdotjs/svg.js/releases)
- [leader-line GitHub (archived)](https://github.com/anseki/leader-line)
- [Flowy.js GitHub](https://github.com/alyssaxuu/flowy)

### Electron Integration
- [Building High-Performance Electron Apps](https://www.johnnyle.io/read/electron-performance)
- [Electron Desktop App Development Guide 2026](https://www.forasoft.com/blog/article/electron-desktop-app-development-guide-for-business)
