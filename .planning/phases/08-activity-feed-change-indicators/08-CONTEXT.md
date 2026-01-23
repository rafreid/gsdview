# Phase 8: Activity Feed & Change Indicators - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Display real-time file changes in a live activity feed with distinct visual cues for create/modify/delete operations. Users can see what's happening, click entries to navigate to nodes, and watch animations that distinguish change types. Heat maps and statistics are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Feed Panel Layout
- Bottom strip position (horizontal at bottom of window)
- Collapsible with toggle button
- Medium height showing 4-6 entries when expanded
- When collapsed: badge count + pulse animation on toggle button to indicate new activity

### Entry Content & Styling
- Standard info per entry: icon + relative path + change type + timestamp
- Relative timestamps by default ("2s ago"), absolute on hover
- Color + text label for change types: green "Created", orange "Modified", red "Deleted"

### Animation Timing
- Standard 2-second pulse duration for all change types (matches existing flash)
- Create: fade in + green pulse
- Modify: yellow/orange pulse (existing behavior)
- Delete: red pulse + gradual 2-second fade-out
- Multiple changes: staggered animations with slight delay between each

### Interaction Behavior
- Click entry: fly to node AND open details panel
- Hover entry: highlight corresponding node in graph
- Clear button to manually clear all entries
- Deleted file click: show "File no longer exists" message

### Claude's Discretion
- Rapid change grouping/collapsing approach
- Exact stagger delay timing for multiple animations
- Badge count max display (e.g., "99+")
- Entry row height and spacing
- Toggle button icon and position

</decisions>

<specifics>
## Specific Ideas

- Feed should feel like a dev tools console or VS Code output panel — informative but not distracting
- Staggered animations should create a visual "ripple" effect when multiple files change

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-activity-feed-change-indicators*
*Context gathered: 2026-01-23*
