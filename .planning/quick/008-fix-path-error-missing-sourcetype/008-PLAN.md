---
type: quick
task: 008
description: Fix path error - missing sourceType in graph node building
---

<objective>
Fix ENOENT error when clicking src/ files in graph - path incorrectly resolves to .planning/

Root cause: When building graph nodes from directory.nodes, the sourceType property was not being copied, causing showDetailsPanel() to fall back to .planning/ prefix for all nodes.
</objective>

<tasks>
1. Add sourceType: dirNode.sourceType to addNode() call in buildGraphFromProject()
2. Rebuild bundle
3. Verify fix
</tasks>

<files>
- src/renderer/renderer.js (line ~1367-1373)
</files>
