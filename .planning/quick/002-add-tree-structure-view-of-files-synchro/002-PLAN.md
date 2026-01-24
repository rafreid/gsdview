# Quick Task 002: Add Tree Structure View with Graph Sync

## Objective
Add a collapsible tree view panel showing the file/directory structure that synchronizes bidirectionally with the 3D graph - clicking in tree highlights in graph, clicking in graph highlights in tree.

## Tasks

### Task 1: Create Tree Panel UI
- [x] Add collapsible left panel for tree view
- [x] Style with same dark theme as rest of app
- [x] Add toggle button to show/hide tree panel
- [x] Tree should be scrollable independently

### Task 2: Build Tree from Directory Data
- [x] Parse directory nodes into hierarchical tree structure
- [x] Render with expand/collapse functionality for directories
- [x] Show file icons based on type (folder/file)
- [x] Color-code by extension (matching graph colors)

### Task 3: Implement Bidirectional Sync
- [x] Click tree item → fly to node in graph + highlight
- [x] Click graph node → scroll to + highlight in tree
- [x] Expand parent folders when child is selected
- [x] Visual highlight state for selected item in both views

## Implementation Notes

Files modified:
- `src/renderer/index.html` - Added tree panel structure and CSS
- `src/renderer/renderer.js` - Tree building, selection sync logic

## Success Criteria
- [x] Tree panel visible on left side with toggle
- [x] Tree shows .planning/ folder structure
- [x] Clicking tree item focuses graph on that node
- [x] Clicking graph node highlights corresponding tree item
- [x] Directories expandable/collapsible
