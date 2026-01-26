---
type: quick
task: 006
title: Add 2D/3D Toggle Switch to Graph View
files_modified:
  - src/renderer/index.html
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "User can see a toggle button in the toolbar indicating current view mode (2D or 3D)"
    - "Clicking the toggle switches between 2D and 3D graph views"
    - "Graph layout adjusts appropriately when switching modes"
    - "Current mode persists visually (button shows which mode is active)"
  artifacts:
    - path: "src/renderer/index.html"
      provides: "Toggle button UI element"
      contains: "dimension-toggle"
    - path: "src/renderer/renderer.js"
      provides: "Dimension switching logic"
      contains: "numDimensions"
  key_links:
    - from: "toggle button click"
      to: "Graph.numDimensions()"
      via: "event handler"
---

<objective>
Add a 2D/3D toggle switch to the graph window toolbar that allows users to switch between 2D and 3D graph views

Purpose: Enable users to view the graph in a flattened 2D layout (easier to read for large graphs) or full 3D layout (better spatial understanding).

Output: Working toggle button that switches graph between 2D and 3D modes using the 3d-force-graph library's numDimensions API.
</objective>

<context>
@src/renderer/index.html
@src/renderer/renderer.js

The graph uses `3d-force-graph` library which supports `numDimensions(2)` to flatten to 2D and `numDimensions(3)` for full 3D. The current implementation initializes as 3D via `ForceGraph3D()(container)`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add toggle button UI and dimension switching logic</name>
  <files>
    src/renderer/index.html
    src/renderer/renderer.js
  </files>
  <action>
1. In index.html toolbar (after refresh button, before selected-path span):
   - Add a toggle button with id="dimension-toggle"
   - Button text should show current mode: "3D" when in 3D mode, "2D" when in 2D mode
   - Style consistently with existing toolbar buttons
   - Add title attribute: "Toggle between 2D and 3D view"

2. In renderer.js:
   - Add a state variable `let is3D = true;` near other state variables (around line 55)
   - Add click handler for dimension-toggle button that:
     - Toggles is3D boolean
     - Calls `Graph.numDimensions(is3D ? 3 : 2)`
     - Updates button text to show current mode
     - Optionally adjust camera position for 2D mode (look straight down Z-axis)
   - For 2D mode, consider calling `Graph.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 })` to get a top-down view
  </action>
  <verify>
    - npm run build succeeds
    - App starts with npm start
    - Toggle button visible in toolbar
    - Clicking toggle switches between 2D (flat) and 3D (spatial) views
    - Button text updates to reflect current mode
  </verify>
  <done>
    - Toggle button appears in toolbar showing "3D" initially
    - Clicking cycles between 2D and 3D views
    - In 2D mode, graph nodes are constrained to a flat plane
    - In 3D mode, graph nodes have full spatial positioning
  </done>
</task>

</tasks>

<verification>
1. Visual check: Toggle button visible in toolbar between Refresh and path display
2. Functional check: Click toggle, observe graph flatten to 2D plane
3. Functional check: Click toggle again, observe graph expand to 3D
4. State check: Button text reflects current mode (shows "2D" when in 2D, "3D" when in 3D)
</verification>

<success_criteria>
- Toggle button present and styled consistently with toolbar
- Graph flattens to 2D when toggle activated
- Graph restores to 3D when toggle deactivated
- Button indicates current view mode
- No console errors during toggle operations
</success_criteria>

<output>
After completion, create `.planning/quick/006-add-2d-3d-toggle-switch-to-change-graph-/006-SUMMARY.md`
</output>
