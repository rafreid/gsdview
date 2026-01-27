---
phase: quick
plan: 022
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Hovering over nodes shows simplified tooltip with only 2 items"
    - "Tooltip displays as clean box with data only"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Simplified onNodeHover tooltip"
      contains: "onNodeHover"
  key_links:
    - from: "onNodeHover callback"
      to: "tooltip element"
      via: "DOM update"
      pattern: "tooltip"
---

<objective>
Simplify node hover tooltips to display only 2 essential items in a clean box format.

Purpose: Reduce tooltip clutter for cleaner UX - show only essential node identification info
Output: Minimalist tooltip showing node name and type only
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/renderer.js (lines 2914-2962 - onNodeHover callback)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Simplify node hover tooltip to 2 items</name>
  <files>src/renderer/renderer.js</files>
  <action>
    Modify the `.onNodeHover()` callback (around line 2914) to display only 2 items:

    1. **Node name** (bold, primary text)
    2. **Node type** with icon (Directory/File/Commit - styled in node color)

    Replace the current verbose content generation with a minimal 2-line format:
    - Line 1: Node name in bold
    - Line 2: Type icon + type label in node color

    Type mapping:
    - directory -> "folder icon Directory"
    - commit -> "memo icon Commit"
    - file (default) -> "page icon File"

    Remove all the conditional content for:
    - Extension display
    - Commit hash
    - Status/statusColor
    - Category
    - Path
    - Git status

    Keep the tooltip box styling as-is (CSS already provides clean box appearance).
    The existing approach of building content string and setting it to tooltip is fine -
    the node data is trusted internal data, not user input.
  </action>
  <verify>
    Run app with `npm start`, hover over nodes:
    - Directory nodes show: "dirname" + "folder Directory"
    - File nodes show: "filename" + "page File"
    - Commit nodes show: "commit msg" + "memo Commit"
    - No extra lines (status, path, git info)
  </verify>
  <done>
    Tooltips display exactly 2 lines: name and type with icon
  </done>
</task>

</tasks>

<verification>
- Hover over directory node: shows name + "Directory" with icon
- Hover over file node: shows name + "File" with icon
- Hover over commit node: shows name + "Commit" with icon
- Tooltip follows cursor position
- Tooltip hides when not hovering
</verification>

<success_criteria>
- Node tooltips show only 2 items (name + type)
- Clean box appearance maintained
- No extra information cluttering tooltip
</success_criteria>

<output>
After completion, create `.planning/quick/022-when-hovering-over-nodes-tip-display-2-i/022-SUMMARY.md`
</output>
