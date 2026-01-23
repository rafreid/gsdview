# Quick Task 001: Enhance File Visualization

## Objective
Improve the visual distinction between directories and files on the graph, add diff view on file click, and enhance file-related graph features.

## Tasks

### Task 1: Visual distinction for directories vs files
- Use different shapes: directories as cubes, files as spheres
- Add folder icon styling for directories
- Different opacity/size scaling for dirs vs files

### Task 2: Show file content/diff on click
- When clicking a file node, read file content via IPC
- Display in details panel with syntax highlighting (basic)
- For .md files in .planning/, show rendered content preview

### Task 3: Enhanced file graph features
- Add file extension badges/colors (e.g., .md = blue, .js = yellow)
- Show file size as node size modifier
- Add "expand/collapse" for directory nodes
- Highlight recently modified files (pulse effect)

## Implementation Notes

Files to modify:
- `src/main/main.js` - Add IPC handler for reading file content
- `src/main/preload.js` - Expose readFile API
- `src/renderer/renderer.js` - Custom node shapes, file content display
- `src/renderer/index.html` - Enhanced details panel for file preview

## Success Criteria
- [ ] Directories visually distinct from files (different shape/icon)
- [ ] Clicking file shows content in details panel
- [ ] File extensions have color coding
- [ ] Recently modified files are highlighted
