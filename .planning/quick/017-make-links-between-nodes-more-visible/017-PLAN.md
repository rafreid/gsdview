---
phase: quick-017
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Links between nodes are clearly visible at overview zoom levels"
    - "Link colors are brighter and easier to distinguish"
    - "Links have sufficient width to be seen against dark background"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Enhanced link visibility configuration"
      contains: "linkOpacity"
  key_links:
    - from: "getLinkColor function"
      to: "linkColor callback"
      via: "returns brighter hex color without additional opacity"
---

<objective>
Make the links (edges) between nodes in the 3D graph more visible and easier to see.

Purpose: Currently links are faint due to low opacity (0.6) combined with additional 40% transparency in link colors, plus thin widths (1-3px). Users have difficulty seeing the connections between nodes, especially at overview zoom levels.

Output: Brighter, thicker, more visible links that clearly show the graph structure while maintaining visual hierarchy.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/renderer.js (lines 2625-2661, 2842-2846)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance link visibility settings</name>
  <files>src/renderer/renderer.js</files>
  <action>
Modify the link visibility configuration in renderer.js:

1. In `getLinkColor` function (around line 2626):
   - Remove the '66' suffix that adds 40% opacity to link colors
   - Return the full color from `getNodeColor(sourceNode)` without additional transparency
   - Keep the '#E74C3C' red for blocked connections unchanged

2. In `getLinkWidth` function (around line 2644):
   - Increase base widths for better visibility:
     - root: 4 (was 2.5)
     - phase: 3 (was 2)
     - plan: 2.5 (was 1.5)
     - directory: 2 (was 1)
     - default: 1.5 (was 1)
     - blocked: 4 (was 3)

3. In the Graph configuration (around line 2842-2846):
   - Change `.linkOpacity(0.6)` to `.linkOpacity(0.85)` for brighter links
   - Add `.linkCurvature(0.1)` after linkOpacity for subtle curved links (easier to see and distinguish)
   - Keep `.linkDirectionalArrowLength(3.5)` and `.linkDirectionalArrowRelPos(1)` unchanged

The curved links with higher opacity will make the graph structure much more apparent while maintaining visual hierarchy through the width differences.
  </action>
  <verify>
Run `npm start` and visually confirm:
- Links are clearly visible at overview zoom (when seeing whole graph)
- Link colors match source node colors but are brighter
- Links have a subtle curve making them easier to follow
- Thicker links from root/phase nodes create clear visual hierarchy
  </verify>
  <done>
Links between nodes are visibly brighter, thicker, and curved, making the graph structure clear at all zoom levels while maintaining hierarchy through graduated widths.
  </done>
</task>

</tasks>

<verification>
- Start app with `npm start`
- Navigate to a project with multiple levels of nodes
- Zoom out to overview level - links should be clearly visible
- Links should use node colors without extra transparency
- Curved links should be subtle but help distinguish overlapping connections
- Root and phase connections should appear thicker than file/directory links
</verification>

<success_criteria>
- Links visible at overview zoom without straining
- Link color matches source node (no faded appearance)
- Visual hierarchy maintained via link widths
- Graph structure is immediately apparent
</success_criteria>

<output>
After completion, create `.planning/quick/017-make-links-between-nodes-more-visible/017-SUMMARY.md`
</output>
