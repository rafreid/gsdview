---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "When a file changes, the corresponding node flashes/pulses visually"
    - "Flash animation is temporary (2-3 seconds) then returns to normal"
    - "Multiple simultaneous file changes each trigger their own flash"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Flash animation logic for file change events"
      contains: "flashNode"
  key_links:
    - from: "onFilesChanged callback"
      to: "flashNode function"
      via: "path matching to node ID"
      pattern: "flashNode.*changed.*path"
---

<objective>
Flash/animate file nodes when files change to visually indicate real-time edits.

Purpose: Provide immediate visual feedback when files are being edited, making the graph feel alive and responsive to changes in the project.

Output: Enhanced renderer.js with flash animation triggered by file change events.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/renderer/renderer.js
@src/main/main.js (lines 69-77 - files-changed IPC event)
@src/main/preload.js (line 14 - onFilesChanged API)

Key existing code:
- `onFilesChanged` callback (line 911-918) already receives file change data with `{ event, path }`
- `currentGraphData.nodes` contains all nodes with `id` and `path` properties
- File nodes have `id` like `file-README-md` and `path` like `README.md`
- Custom THREE.js objects created via `nodeThreeObject` (files are octahedrons at line 200-216)
- Graph instance is `Graph` with access to scene via `Graph.scene()`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add flash animation system for file nodes</name>
  <files>src/renderer/renderer.js</files>
  <action>
Add flash animation capability to renderer.js:

1. Add tracking state at module level (near line 55 after treeExpanded):
   ```javascript
   // Track nodes currently flashing (nodeId -> animation state)
   const flashingNodes = new Map();
   ```

2. Add a `flashNode(nodeId)` function that:
   - Finds the node's THREE.js object using `Graph.scene().getObjectByName(nodeId)` or by iterating graph nodes
   - Stores original material color/opacity
   - Creates a pulse animation: bright white/yellow flash that fades back to original over ~2 seconds
   - Uses requestAnimationFrame for smooth animation
   - Handles case where node is already flashing (restart animation)

3. Add a `findNodeIdFromPath(changedPath)` function that:
   - Takes the changed file path (relative like `.planning/STATE.md`)
   - Searches `currentGraphData.nodes` for matching `path` property
   - Returns the node ID if found, null otherwise
   - Handle path normalization (remove leading .planning/ if present to match stored paths)

4. Modify the existing `onFilesChanged` handler (lines 911-918) to:
   - Extract file path from data
   - Call `findNodeIdFromPath()` to get node ID
   - If node found, call `flashNode(nodeId)`
   - Keep the existing refresh behavior (don't remove loadProject call)

Animation approach: Since nodeThreeObject creates new objects, access the mesh material directly:
- For file octahedrons: mesh.material.emissive or mesh.material.color
- Use GSAP-style animation (manual with RAF) or THREE.js color lerp
- Flash to bright color (#FFFF00 yellow or #FFFFFF white) then lerp back to original
  </action>
  <verify>
  1. Start the app: `cd /home/rafreid/AFLUXSYS/products/GSDv && npm start`
  2. Load a GSD project
  3. In another terminal, edit a file in the .planning folder: `echo "# test" >> .planning/STATE.md`
  4. Observe: The STATE.md node should flash bright then fade back to normal color
  </verify>
  <done>File nodes flash with a visible pulse animation when their corresponding files are changed, animation lasts ~2 seconds and returns to original appearance</done>
</task>

<task type="auto">
  <name>Task 2: Ensure animation works with THREE.js custom objects</name>
  <files>src/renderer/renderer.js</files>
  <action>
Refine the flash animation to properly integrate with 3d-force-graph's custom node objects:

1. Modify `nodeThreeObject` function to assign names to created meshes:
   - For file octahedrons (line 200-216): Add `mesh.name = node.id;` before return
   - For directory groups (line 165-196): Add `group.name = node.id;` and `body.name = node.id + '-body';`

2. Update `flashNode()` to handle the mesh retrieval:
   - Use Graph's internal node object mapping if available: `Graph.scene().children` traversal
   - Or store references when nodeThreeObject creates them in a Map (nodeId -> THREE.Object3D)
   - Handle both file (single mesh) and directory (group with body mesh) cases

3. Animation implementation detail:
   ```javascript
   function flashNode(nodeId) {
     const node = currentGraphData.nodes.find(n => n.id === nodeId);
     if (!node) return;

     // Get the THREE object - 3d-force-graph stores them on node.__threeObj
     const threeObj = node.__threeObj;
     if (!threeObj) return;

     // Find the material to animate
     let material;
     if (threeObj.material) {
       material = threeObj.material;
     } else if (threeObj.children) {
       // For groups, find first mesh with material
       const mesh = threeObj.children.find(c => c.material);
       if (mesh) material = mesh.material;
     }
     if (!material) return;

     // Store original color
     const originalColor = material.color.getHex();
     const flashColor = 0xFFFF00; // Bright yellow

     // Animate
     const duration = 2000;
     const startTime = Date.now();

     function animate() {
       const elapsed = Date.now() - startTime;
       const progress = Math.min(elapsed / duration, 1);

       // Ease out: start bright, fade to original
       const t = 1 - Math.pow(1 - progress, 3); // ease-out cubic
       material.color.setHex(lerpColor(flashColor, originalColor, t));

       if (progress < 1) {
         requestAnimationFrame(animate);
       }
     }

     material.color.setHex(flashColor);
     requestAnimationFrame(animate);
   }
   ```

4. Add color lerp helper:
   ```javascript
   function lerpColor(color1, color2, t) {
     const r1 = (color1 >> 16) & 0xFF, g1 = (color1 >> 8) & 0xFF, b1 = color1 & 0xFF;
     const r2 = (color2 >> 16) & 0xFF, g2 = (color2 >> 8) & 0xFF, b2 = color2 & 0xFF;
     const r = Math.round(r1 + (r2 - r1) * t);
     const g = Math.round(g1 + (g2 - g1) * t);
     const b = Math.round(b1 + (b2 - b1) * t);
     return (r << 16) | (g << 8) | b;
   }
   ```
  </action>
  <verify>
  1. Run app and load project
  2. Confirm file nodes and directory nodes are properly rendered (no visual regression)
  3. Edit a file and verify flash animation plays smoothly
  4. Edit multiple files in quick succession and verify each flashes independently
  </verify>
  <done>Flash animation properly accesses THREE.js mesh materials via node.__threeObj, handles both file and directory node types, and multiple simultaneous flashes work correctly</done>
</task>

</tasks>

<verification>
1. Visual test: Edit STATE.md, observe node flash
2. Visual test: Edit multiple files, observe multiple flashes
3. No console errors during animation
4. Graph continues to function normally after flashes complete
5. Tree panel sync and details panel still work
</verification>

<success_criteria>
- File changes trigger visible flash animation on corresponding graph nodes
- Animation is smooth (no jank) and lasts approximately 2 seconds
- Animation returns node to original color/appearance
- Multiple simultaneous file changes animate independently
- No regressions to existing functionality (navigation, selection, tooltips)
</success_criteria>

<output>
After completion, create `.planning/quick/003-flash-animate-file-nodes-on-change-to-re/003-SUMMARY.md`
</output>
