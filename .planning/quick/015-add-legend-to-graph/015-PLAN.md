---
phase: quick
plan: 015
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/index.html
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Legend shows node shape explanations (octahedron, icosahedron, hexagon)"
    - "Legend shows flash animation colors (created, modified, deleted, read)"
    - "Legend shows source type differentiation (planning vs src)"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Enhanced populateColorLegend with shapes, flash colors, source types"
      contains: "Node Shapes"
    - path: "src/renderer/index.html"
      provides: "CSS for shape icons in legend"
      contains: "legend-shape"
  key_links:
    - from: "populateColorLegend"
      to: "legend-content"
      via: "DOM appendChild"
      pattern: "legendContent.appendChild"
---

<objective>
Enhance the existing legend panel to include visual explanations for node shapes, flash animation colors, and source type differentiation.

Purpose: Help users understand what the various visual elements in the 3D graph mean - currently the legend shows colors but not shapes or animation meanings.

Output: Enhanced legend with complete visual reference for all graph elements.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/renderer.js (lines 3212-3349 - populateColorLegend function)
@src/renderer/index.html (lines 75-169 - legend CSS)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CSS for shape icons in legend</name>
  <files>src/renderer/index.html</files>
  <action>
Add CSS styles for legend shape icons after the existing `.legend-color` styles (around line 155):

1. Add `.legend-shape` class for inline shape representations:
   - Use CSS to create simple shape approximations (diamond, circle, hexagon)
   - Width/height 14px, display inline-flex
   - Use CSS transforms and borders for shapes

2. Add `.legend-shape.diamond` for octahedron (planning files):
   - Rotated square to appear as diamond shape
   - Use border-based triangle technique or rotated box

3. Add `.legend-shape.sphere` for icosahedron (src files):
   - Simple circle (border-radius: 50%)
   - Slightly different visual from .legend-color

4. Add `.legend-shape.hexagon` for commits:
   - Use CSS clip-path for hexagon shape
   - Or use border-based approach

5. Add `.legend-flash` class for flash color indicators:
   - Similar to legend-color but with subtle glow/shadow
   - Indicates these are animated effects
  </action>
  <verify>Open index.html, confirm new CSS classes exist for legend-shape variants</verify>
  <done>CSS classes for diamond, sphere, hexagon, and flash indicators added to index.html</done>
</task>

<task type="auto">
  <name>Task 2: Enhance populateColorLegend with shapes and flash colors</name>
  <files>src/renderer/renderer.js</files>
  <action>
Modify the `populateColorLegend()` function (around line 3213) to add new sections:

1. Add "Node Shapes" section BEFORE existing "Node Types" section:
   - Planning files: Diamond shape (octahedron) - color #DDA0DD
   - Source files: Sphere shape (icosahedron) - color #7EC8E3
   - Commits: Hexagon shape (cylinder) - color #9B59B6
   - Use the new CSS shape classes for visual representation

2. Add "Source Types" section after "Node Types":
   - Planning (.planning/): Plum colors, diamond shapes
   - Source (src/): Blue tones, sphere shapes
   - Show the color differentiation between planning and src directories

3. Add "Flash Animations" section after "Git Status" section:
   - File Created: Neon green (#00FF88) - 4 quick pulses
   - File Modified: Bright amber (#FFAA00) - 3 steady pulses
   - File Deleted: Bright red (#FF3333) - 2 slow pulses then fade
   - Claude Read: Bright blue (#4488FF) - 2 quick pulses
   - Use .legend-flash class with appropriate background colors

4. Keep existing sections (Node Types, Status, File Types, Git Status) intact
  </action>
  <verify>
Run the application: `cd /home/rafreid/AFLUXSYS/products/GSDv && npm start`
Check that legend panel shows new sections for Node Shapes, Source Types, and Flash Animations
  </verify>
  <done>Legend displays all visual elements: shapes, source types, flash animations, plus existing color references</done>
</task>

</tasks>

<verification>
1. Launch application with `npm start`
2. Legend panel visible in bottom-left corner
3. Click legend header to expand if collapsed
4. Verify sections present:
   - Node Shapes (with diamond, sphere, hexagon icons)
   - Node Types (existing)
   - Source Types (planning vs src differentiation)
   - Status (existing)
   - File Types (existing)
   - Git Status (existing)
   - Flash Animations (with color indicators)
5. Each section has descriptive labels that explain what the visual element represents
</verification>

<success_criteria>
- Legend panel contains all visual element explanations
- Users can understand node shapes, colors, flash animations, and source type differences
- Existing legend functionality preserved (collapse/expand, scrolling)
- No visual regression in legend appearance
</success_criteria>

<output>
After completion, create `.planning/quick/015-add-legend-to-graph/015-SUMMARY.md`
</output>
