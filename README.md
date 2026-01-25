# GSD Viewer

A desktop application that visualizes GSD project structure as an interactive 3D force-directed graph. Fly through your project's phases, plans, tasks, requirements, and files — seeing relationships, progress, and blockers at a glance.

## Features

### 3D Visualization
- Force-directed graph powered by [3d-force-graph](https://github.com/vasturiano/3d-force-graph)
- Color-coded nodes by type (phases, plans, tasks, requirements, files)
- Node sizing based on connection count
- Progress coloring (green=complete, yellow=in-progress, gray=pending)
- 2D/3D toggle for different viewing modes

### Real-time Activity
- Live file watching with flash animations on changes
- Heat map visualization for recently changed files
- Activity trails connecting changed files
- Activity feed with scrolling change log
- Git integration (staged, modified, untracked files)

### Claude Code Integration
- PostToolUse hooks detect Read/Write/Edit operations
- Read operations display distinct blue flash (not possible with file watchers alone)
- Enhanced flash visibility (3.5x emissive glow, 1.8x scale pulse)
- Animation batching for smooth 60fps during rapid operations
- Debug mode for troubleshooting hook configuration

### Navigation
- Click node to zoom/focus camera
- Bookmarks with keyboard shortcuts (1-9)
- Back/forward navigation history
- Breadcrumb trail for hierarchy navigation
- Minimap with click-to-navigate
- Follow-active mode tracks file changes
- Orbit mode for presentations

### File Inspector
- Double-click to open file inspector modal
- Diff editor with git/session comparison
- Structure tree for code navigation
- File metadata and quick actions
- In-file search with highlighting

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd GSDv

# Install dependencies
npm install

# Start the application
npm start
```

## Usage

1. Launch the application
2. Open a folder containing a `.planning/` directory (GSD project)
3. Explore the 3D graph visualization
4. Click nodes to see details, double-click files to inspect

### Claude Code Hooks (Optional)

To enable real-time operation detection from Claude Code:

1. The app automatically configures hooks in `.claude/settings.json`
2. Hook script writes events to `.gsd-viewer/events/`
3. App watches for event files and triggers flash animations

If hooks aren't working, a notification appears after 30 seconds with a Setup Guide link.

## Project Structure

```
GSDv/
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process
│   │   └── preload.js       # IPC bridge
│   └── renderer/
│       ├── renderer.js      # Graph rendering and UI
│       ├── graph-builder.js # GSD structure parsing
│       └── index.html       # Application UI
├── .planning/               # GSD planning documents
└── .gsd-viewer/             # Runtime files
    ├── hooks/               # Claude hook script
    └── events/              # Operation event files
```

## Tech Stack

- **Electron** - Desktop application framework
- **3d-force-graph** - 3D force-directed graph visualization
- **Three.js** - 3D rendering (via 3d-force-graph)
- **chokidar** - File system watching
- **electron-store** - Persistent settings
- **esbuild** - ES module bundling

## Development

```bash
# Start in development mode
npm start

# Build for production
npm run build

# Package for distribution
npm run package
```

## Milestones

| Version | Name | Description |
|---------|------|-------------|
| v1.0 | Initial Release | 3D graph, GSD parsing, live watching |
| v1.1 | Real-time Activity | Activity feed, heat map, git integration |
| v1.2 | File Deep Dive | File inspector modal, diff editor |
| v1.3 | Enhanced Navigation | Bookmarks, minimap, orbit mode |
| v1.4 | Live Activity Sync | Claude hooks, enhanced flash effects |

See `.planning/MILESTONES.md` for detailed changelog.

## License

MIT
