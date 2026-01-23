---
type: quick
task: 010
description: Have File Tree panel opened by default on app start
---

<objective>
Open the File Tree panel by default when the application starts, so users immediately see the file structure.
</objective>

<tasks>
1. Add `visible` class to #tree-panel in HTML
2. Add `panel-open` class to #tree-toggle button and change icon to ◀
3. Add `tree-open` class to #graph-container
4. Add initialization code to apply default panel width on startup
</tasks>

<files>
- src/renderer/index.html (HTML class changes)
- src/renderer/renderer.js (initialization code)
</files>
