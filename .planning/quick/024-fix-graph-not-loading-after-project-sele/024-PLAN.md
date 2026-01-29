---
phase: quick
plan: 024
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/graph-renderer.js
autonomous: true

must_haves:
  truths:
    - "3D graph renders nodes after project selection"
    - "Graph visible both on initial load and after view switches"
  artifacts:
    - path: "src/renderer/graph-renderer.js"
      provides: "ForceGraph3D canvas rendering fix"
  key_links:
    - from: "mount()"
      to: "ForceGraph3D renderer"
      via: "refresh/scene invalidation"
---

<objective>
Fix ForceGraph3D canvas not rendering after project selection.

Purpose: Graph data loads correctly (minimap shows it) but the main 3D canvas stays blank. This is a WebGL/Three.js rendering issue where the canvas needs explicit scene refresh after resize or visibility change.
Output: Working 3D graph that renders immediately after project selection.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/debug/graph-not-loading.md
@src/renderer/graph-renderer.js (lines 2715-2722: Graph initialization, lines 2997-3022: handleResize, lines 3199-3235: updateGraph, lines 7794-7833: mount)
@src/renderer/view-controller.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose and fix ForceGraph3D canvas rendering</name>
  <files>src/renderer/graph-renderer.js</files>
  <action>
The issue: ForceGraph3D initializes at module load when graph-container may be hidden (has 'hidden' class). The Three.js WebGLRenderer creates a canvas with the initial container dimensions. When container later becomes visible, handleResize() updates Graph.width()/height() but the WebGL canvas may not re-render.

Investigation and fix approach:

1. First, check if ForceGraph3D has a refresh/render method. Common patterns:
   - `Graph.refresh()` - explicit refresh
   - `Graph.renderer().render(Graph.scene(), Graph.camera())` - manual render
   - `Graph.scene()` access for invalidation

2. In handleResize(), after setting dimensions, force a render refresh:
   ```javascript
   // Force WebGL render after resize
   if (Graph.renderer && Graph.scene && Graph.camera) {
     Graph.renderer().render(Graph.scene(), Graph.camera());
   }
   ```

3. In mount(), after handleResize(), also force refresh and potentially call zoomToFit:
   ```javascript
   handleResize();

   // Force scene refresh after container becomes visible
   if (Graph && state.currentGraphData.nodes.length > 0) {
     // Re-apply graph data to force re-render
     Graph.graphData(state.currentGraphData);
     setTimeout(() => Graph.zoomToFit(400), 100);
   }
   ```

4. Key insight: If Graph was initialized with 0x0 dimensions, just calling Graph.width()/height() may not recreate the WebGL context. The fix is to either:
   - Re-apply graphData to trigger internal re-render
   - Access renderer directly and call render()
   - Call Graph.refresh() if available

5. Remove debug console.log statements after fix is verified working.

Important: Check force-graph documentation or source for available refresh methods. The library exposes renderer(), scene(), camera() getters.
  </action>
  <verify>
1. npm start
2. Click "Select Project" and choose a folder with .planning/
3. 3D graph should render with nodes visible (not blank)
4. Minimap should also show data (confirms data loaded)
5. Switch to another tab (Dashboard) then back to Graph - graph should still render
  </verify>
  <done>
- ForceGraph3D canvas renders nodes after project selection
- Graph visible on initial load and after view switches
- Debug logging removed (clean console output)
  </done>
</task>

</tasks>

<verification>
- Project selection shows 3D graph immediately
- View switching preserves and re-renders graph correctly
- No JavaScript errors in console
- Minimap continues to work
</verification>

<success_criteria>
1. Select a project folder -> 3D graph renders with nodes visible
2. Switch views (Graph -> Dashboard -> Graph) -> graph re-renders correctly
3. No blank canvas after any operation
</success_criteria>

<output>
After completion, create `.planning/quick/024-fix-graph-not-loading-after-project-sele/024-SUMMARY.md`
</output>
