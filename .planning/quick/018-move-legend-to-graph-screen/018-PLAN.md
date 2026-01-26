---
phase: quick
plan: 018
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/index.html
autonomous: true

must_haves:
  truths:
    - "Legend panel moves with the graph when tree panel opens/closes"
    - "Legend stays within the visible graph area at all times"
    - "Legend collapse/expand functionality continues to work"
  artifacts:
    - path: "src/renderer/index.html"
      provides: "Legend positioned relative to graph-container"
      contains: "color-legend"
  key_links:
    - from: "#color-legend positioning"
      to: "#graph-container"
      via: "CSS position inside graph-container or responsive left calculation"
      pattern: "left.*280px|position.*absolute"
---

<objective>
Move legend panel to stay ithin the graph screen area

Purpose: Currently the legend is fixed at `left: 20px` which means it overlaps the tree panel when open. The legend should move with the graph viewport so it's always visible within the graph area.

Output: Legend panel that stays anchored to the graph view area, not the browser window.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/index.html

Current state:
- Legend is `position: fixed; left: 20px; bottom: 20px`
- Graph container shifts when tree-open class added (`left: 280px`)
- Legend does NOT shift - it stays at browser's left edge
- This causes legend to overlap with (or be hidden behind) tree panel

Solution approach:
Move `#color-legend` div INSIDE `#graph-container` and change from `position: fixed` to `position: absolute` so it's relative to the graph container. The graph container already has `position: absolute` so child absolute positioning will work.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move legend inside graph-container and update CSS positioning</name>
  <files>src/renderer/index.html</files>
  <action>
    1. Move the `#color-legend` div from its current location (after #graph-container) to INSIDE #graph-container as the last child element

    2. Update the `#color-legend` CSS rules:
       - Change `position: fixed` to `position: absolute`
       - Keep `bottom: 20px; left: 20px` (now relative to graph-container)
       - Keep all other styling (background, border-radius, z-index, etc.)

    The graph-container already has `position: absolute` so child absolute positioning will anchor the legend to the graph viewport. When tree-panel opens and graph-container shifts right, the legend will shift with it.
  </action>
  <verify>
    - Run the app: `npm start`
    - Toggle tree panel open/closed
    - Verify legend moves WITH the graph (stays at bottom-left of graph area)
    - Verify legend does NOT overlap tree panel when open
    - Verify legend collapse/expand still works
  </verify>
  <done>Legend stays anchored to graph viewport and moves when tree panel toggles</done>
</task>

</tasks>

<verification>
1. Run `npm start` to launch the app
2. With tree panel CLOSED: legend should be at bottom-left of screen
3. Open tree panel (click tree icon or it opens by default): legend should shift right with the graph
4. Close tree panel: legend should shift back left with the graph
5. Click legend header to collapse: should collapse to just header
6. Click again to expand: should show full legend content
7. Open statistics panel (right side): legend should remain at bottom-left of graph area
</verification>

<success_criteria>
- Legend panel is always visible within the graph viewport
- Legend does not overlap tree panel when tree is open
- Legend collapse/expand toggle continues to function
- No visual regressions to legend styling
</success_criteria>

<output>
After completion, create `.planning/quick/018-move-legend-to-graph-screen/018-SUMMARY.md`
</output>
