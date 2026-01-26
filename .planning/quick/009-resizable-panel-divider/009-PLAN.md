---
type: quick
task: 009
description: Add resizable divider between file tree panel and graph
---

<objective>
Allow users to resize the file tree panel by dragging a vertical divider between the panel and the graph.
</objective>

<tasks>
1. Add #tree-resizer element inside tree-panel
2. Add CSS for resizer styling (col-resize cursor, hover effect, visual handle)
3. Add JavaScript mouse event handlers for drag-to-resize
4. Update graph container and toggle button position dynamically
</tasks>

<files>
- src/renderer/index.html (HTML + CSS)
- src/renderer/renderer.js (resize logic
</files>
