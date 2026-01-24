---
phase: 15-structure-tree
plan: 01
subsystem: ui
tags: [parsing, markdown, javascript, json, yaml, code-structure]

# Dependency graph
requires:
  - phase: 14-diff-editor
    provides: File inspector modal foundation for displaying content
provides:
  - parseFileStructure() function that routes by file extension
  - parseMarkdownStructure() for headers, lists, code blocks
  - parseCodeStructure() for functions, classes, imports, exports
  - parseConfigStructure() for JSON/YAML nested keys
  - All items include line numbers for navigation
affects: [15-02 structure-tree-ui, file-inspector-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content parsing with line number tracking"
    - "File type detection via extension routing"
    - "Regex-based structure extraction"

key-files:
  created: []
  modified:
    - src/renderer/renderer.js

key-decisions:
  - "Use regex patterns consistent with applySyntaxHighlighting"
  - "Limit JSON recursion to depth 5 for performance"
  - "Truncate list item names at 50 characters"
  - "Track brace depth for class method scope detection"

patterns-established:
  - "Structure item format: { type, name, line, depth }"
  - "Parser routing by file extension pattern"

# Metrics
duration: 1min 16s
completed: 2026-01-24
---

# Phase 15 Plan 01: File Structure Parsing Summary

**Regex-based parsing functions extract navigable structure items (headers, functions, classes, keys) with line numbers from markdown, JS/TS, and JSON/YAML files**

## Performance

- **Duration:** 1 min 16s
- **Started:** 2026-01-24T16:28:39Z
- **Completed:** 2026-01-24T16:29:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created parseFileStructure() as main entry point with extension-based routing
- Implemented parseMarkdownStructure() extracting H1-H6 headers, list items, code blocks
- Implemented parseCodeStructure() extracting functions, classes, imports, exports with class method depth tracking
- Implemented parseConfigStructure() with JSON key path extraction and YAML indentation-based parsing
- All structure items include type, name, line number, and depth for hierarchical navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add file structure parsing functions** - `d3c27be` (feat)

## Files Created/Modified
- `src/renderer/renderer.js` - Added 6 parsing functions (parseFileStructure, parseMarkdownStructure, parseCodeStructure, parseConfigStructure, parseJSONStructure, parseYAMLStructure)

## Decisions Made
- Used regex patterns consistent with existing applySyntaxHighlighting for code consistency
- Limited JSON recursion depth to 5 levels to prevent performance issues on deeply nested files
- Truncate markdown list item names at 50 characters to keep structure tree readable
- Track JavaScript brace depth to distinguish top-level functions (depth 0) from class methods (depth 1)
- Estimate JSON key line numbers using indexOf - functional but not perfect for duplicate keys
- YAML depth calculated as indent spaces / 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Parsing functions ready for integration with structure tree UI component
- Structure items provide all data needed for tree rendering: type, name, line, depth
- Line numbers enable click-to-navigate functionality in next plan

---
*Phase: 15-structure-tree*
*Completed: 2026-01-24*
