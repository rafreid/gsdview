# Phase 7: Expanded File Scope - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the GSD Viewer to visualize both `.planning/` and `src/` directories in the graph and tree panel, with live file tracking for both. This phase adds the `src/` directory to the existing visualization — it does not change how `.planning/` is rendered.

</domain>

<decisions>
## Implementation Decisions

### Directory Grouping
- Unified tree structure with both directories under single project root
- Project folder itself serves as the root node
- Equal prominence for both `.planning/` and `src/` — siblings, same visual weight
- Natural clustering — let force simulation group nodes organically, no forced separation

### Visual Differentiation
- src/ files have different base tint: cooler tones (blue/cyan undertone)
- .planning/ files keep existing warmer tones
- src/ files use different node shapes than .planning/ files
- Extension-based colors still apply on top of the base tint

### Tree Panel Layout
- Combined tree with both directories as top-level folders
- .planning/ appears first (top), src/ second
- Both directories expanded by default on project load
- Color-coded icons in tree matching graph node colors to show directory origin

### Claude's Discretion
- Specific geometry shape for src/ files (should contrast with .planning/ diamonds)
- Exact color values for cooler tint
- Default ignored file patterns (node_modules, .git, build artifacts)
- Any performance optimizations needed for larger directory trees

</decisions>

<specifics>
## Specific Ideas

- Tree icons should visually match their graph node colors for consistency
- The unified tree should feel like a natural file explorer, not two separate views jammed together
- User already has .planning/ working well — src/ should follow the same patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-expanded-file-scope*
*Context gathered: 2026-01-23*
