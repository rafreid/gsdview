---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/index.html
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Clicking a graph node flashes the corresponding tree item yellow"
    - "Clicking a tree item flashes the corresponding graph node yellow"
    - "Flash animation is visible and lasts approximately 2 seconds"
  artifacts:
    - path: "src/renderer/index.html"
      provides: "CSS flash animation for tree items"
      contains: "@keyframes tree-flash"
    - path: "src/renderer/renderer.js"
      provides: "Bidirectional flash sync logic"
      contains: "flashTreeItem"
  key_links:
    - from: "highlightTreeItem"
      to: "CSS .tree-flash"
      via: "classList.add"
      pattern: "classList\\.add.*tree-flash"
    - from: "selectTreeItem"
      to: "flashNode"
      via: "function call"
      pattern: "flashNode\\(nodeId\\)"
---

<objective>
Implement bidirectional flash sync between 3D graph nodes and file tree items on click.

Purpose: Provide clear visual feedback showing the connection between graph nodes and tree items when either is clicked, improving spatial awareness and navigation.
Output: Yellow pulse flash animation on tree items when graph node clicked, and graph node flash when tree item clicked.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/renderer/renderer.js - Main logic with existing flashNode() and highlightTreeItem()
@src/renderer/index.html - CSS styles
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CSS flash animation for tree items</name>
  <files>src/renderer/index.html</files>
  <action>
Add a CSS `@keyframes tree-flash` animation and `.tree-flash` class in the style section. The animation should:
- Start with bright yellow background (rgba(255, 255, 0, 0.6))
- Fade to transparent over 2 seconds
- Use ease-out timing for smooth fade
- Apply the animation with `animation: tree-flash 2s ease-out`

Add after the existing `.tree-item.highlighted` styles (around line 365).
  </action>
  <verify>Inspect index.html contains @keyframes tree-flash and .tree-flash class</verify>
  <done>CSS flash animation defined for tree items</done>
</task>

<task type="auto">
  <name>Task 2: Add flashTreeItem function and wire bidirectional sync</name>
  <files>src/renderer/renderer.js</files>
  <action>
1. Create a `flashTreeItem(nodeId)` function that:
   - Finds the tree item element by data-node-id
   - Removes any existing 'tree-flash' class
   - Forces reflow with offsetWidth read
   - Adds 'tree-flash' class to trigger animation
   - Sets a timeout to remove the class after 2000ms

2. Modify `highlightTreeItem(nodeId)` function (around line 1234):
   - After scrolling to the item, call `flashTreeItem(nodeId)` to trigger the flash

3. Modify `selectTreeItem(nodeId)` function (around line 1202):
   - After flying to the node in the graph, call `flashNode(nodeId)` to flash the graph node
   - Add this call after the Graph.cameraPosition() call
  </action>
  <verify>
Test manually:
1. Load a project in GSD Viewer
2. Click a file node in the 3D graph - verify tree item flashes yellow
3. Click a tree item - verify the 3D graph node flashes yellow
  </verify>
  <done>
- Clicking graph node triggers tree item flash
- Clicking tree item triggers graph node flash
- Both animations use consistent yellow color and 2-second duration
  </done>
</task>

</tasks>

<verification>
1. Open GSD Viewer with `npm start`
2. Load a project folder
3. Click a file/directory node in the 3D graph
   - Expected: Tree panel scrolls to item AND item flashes yellow
4. Click a file/directory in the tree panel
   - Expected: Camera flies to node AND node flashes yellow in graph
5. Verify flash animations are visible and last ~2 seconds
</verification>

<success_criteria>
- Bidirectional flash sync working: graph click -> tree flash, tree click -> graph flash
- Both flash animations use yellow color matching existing graph flash
- Both animations complete in ~2 seconds
- Flash is clearly visible and provides good visual feedback
</success_criteria>

<output>
After completion, create `.planning/quick/004-bidirectional-flash-sync-between-graph-n/004-SUMMARY.md`
</output>
