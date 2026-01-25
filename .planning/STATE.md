# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Make the invisible structure of a GSD project visible and navigable
**Current focus:** v1.3 Enhanced Navigation + Smooth Activity - Phase 25 in progress

## Current Position

Phase: 25 of 25 (Advanced Camera)
Plan: 1/2 (25-02 complete)
Status: Phase 25 in progress
Last activity: 2026-01-25 - Completed 25-02-PLAN.md

Progress: [█████████████████████████████████████] 25/25 phases (98%)

## Performance Metrics

**Velocity:**
- Total plans completed: 54 (v1.0: 23, v1.1: 14, v1.2: 7, v1.3: 17)
- Average duration: 5min
- Total execution time: 2 days + 89m (v1.0: 1 day, v1.1: 1 day, v1.2: 17m, v1.3: 72m)

**By Milestone:**

*v1.0 (Complete):*
- 6 phases, 23 plans
- Status: Shipped 2026-01-22

*v1.1 (Complete):*
- 6 phases, 14 plans
- Status: Shipped 2026-01-23

*v1.2 (Complete):*
- 5 phases, 7 plans
- Status: Shipped 2026-01-24

*v1.3 (Active):*
- 8 phases planned
- Status: Phase 25 in progress (9 plans complete)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Used 3d-force-graph library for visualization
- Electron app with context isolation for security
- chokidar for file watching, electron-store for persistence
- Single unified 3D graph view (not multiple views)
- esbuild for bundling ES modules
- Limit file scope to .planning/ + src/ for performance (v1.1: expanding to src/)
- parseDirectories uses sourceType property for node categorization (07-01)
- Node IDs prefixed with sourceType to avoid collisions (07-01)
- File watcher monitors both .planning/ and src/ simultaneously (07-02)
- sourceType property included in file change events (07-02)
- src/ files use cooler blue tones (#7EC8E3 for files, #5B9BD5 for directories) (07-03)
- src/ files use icosahedron geometry, planning/ uses octahedron (07-03)
- applySourceTint shifts colors toward blue for visual differentiation (07-03)
- Activity panel height 180px, badge caps at "99+" (08-01)
- Entry type classes: .created (green), .modified (orange), .deleted (red) (08-01)
- addActivityEntry maps chokidar events to user-friendly types (08-02)
- Change type colors: created=#2ECC71, modified=#F39C12, deleted=#E74C3C (08-02)
- flashNodeWithType for type-specific 3D animations (08-02)
- MAX_ACTIVITY_ENTRIES=100 to prevent memory issues (08-02)
- Event delegation on activity-content for entry interactions (08-03)
- Node highlight 1.3x scale on hover (08-03)
- Entry click navigates AND opens details panel (08-03)
- Heat gradient: red (0.0) -> orange (0.3) -> yellow (0.6) -> normal (1.0) (09-01)
- Default heat decay duration: 5 minutes (300000ms) (09-01)
- Flash animations take priority over heat colors (09-01)
- Deleted files excluded from heat tracking (09-01)
- Heat decay slider range: 30s to 10m, default 5m (09-02)
- Persist heat decay setting via electron-store (09-02)
- Use child_process.execSync for git commands, not simple-git (10-01)
- Git IPC naming: get-git-{operation} pattern (10-01)
- Non-git directories return empty results gracefully (10-01)
- Ring geometry (RingGeometry) for git status indicators around file nodes (10-02)
- Staged=green, modified=orange, untracked=purple color scheme (10-02)
- Staged takes priority over modified when both apply (10-02)
- Git status checks use path matching with sourceType prefixes (10-02)
- Fetch git data before buildGraphFromProject for commit node integration (10-03)
- Use directory type for "Recent Commits" parent node (10-03)
- Hexagonal cylinder geometry for commit nodes (10-03)
- Purple (#9B59B6) for commit nodes (10-03)
- Statistics panel at 320px width, right side of screen (11-01)
- File ranking shows top 10 most edited files with bar chart (11-01)
- Activity chart aggregates changes into 10 time buckets (11-01)
- Diff compares against HEAD (last committed state) (11-02)
- Long diffs truncated at 100 lines for UI performance (11-02)
- refreshDiffSection for efficient targeted diff updates (11-02)
- Timeline slider range 0-100 mapped to timestamp range (12-01)
- 500ms playback speed for timeline replay (12-01)
- null for live mode, timestamp for historical (12-01)
- File opacity levels: 10% not-created, 30% deleted, 85% existing (12-01)
- Double-click threshold 300ms for file inspector modal activation (13-01)
- Modal z-index 500-501 (overlay + modal), above all panels (13-01)
- Escape key priority: close modal if open, else close details panel (13-01)
- Modal sections default to expanded state on open (13-01)
- Session snapshots stored as Map with filePath -> {content, timestamp} (14-01)
- Default diff mode is Git (vs HEAD), user can toggle to Session (14-01)
- Basic syntax highlighting for JS/TS, MD, JSON via regex replacement (14-01)
- Line numbers use git hunk headers for accurate positioning (14-01)
- Session diff uses simple line-by-line comparison (14-01)
- parseFileStructure routes by extension to type-specific parsers (15-01)
- Structure items use { type, name, line, depth } format (15-01)
- JSON recursion limited to depth 5 for performance (15-01)
- Brace depth tracking for JS class method scope detection (15-01)
- Event delegation on structure section for tree click handling (15-02)
- 12px per depth level indentation for structure tree (15-02)
- Icon mapping: H=header, f=function, C=class, i=import, e=export, k=key (15-02)
- Click-to-scroll uses scrollIntoView with block: 'center' (15-02)
- 1.5s highlight duration for scrolled-to diff lines (15-02)
- Metadata grid uses 2-column label-value layout for file stats (16-01)
- Git status badges color-coded (green=staged, orange=modified, purple=untracked, gray=clean) (16-01)
- Toast notification system for non-intrusive user feedback (16-01)
- get-file-stats IPC handler for fetching file metadata (size, mtime, ctime) (16-01)
- Quick actions: Open in Editor, Copy Path, Copy Content with clipboard API (16-01)
- Recent activity filters global activityEntries by current file path (16-02)
- Relative timestamps (Just now, X min ago, X hours ago, date) for activity (16-02)
- Import detection via simple pattern matching (import/require/from keywords) (16-02)
- Related files scan limited to 50 files for performance (16-02)
- Code file detection for .js, .ts, .jsx, .tsx, .py, .go extensions (16-02)
- Event delegation for related file navigation with camera focus (16-02)
- Search matches highlighted with <mark> tags for semantic HTML (17-01)
- Case-insensitive search for better UX (17-01)
- Current match uses teal highlight, other matches use orange (17-01)
- Escape key priority updated: search -> modal -> details panel (17-01)
- Ctrl+F/Cmd+F opens search only when modal is open (17-01)
- applyIncrementalUpdate for surgical graph updates without rebuild (18-01)
- Camera position save/restore with 0ms duration for instant positioning (18-01)
- Reuse buildFileNode() for consistent node creation with parent positioning (18-01)
- storedDirectoryData updated in sync with currentGraphData for tree panel (18-01)
- Details panel closes gracefully when selected node is deleted (18-01)
- Use fx/fy/fz properties to lock node positions during incremental updates (18-02)
- 2-second delay before unfixing nodes to allow settling (18-02)
- Position new nodes within 20 units of parent with random offset (18-02)
- storedDirectoryData moved to top of file, duplicate removed (18-02)
- fadeOutAndRemoveNode() for smooth 500ms deletion animations (18-03)
- Ease-out curve with opacity fade and scale-down (0.7x) for deletions (18-03)
- Pending deletions tracking prevents duplicate fade animations (18-03)
- Mid-animation existence check handles parent directory deletions (18-03)
- Synchronized fade animations between graph and tree panel (18-03)
- Enhanced flash colors: neon green (0x00FF88), bright amber (0xFFAA00), bright red (0xFF3333) (19-01)
- Emissive glow effect pulsing with flash animation (19-01)
- Scale pulsing from 1.0x to 1.5x during animation peaks (19-01)
- Sin squared for smoother pulse peaks in flash animation (19-01)
- Different pulse patterns: created (4 quick), modified (3 steady), deleted (2 slow) (19-01)
- flashDuration and flashIntensity config variables for future adjustability (19-01)
- CSS flash animations match 3D with inset shadows and text-shadow (19-01)
- Flash duration slider range: 500ms to 5000ms, default 2000ms (19-02)
- Flash intensity slider range: 0.5x to 2x, default 1x (19-02)
- CSS custom property --flash-duration for dynamic tree animation duration (19-02)
- Persist flash settings via electron-store (flashDuration, flashIntensity keys) (19-02)
- Activity trails connect recently changed files with THREE.Line objects (20-01)
- Trail max age 60000ms (1 minute) before automatic removal (20-01)
- Maximum 20 trails shown at once to limit visual clutter (20-01)
- Trail color fades from bright cyan (#4ECDC4) to dim teal over lifetime (20-01)
- Trail opacity fades from 0.8 to 0.1 based on age ratio (20-01)
- Trails enabled by default, toggle persisted via electron-store (20-01)
- Trail duration slider range: 10s to 5min (300s), default 60s (20-02)
- LineDashedMaterial with 8:4 dash pattern for visual distinction (20-02)
- Three-phase color gradient: cyan -> teal -> dim blue-gray (20-02)
- Persist trail fade duration via electron-store (20-02)
- Follow-active camera mode defaults to off (user opts in) (21-01)
- Deleted files excluded from follow-active camera pan (21-01)
- 800ms transition for follow mode (faster than manual 1000ms) (21-01)
- Orange color theme (#FFA500) for follow toggle to distinguish from trails (21-01)
- flyToNodeSmooth() for reusable smooth camera transitions (21-01)
- Cornflower blue (#6495ED) for camera/zoom controls (21-02)
- Overview zoom calculates bounding box with 1.5x padding (21-02)
- Focus zoom at 120 units for context, Detail zoom at 40 units for inspection (21-02)
- Focus/Detail buttons disabled when no node selected (21-02)
- updateZoomButtonStates() pattern for selection-based UI state (21-02)
- 9 bookmark slots (1-9 keys) for instant access without number row clutter (22-02)
- Ctrl/Cmd+1-9 to save, plain 1-9 to jump for minimal friction (22-02)
- Gold theme (#FFD700) for bookmarks to distinguish from other features (22-02)
- Store both camera position and selected node for complete context restoration (22-02)
- Bookmark count badge shows only when >0 for clean UI (22-02)
- Navigation history with browser-style back/forward buttons (22-01)
- Max history size 50 entries to prevent memory bloat (22-01)
- Recent nodes dropdown shows last 10 unique visited nodes (22-01)
- isNavigating flag prevents duplicate entries during back/forward (22-01)
- Truncate forward history when navigating back then selecting new node (22-01)
- Cyan color theme (#4ECDC4) for navigation controls (22-01)
- Alt+Left/Right keyboard shortcuts for navigation (22-01)
- pushNavigationHistory called from showDetailsPanel (22-01)
- Navigation history persists via electron-store (22-01)
- Breadcrumb trail shows hierarchy path from project root to selected node (23-01)
- buildBreadcrumbPath parses node IDs to construct ancestor chain (23-01)
- updateBreadcrumb renders clickable segments with "/" separators (23-01)
- Breadcrumb segment clicks trigger flyToNodeSmooth + showDetailsPanel navigation (23-01)
- Teal color scheme (#4ECDC4) for clickable breadcrumb segments (23-01)
- Current node styled white and non-clickable in breadcrumb trail (23-01)
- Event delegation on breadcrumb-trail container for click handling (23-01)
- Minimap panel positioned bottom-right with z-index 100 (24-01)
- Viewport size estimation based on camera distance (0.5x for width, 0.375x for height) (24-01)
- 10% padding around node bounds for minimap boundaries (24-01)
- Continuous RAF update loop for real-time minimap synchronization (24-01)
- worldToMinimap and minimapToWorld coordinate transformation helpers (24-01)
- Click navigation uses 800ms animation, drag uses instant (0ms) positioning (24-02)
- Pointer cursor on minimap canvas with teal hover effects (24-02)
- minimapDragging flag prevents click navigation after drag (24-02)
- Global mouseup listener ensures drag ends outside canvas (24-02)
- PATH_DWELL_TIME=2000ms for 2 seconds at each waypoint (25-02)
- PATH_TRANSITION_TIME=1500ms for smooth camera transitions (25-02)
- Path loops continuously until user stops (25-02)
- Cornflower blue (#6495ED) for path button theme (25-02)
- Stop path playback on any graph click for user control (25-02)
- P key toggles path playback (25-02)

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Directory |
|---|-------------|------|-----------|
| 001 | Enhance file visualization - distinguish dirs from files, show content on click | 2026-01-23 | [001-enhance-file-visualization](./quick/001-enhance-file-visualization-distinguish-d/) |
| 002 | Add tree structure view with bidirectional graph synchronization | 2026-01-23 | [002-add-tree-structure-view](./quick/002-add-tree-structure-view-of-files-synchro/) |
| 003 | Flash animate file nodes on change with 2-second yellow pulse | 2026-01-23 | [003-flash-animate-file-nodes](./quick/003-flash-animate-file-nodes-on-change-to-re/) |
| 004 | Bidirectional flash sync: graph click flashes tree, tree click flashes graph | 2026-01-23 | [004-bidirectional-flash-sync](./quick/004-bidirectional-flash-sync-between-graph-n/) |
| 005 | Fix flash animation visibility - brighter pulsing effect | 2026-01-23 | [005-fix-flash-animation](./quick/005-fix-flash-animation-visibility-make-more/) |
| 006 | Add 2D/3D toggle switch to change graph view | 2026-01-23 | [006-add-2d-3d-toggle-switch](./quick/006-add-2d-3d-toggle-switch-to-change-graph-/) |
| 007 | Fix 2D zoom, file change detection, and color coding | 2026-01-23 | [007-fix-2d-zoom-file-change-detection-and-co](./quick/007-fix-2d-zoom-file-change-detection-and-co/) |
| 008 | Fix path error - missing sourceType in graph node building | 2026-01-23 | [008-fix-path-error-missing-sourcetype](./quick/008-fix-path-error-missing-sourcetype/) |
| 009 | Resizable divider between file tree panel and graph | 2026-01-23 | [009-resizable-panel-divider](./quick/009-resizable-panel-divider/) |
| 010 | File Tree panel open by default on startup | 2026-01-23 | [010-file-tree-open-by-default](./quick/010-file-tree-open-by-default/) |
| 011 | Fix Open in Editor not launching - missing sourceType in graph-builder | 2026-01-24 | [011-fix-open-in-editor](./quick/011-fix-double-click-and-open-in-editor-not-/) |

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 25-02-PLAN.md (path animation)
Resume file: None
Next action: Execute 25-01-PLAN.md (orbit mode) to complete Phase 25
