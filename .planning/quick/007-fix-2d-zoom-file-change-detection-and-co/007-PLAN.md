---
phase: quick
plan: 007
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
  - src/main/main.js
autonomous: true
---

<objective>
Fix three bugs in the GSD Viewer: (1) excessive zoom when clicking nodes in 2D mode, (2) file change detection not triggering flash animations, and (3) missing color coding for some file extensions.

Purpose: Improve usability by fixing zoom behavior in 2D mode, restoring visual feedback for file changes, and ensuring consistent color coding.
Output: Working 2D node click zoom, functional file change flash animations, complete extension color coverage.
</objective>

<context>
@src/renderer/renderer.js
@src/main/main.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix 2D mode zoom calculation</name>
  <files>src/renderer/renderer.js</files>
  <action>
  In the `onNodeClick` handler (around line 406-424), the `distRatio` calculation uses `Math.hypot(node.x, node.y, node.z)`. In 2D mode, `node.z` is 0 or near-zero, causing division to produce extremely large distRatio values and excessive zoom.

  Fix by checking the `is3D` variable and using appropriate calculation:

  1. For 3D mode: Keep existing calculation with all three coordinates
  2. For 2D mode: Use only x and y, and position camera at a fixed Z height (e.g., 150-200) looking down at the node

  Also apply the same fix to `selectTreeItem` function (around line 1268-1279) which has the same zoom logic.

  Example fix for onNodeClick:
  ```javascript
  if (is3D) {
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
      node, 1000
    );
  } else {
    // 2D mode: position camera above the node looking down
    Graph.cameraPosition(
      { x: node.x || 0, y: node.y || 0, z: distance + 100 },
      node, 1000
    );
  }
  ```
  </action>
  <verify>
  1. Load a project in the app
  2. Switch to 2D mode using the toggle button
  3. Click on various nodes - camera should smoothly pan to center on the node without extreme zoom
  4. Switch back to 3D mode - clicking nodes should still fly to them properly
  </verify>
  <done>Clicking nodes in 2D mode pans camera smoothly to node position without excessive zoom; 3D mode behavior unchanged</done>
</task>

<task type="auto">
  <name>Task 2: Fix file change detection and flash animation pipeline</name>
  <files>src/main/main.js, src/renderer/renderer.js</files>
  <action>
  Debug and fix the file watcher to flash animation pipeline:

  1. In main.js, the chokidar `ignored` pattern `/(^|[\/\\])\../` ignores all dotfiles/dotfolders. However, we're watching inside `.planning/` which is already a dotfolder, so this pattern may cause issues with nested paths. Simplify or remove the ignored pattern since we're explicitly watching `.planning/`:

  ```javascript
  watcher = chokidar.watch(planningPath, {
    ignoreInitial: true,
    persistent: true,
    depth: 10  // Ensure deep watching
    // Remove ignored pattern - we explicitly want to watch .planning contents
  });
  ```

  2. Add console.log statements in main.js watcher to verify events are firing:
  ```javascript
  watcher.on('all', (event, filePath) => {
    console.log('[Watcher] Event:', event, filePath);
    // ... rest of handler
  });
  ```

  3. In renderer.js, the `findNodeIdFromPath` function (line 72-94) looks correct, but verify it handles all path formats. Add more logging if needed to trace the issue.

  4. Ensure the debounce timer (500ms) isn't too aggressive - consider reducing to 300ms or adding immediate mode for the first event.
  </action>
  <verify>
  1. Load a project in the app
  2. Open DevTools console (should already be open)
  3. Edit a file in `.planning/` directory with an external editor
  4. Verify in console: "[Watcher] Event:" log appears in main process
  5. Verify in console: "[FileChange] Received:" log appears in renderer
  6. Verify the corresponding node flashes white in the graph
  7. Verify the tree item also flashes
  </verify>
  <done>File changes in .planning/ directory trigger visible flash animations on both graph nodes and tree items; console shows event flow</done>
</task>

<task type="auto">
  <name>Task 3: Complete file extension color coverage</name>
  <files>src/renderer/renderer.js</files>
  <action>
  Expand the `extensionColors` object (lines 16-29) to include more common file types that may appear in GSD projects:

  Add these extensions:
  ```javascript
  const extensionColors = {
    // Existing entries...
    '.md': '#5DADE2',      // Blue - markdown
    '.js': '#F7DC6F',      // Yellow - javascript
    '.ts': '#3498DB',      // Dark blue - typescript
    '.tsx': '#3498DB',     // Dark blue - typescript react
    '.jsx': '#F7DC6F',     // Yellow - javascript react
    '.json': '#27AE60',    // Green - json
    '.html': '#E74C3C',    // Red - html
    '.css': '#9B59B6',     // Purple - css
    '.scss': '#CC6699',    // Pink - sass
    '.less': '#1D365D',    // Dark blue - less
    '.py': '#2ECC71',      // Green - python
    '.yaml': '#F39C12',    // Orange - yaml
    '.yml': '#F39C12',     // Orange - yaml
    '.toml': '#F39C12',    // Orange - toml
    '.txt': '#BDC3C7',     // Gray - text
    '.sh': '#1ABC9C',      // Teal - shell
    '.bash': '#1ABC9C',    // Teal - bash
    '.zsh': '#1ABC9C',     // Teal - zsh
    '.gitignore': '#7F8C8D', // Dark gray - git files
    '.env': '#F1C40F',     // Yellow - environment
    '.lock': '#95A5A6',    // Gray - lock files
    '.log': '#7F8C8D',     // Dark gray - logs
    '.svg': '#FF6B6B',     // Coral - svg images
    '.png': '#E91E63',     // Pink - png images
    '.jpg': '#E91E63',     // Pink - jpg images
    '.jpeg': '#E91E63',    // Pink - jpeg images
    '.gif': '#E91E63',     // Pink - gif images
    '.sql': '#336791',     // PostgreSQL blue - sql
    '.prisma': '#2D3748',  // Dark - prisma
    '.graphql': '#E10098', // GraphQL pink
    '.gql': '#E10098',     // GraphQL pink
    '.rs': '#DEA584',      // Rust orange
    '.go': '#00ADD8',      // Go cyan
    '.rb': '#CC342D',      // Ruby red
    '.java': '#B07219',    // Java orange
    '.vue': '#4FC08D',     // Vue green
    '.svelte': '#FF3E00',  // Svelte orange
  };
  ```

  Also update the legend's extLabels object (around line 774-780) to include at least the most common new types for visibility in the UI legend.
  </action>
  <verify>
  1. Load a project that has various file types
  2. Verify files with different extensions show distinct colors in the graph
  3. Check the color legend panel shows key file types
  4. Hover over file nodes to see extension shown in tooltip with matching color
  </verify>
  <done>All common file extensions have distinct colors; legend displays expanded file type list; no files appear with default gray color unless truly unknown extension</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. 2D mode: Click any node - camera pans smoothly without extreme zoom
2. File watching: Edit any file in .planning/ - node flashes visibly
3. Colors: All file types show appropriate colors from the legend
4. No console errors during normal operation
</verification>

<success_criteria>
- 2D node click zoom is reasonable and keeps graph visible
- File change detection triggers flash animation within 500ms of save
- All standard programming file extensions have distinct colors
- Both 3D and 2D modes work correctly for all features
</success_criteria>

<output>
After completion, create `.planning/quick/007-fix-2d-zoom-file-change-detection-and-co/007-SUMMARY.md`
</output>
