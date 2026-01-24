---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
  - src/renderer/index.html
autonomous: true

must_haves:
  truths:
    - "Graph nodes flash with bright, visible pulsing effect on file change"
    - "Tree items flash with intense, visible pulsing effect"
    - "File watcher path matching correctly maps absolute paths to node IDs"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Fixed flashNode, flashTreeItem, findNodeIdFromPath"
    - path: "src/renderer/index.html"
      provides: "Enhanced tree-flash CSS animation"
  key_links:
    - from: "onFilesChanged handler"
      to: "findNodeIdFromPath"
      via: "absolute path from watcher"
    - from: "findNodeIdFromPath"
      to: "flashNode/flashTreeItem"
      via: "matched nodeId"
---

<objective>
Fix flash animation visibility for graph nodes and tree items when files change.

Purpose: File change detection flash animation (from quick task 003) is not visible enough. Users cannot see the animation, making it ineffective for indicating which files changed.

Output: Bright, pulsing flash animations that are clearly visible on both graph nodes and tree items, with working path matching from file watcher events.
</objective>

<context>
@.planning/STATE.md
@src/renderer/renderer.js
@src/renderer/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix path matching in findNodeIdFromPath</name>
  <files>src/renderer/renderer.js</files>
  <action>
Fix the `findNodeIdFromPath` function to correctly match absolute paths from the file watcher to node IDs.

Current issue: File watcher sends absolute paths (e.g., `/home/user/project/.planning/phases/01-foundation/01-01-PLAN.md`) but nodes have relative paths (e.g., `phases/01-foundation/01-01-PLAN.md`).

Implementation:
1. Update `findNodeIdFromPath` to extract the path portion after `.planning/` from the absolute path
2. Use `selectedProjectPath` to calculate the relative path
3. Add console.log debugging to verify path matching is working:
   - Log the incoming path from watcher
   - Log the extracted relative path
   - Log whether a matching node was found

The function should:
```javascript
function findNodeIdFromPath(changedPath) {
  // changedPath is absolute: /path/to/project/.planning/some/file.md
  // node.path is relative: some/file.md (relative to .planning/)

  // Extract portion after .planning/
  const planningIndex = changedPath.indexOf('.planning/');
  if (planningIndex === -1) {
    console.log('[Flash] Path not in .planning:', changedPath);
    return null;
  }

  const relativePath = changedPath.substring(planningIndex + '.planning/'.length);
  console.log('[Flash] Looking for node with path:', relativePath);

  const node = currentGraphData.nodes.find(n => n.path === relativePath);
  if (node) {
    console.log('[Flash] Found node:', node.id);
  } else {
    console.log('[Flash] No node found for path:', relativePath);
  }

  return node ? node.id : null;
}
```

Also update the `onFilesChanged` handler to flash BOTH graph and tree:
```javascript
if (data.path) {
  console.log('[FileChange] Received:', data.event, data.path);
  const nodeId = findNodeIdFromPath(data.path);
  if (nodeId) {
    flashNode(nodeId);
    flashTreeItem(nodeId);
  }
}
```
  </action>
  <verify>
1. Open DevTools console
2. Edit a file in .planning/ directory
3. See console logs: "[Flash] Looking for node with path:", "[Flash] Found node:"
4. Verify nodeId is found and flash functions are called
  </verify>
  <done>File change events correctly map absolute watcher paths to node IDs, with debug logging confirming the mapping</done>
</task>

<task type="auto">
  <name>Task 2: Make graph flash more intense with pulsing effect</name>
  <files>src/renderer/renderer.js</files>
  <action>
Update the `flashNode` function to create a more visible flash effect:

1. Change flash color from yellow (0xFFFF00) to bright white (0xFFFFFF) for maximum visibility
2. Add pulsing effect: 3 pulses over 2 seconds instead of single fade
3. Increase initial brightness/intensity
4. For group objects (directories), flash ALL materials in the group

