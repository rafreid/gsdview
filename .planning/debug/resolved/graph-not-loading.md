---
status: resolved
trigger: "Investigate issue: graph-not-loading"
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T23:30:00Z
---

## Current Focus

RESOLVED - Missing CSS `.hidden` rules for new view containers

## Symptoms

expected: View switches to graph with nodes when selecting a project folder
actual: Nothing happens when selecting folder via "Select Project" button
errors: User did not check console yet - check for errors during investigation
reproduction: npm start, then click "Select Project" and choose a folder
started: Started after v1.6 changes (dashboard, heatmap, timeline, notifications, session recording)

## Eliminated

- hypothesis: Setting state.activeView = 'graph' before switchToView('graph') caused early return
  evidence: Second fix set state.activeView = null before switchToView('graph') but user reports it still doesn't work
  timestamp: 2026-01-28T00:08:00Z

- hypothesis: Graph canvas sized to 0 because handleResize() not called in mount()
  evidence: Added handleResize() call to mount(), user reports graph still blank after testing. BUT minimap shows data, which means graph view IS active and data IS loaded.
  timestamp: 2026-01-28T00:12:00Z

- hypothesis: loadProject() doesn't switch to graph view causing blank screen
  evidence: User reports minimap shows data, which means graph-container IS visible and active. View switching is not the issue.
  timestamp: 2026-01-28T00:16:00Z

## Evidence

- timestamp: 2026-01-28T00:01:00Z
  checked: graph-renderer.js imports and structure
  found: Line 2713 runs `const container = document.getElementById('graph-container')` at module level (not in a function)
  implication: If graph-renderer.js is imported before DOM is ready, container will be null and Graph won't initialize

- timestamp: 2026-01-28T00:02:00Z
  checked: renderer.js entry point
  found: Imports graph-renderer.js immediately with `import './graph-renderer.js'`
  implication: Module-level code in graph-renderer.js runs immediately when imported

- timestamp: 2026-01-28T00:03:00Z
  checked: activity-dispatcher.js imports
  found: No circular dependencies detected between graph-renderer, activity-dispatcher, notification-renderer, session-recorder
  implication: Not a circular dependency issue

- timestamp: 2026-01-28T00:04:00Z
  checked: index.html structure
  found: graph-container element exists at line 4202, script tag at line 4430 (after DOM elements)
  implication: DOM is ready when script runs - not a timing issue

- timestamp: 2026-01-28T00:05:00Z
  checked: view-controller.js initialization (line 99)
  found: initViewSwitching() only sets state.activeView = 'graph' but NEVER calls switchToView('graph')
  implication: Graph renderer's mount() function is never called, so animation loops never start

- timestamp: 2026-01-28T00:06:00Z
  checked: graph-renderer.js mount function (line 7768)
  found: mount() starts animation loops (heat decay, trail animation, minimap) and restores selection
  implication: Without calling mount(), the graph is initialized but not active - no animations, no interactivity

- timestamp: 2026-01-28T00:07:00Z
  checked: First fix attempt - adding switchToView('graph') after state.activeView = 'graph'
  found: switchToView() has early return at line 40-43 if viewName === state.activeView
  implication: Setting state.activeView = 'graph' before calling switchToView('graph') causes early return - mount() never called

- timestamp: 2026-01-28T00:08:00Z
  checked: Second fix attempt - set state.activeView = null before switchToView('graph')
  found: User reports graph still not loading after this fix
  implication: Either switchToView('graph') is not being called, or mount() is failing silently, or mount() runs but doesn't render the graph

- timestamp: 2026-01-28T00:09:00Z
  checked: Added comprehensive logging to switchToView() in view-controller.js
  found: Logs at entry, early return, unmount, container check, mount call, and completion
  implication: Will reveal execution path when app runs

- timestamp: 2026-01-28T00:10:00Z
  checked: User reports minimap shows data but main graph is blank
  found: Minimap has its own render loop (line 7470), main graph relies on ForceGraph3D
  implication: Data is loading correctly, rendering issue is specific to main canvas

- timestamp: 2026-01-28T00:11:00Z
  checked: mount() function (line 7778) and handleResize() (line 2995)
  found: mount() starts animation loops but never calls handleResize(). Graph initialized at module load (line 2717) with container dimensions at that time. handleResize() sets Graph.width() and Graph.height().
  implication: If container was hidden or wrong size during module load, Graph has 0 or wrong dimensions and is never resized when view becomes visible

- timestamp: 2026-01-28T00:12:00Z
  checked: User verification after adding handleResize() to mount()
  found: Graph still blank, but minimap shows data correctly
  implication: handleResize() alone is not sufficient - ForceGraph3D may need explicit re-render, camera reset, or other API calls

- timestamp: 2026-01-28T00:13:00Z
  checked: loadProject() flow at line 3317
  found: loadProject() calls updateGraph(graphData) which sets Graph.graphData() and calls Graph.zoomToFit(400) after 500ms timeout
  implication: Data is being loaded into the Graph, but there's no explicit view switch to graph view

- timestamp: 2026-01-28T00:14:00Z
  checked: View initialization order
  found: At module load: (1) graph-renderer.js runs (creates Graph with empty data), (2) view-controller.js runs initViewSwitching() which switches to graph view. When user clicks "Select Project", loadProject() loads data but doesn't switch views.
  implication: If user is on a different view when they click "Select Project", the graph loads data but the view isn't switched to graph

- timestamp: 2026-01-28T00:15:00Z
  checked: loadProject() function (line 3317-3369)
  found: loadProject() calls initializeState(), buildGraphFromProject(), updateGraph() but NEVER calls switchToView('graph')
  implication: User can be on dashboard/heatmap/timeline view, click "Select Project", data loads into graph, but they're still looking at the wrong view so they see nothing

- timestamp: 2026-01-28T00:17:00Z
  checked: Reconsidered view switching hypothesis
  found: User reports minimap shows data, which means graph-container IS visible and graph view IS active
  implication: View switching is NOT the issue. Added switchToView('graph') anyway (doesn't hurt), but the real issue is ForceGraph3D canvas not rendering despite correct container visibility and data

- timestamp: 2026-01-28T00:18:00Z
  checked: Added extensive logging to handleResize() and mount()
  found: Added logs for window dimensions, panel widths, target dimensions, Graph.width()/height() return values, container element state
  implication: Next test will reveal exact canvas dimensions and whether handleResize() is actually updating the Graph correctly

## Resolution

root_cause: |
  The v1.6 update added new view containers (dashboard-container, heatmap-container, timeline-container)
  with `position: absolute` positioning that overlapped the graph-container. These containers were
  missing `.hidden` CSS rules, so when view-controller.js added the `.hidden` class to hide them,
  nothing happened - they remained visible and sat on top of the graph canvas, blocking it entirely.

  Key debugging evidence:
  - Canvas existed with correct dimensions (1091x1006)
  - WebGL context was valid (not lost)
  - Scene had 4 children, 1123 node/link meshes, all visible
  - Nodes had valid x/y/z positions (force simulation ran)
  - Manual renderer.render() wrote pixels (background color 26,26,46,255 readable)
  - BUT canvas didn't visually update on screen

  This pointed to something covering the canvas, not a WebGL/Three.js issue.

fix: |
  Added missing `.hidden` CSS rules to index.html:
  ```css
  #dashboard-container.hidden { display: none; }
  #heatmap-container.hidden { display: none; }
  #timeline-container.hidden { display: none; }
  ```

verification: User confirmed graph now renders correctly after restart
files_changed: ["src/renderer/index.html"]
commit: 906c1a7
