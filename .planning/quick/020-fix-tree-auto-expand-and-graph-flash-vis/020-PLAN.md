---
phase: quick
plan: 020
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Tree panel auto-expands to reveal flashing files in collapsed directories"
    - "3D graph nodes display visible emissive glow during flash animations" 
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Auto-expand and emissive material fixes"
  key_links:
    - from: "flashTreeItem()"
      to: "expandParentsOf()"
      via: "function call before flash"
    - from: "MeshStandardMaterial"
      to: "material.emissive"
      via: "emissive property support"
---

<objective>
Fix two related visibility bugs:
1. Tree panel does not auto-expand collapsed directories when a file inside them is flashing
2. Graph 3D node flash animations are not visible because emissive glow doesn't work with MeshBasicMaterial

Purpose: Ensure users can see flash animations both in the tree panel (by auto-expanding to reveal the flashing file) and in the 3D graph (by using materials that support emissive properties).

Output: Both tree and graph flash animations are fully visible to users.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/renderer/renderer.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add auto-expand to flashTreeItem function</name>
  <files>src/renderer/renderer.js</files>
  <action>
    Modify the `flashTreeItem(nodeId, changeType)` function (around line 2470) to call `expandParentsOf(nodeId)` and `updateTreePanel()` before applying the flash animation, similar to how `highlightTreeItem` does it.

    Current code:
    ```javascript
    function flashTreeItem(nodeId, changeType = 'modified') {
      const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
      if (!treeItem) return;
      // ... animation code
    }
    ```

    Updated code:
    ```javascript
    function flashTreeItem(nodeId, changeType = 'modified') {
      // Expand parent directories to reveal the flashing file
      expandParentsOf(nodeId);
      updateTreePanel();

      // Use setTimeout to ensure DOM is updated before querying
      setTimeout(() => {
        const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
        if (!treeItem) return;

        // Remove existing animation classes
        treeItem.classList.remove('tree-flash', 'tree-flash-created', 'tree-flash-modified', 'tree-flash-deleted', 'tree-flash-read');

        // Force reflow to restart animation
        void treeItem.offsetWidth;

        // Add type-specific animation class
        const className = `tree-flash-${changeType}`;
        treeItem.classList.add(className);

        // Scroll into view if not visible
        treeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Remove class after animation completes
        setTimeout(() => {
          treeItem.classList.remove(className);
        }, 2000);
      }, 50);
    }
    ```

    This ensures:
    1. Parent directories are expanded before attempting to flash
    2. Tree panel is updated to reflect the expansion
    3. Small delay allows DOM to update before querying for the tree item
    4. Flashing item scrolls into view if it was previously hidden
  </action>
  <verify>
    1. Collapse a directory in the tree panel
    2. Make a change to a file inside that directory (edit and save)
    3. Verify the directory auto-expands and the file flashes visibly
  </verify>
  <done>Tree panel auto-expands collapsed directories to reveal flashing files</done>
</task>

<task type="auto">
  <name>Task 2: Change node materials from MeshBasicMaterial to MeshStandardMaterial</name>
  <files>src/renderer/renderer.js</files>
  <action>
    The current code uses `THREE.MeshBasicMaterial` for all nodes (lines 2689, 2699, 2733, 2755, 2779, 2788, 2804, 2832). `MeshBasicMaterial` does NOT support emissive properties - it ignores `material.emissive` and `material.emissiveIntensity`.

    Change all `MeshBasicMaterial` to `MeshStandardMaterial` in the `nodeThreeObject` callback. MeshStandardMaterial supports:
    - `emissive` (color)
    - `emissiveIntensity` (number)
    - Same `color`, `transparent`, `opacity` properties

    Files to update in nodeThreeObject (around line 2678):

    1. Directory body material (line ~2689):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, metalness: 0, roughness: 0.8 })`

    2. Directory tab material (line ~2699):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.95, metalness: 0, roughness: 0.8 })`

    3. File material (line ~2733):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, metalness: 0.1, roughness: 0.7 })`

    4. Git status ring (line ~2755):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, metalness: 0, roughness: 0.9 })`

    5. Current phase sphere (line ~2779):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, metalness: 0, roughness: 0.8 })`

    6. Current phase ring (line ~2788):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, metalness: 0, roughness: 0.9 })`

    7. Commit node (line ~2804):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, metalness: 0.1, roughness: 0.7 })`

    8. Root node (line ~2832):
       `new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9, metalness: 0, roughness: 0.8 })`

    Add `metalness: 0` and `roughness: 0.7-0.9` to keep similar appearance to MeshBasicMaterial while enabling emissive support.

    Also ensure there's adequate lighting in the scene. Check if AmbientLight and DirectionalLight exist. If not, add them after Graph initialization:
    ```javascript
    // Add lights for MeshStandardMaterial
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    Graph.scene().add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    Graph.scene().add(directionalLight);
    ```
  </action>
  <verify>
    1. Run `npm run build` to rebuild
    2. Start the app and load a project
    3. Make a file change and observe the 3D graph
    4. Verify nodes now display a visible glowing/emissive effect during flash animation
    5. Check that normal node appearance is still acceptable (not too dark or washed out)
  </verify>
  <done>3D graph nodes display visible emissive glow during flash animations</done>
</task>

</tasks>

<verification>
1. Tree auto-expand test:
   - Collapse the `.planning/` directory in tree panel
   - Edit a file inside `.planning/phases/` from outside the app
   - Verify the tree auto-expands to show the flashing file

2. Graph flash visibility test:
   - Watch the 3D graph while making file changes
   - Verify nodes pulse with visible emissive glow (not just color change)
   - Verify the glow is visible from various zoom distances (overview and close-up)

3. Performance check:
   - Verify no noticeable performance degradation from material change
   - MeshStandardMaterial is more expensive but should be fine for typical node counts
</verification>

<success_criteria>
- Files inside collapsed tree directories auto-expand and flash when changed
- 3D graph nodes display visible emissive glow during flash animations
- No regressions to existing flash animation patterns (created/modified/deleted/read)
- Normal node appearance remains visually appealing
</success_criteria>

<output>
After completion, create `.planning/quick/020-fix-tree-auto-expand-and-graph-flash-vis/020-SUMMARY.md`
</output>