Updated implementation:
```javascript
function flashNode(nodeId) {
  const node = currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.log('[Flash] Node not found in graph:', nodeId);
    return;
  }

  const threeObj = node.__threeObj;
  if (!threeObj) {
    console.log('[Flash] No THREE object for node:', nodeId);
    return;
  }

  // Collect all materials to animate
  const materials = [];
  if (threeObj.material) {
    materials.push(threeObj.material);
  }
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  if (materials.length === 0) {
    console.log('[Flash] No materials found for node:', nodeId);
    return;
  }

  // Cancel existing animation
  if (flashingNodes.has(nodeId)) {
    const existing = flashingNodes.get(nodeId);
    if (existing.rafId) cancelAnimationFrame(existing.rafId);
  }

  // Store original colors
  const originalColors = materials.map(m => m.color.getHex());
  const flashColor = 0xFFFFFF; // Bright white for maximum visibility

  // Pulsing animation: 3 pulses over 2 seconds
  const duration = 2000;
  const pulseCount = 3;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Pulsing: use sine wave for multiple pulses, with decay
    const pulsePhase = progress * pulseCount * Math.PI * 2;
    const pulse = Math.max(0, Math.sin(pulsePhase));
    const decay = 1 - progress; // Fade out over time
    const intensity = pulse * decay;

    materials.forEach((material, i) => {
      material.color.setHex(lerpColor(originalColors[i], flashColor, intensity));
    });

    if (progress < 1) {
      const rafId = requestAnimationFrame(animate);
      flashingNodes.set(nodeId, { rafId, startTime });
    } else {
      // Restore original colors
      materials.forEach((material, i) => {
        material.color.setHex(originalColors[i]);
      });
      flashingNodes.delete(nodeId);
    }
  }

  // Start animation
  const rafId = requestAnimationFrame(animate);
  flashingNodes.set(nodeId, { rafId, startTime });
  console.log('[Flash] Started graph flash for:', nodeId);
}
```
  </action>
  <verify>
1. Click on a tree item (which triggers `flashNode`)
2. Graph node should flash bright white with 3 visible pulses
3. Flash should be clearly visible against the dark background
4. Console should show "[Flash] Started graph flash for: [nodeId]"
  </verify>
  <done>Graph nodes flash with bright white pulsing effect that is clearly visible</done>
</task>

<task type="auto">
  <name>Task 3: Make tree flash more intense with pulsing CSS</name>
  <files>src/renderer/index.html</files>
  <action>
Update the CSS `@keyframes tree-flash` animation to be more visible:

1. Use bright white background instead of semi-transparent yellow
2. Add pulsing effect (multiple peaks) instead of single fade
3. Increase contrast with text

Replace the existing tree-flash styles:
```css
@keyframes tree-flash {
  0% {
    background-color: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
  }
  15% {
    background-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
  }
  30% {
    background-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.7);
  }
  45% {
    background-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 3px rgba(255, 255, 255, 0.2);
  }
  60% {
    background-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.tree-flash {
  animation: tree-flash 2s ease-out;
  color: #1a1a2e !important; /* Dark text during flash for contrast */
}
```

This creates 3 bright pulses that fade over 2 seconds, matching the graph animation timing.
  </action>
  <verify>
1. Click on a graph node (which triggers `flashTreeItem`)
2. Tree item should flash bright white with 3 visible pulses
3. Flash should be clearly visible in the tree panel
4. Text should remain readable during flash (dark text on light background)
  </verify>
  <done>Tree items flash with bright white pulsing effect matching graph animation</done>
</task>

</tasks>

<verification>
1. Open GSD Viewer and load a project
2. Open the file tree panel
3. Edit a file in .planning/ directory (e.g., add a newline to STATE.md)
4. Observe:
   - Console logs show path matching worked
   - Graph node flashes bright white with 3 pulses
   - Tree item flashes bright white with 3 pulses
   - Both animations are clearly visible and attention-grabbing
5. Click on tree item -> graph node flashes
6. Click on graph node -> tree item flashes
</verification>

<success_criteria>
- File change detection correctly maps watcher paths to node IDs (verified via console logs)
- Graph flash uses bright white color with 3 visible pulses over 2 seconds
- Tree flash uses bright white color with 3 visible pulses over 2 seconds
- Flash animations are intense enough to be clearly visible
- Bidirectional flash (graph<->tree) continues to work
</success_criteria>

<output>
After completion, update `.planning/STATE.md` Quick Tasks Completed table with:
| 005 | Fix flash animation visibility - brighter pulsing effect | {date} | [005-fix-flash-animation](./quick/005-fix-flash-animation-visibility-make-more/) |
</output>
