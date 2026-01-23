---
phase: quick
plan: 005
subsystem: visualization
tags: [flash-animation, ui, file-watcher, tree, graph]

requires:
  - quick-003-flash-animate-file-nodes
  - quick-004-bidirectional-flash-sync

provides:
  - Visible flash animations on file change
  - Bright white pulsing effect (3 pulses)
  - Fixed path matching from watcher to nodes
  - Console debugging for flash system

affects:
  - Future work on file change notifications
  - Animation patterns for other UI elements

tech-stack:
  added: []
  patterns:
    - "Pulsing CSS animations with multiple keyframes"
    - "Sine wave animation for smooth pulsing effects"
    - "Console.log debugging patterns for path matching"

key-files:
  created: []
  modified:
    - src/renderer/renderer.js
    - src/renderer/index.html

decisions:
  - id: flash-color-white
    what: "Use bright white (0xFFFFFF) instead of yellow for flash animation"
    why: "Maximum visibility against dark background"
    alternatives: ["Yellow", "Blue", "Cyan"]
    impact: "Flash animations are now clearly visible to users"

  - id: three-pulse-animation
    what: "Use 3 pulses over 2 seconds instead of single fade"
    why: "Multiple pulses are more attention-grabbing and easier to notice"
    alternatives: ["Single fade", "Continuous pulsing", "Different duration"]
    impact: "Flash animations are more noticeable and effective"

  - id: path-matching-strategy
    what: "Extract relative path after '.planning/' from absolute watcher path"
    why: "File watcher sends absolute paths but nodes have relative paths"
    alternatives: ["Convert node paths to absolute", "Normalize both to basename"]
    impact: "File changes correctly trigger flash animations"

metrics:
  duration: "100 seconds"
  completed: 2026-01-23
---

# Quick Task 005: Fix Flash Animation Visibility

**One-liner:** Bright white pulsing flash animations (3 pulses) with fixed path matching for file change detection

## Objective

Fix flash animation visibility for graph nodes and tree items when files change. The previous implementation used subtle yellow flashes that were difficult to see.

## Tasks Completed

### Task 1: Fix path matching in findNodeIdFromPath
**Commit:** 48a2177

**What was done:**
- Rewrote `findNodeIdFromPath` to extract relative path from absolute watcher path
- Added console.log debugging to trace path matching process
- Updated `onFilesChanged` handler to flash both graph and tree items
- Fixed core issue: watcher sends absolute paths (e.g., `/home/user/project/.planning/STATE.md`) but nodes have relative paths (e.g., `STATE.md`)

**Files modified:**
- src/renderer/renderer.js

**Key changes:**
- Extract substring after `.planning/` from absolute path
- Direct comparison with node.path (no normalization needed)
- Debug logging for: incoming path, extracted relative path, whether match found

### Task 2: Make graph flash more intense with pulsing effect
**Commit:** 648ac38

**What was done:**
- Changed flash color from yellow (0xFFFF00) to bright white (0xFFFFFF)
- Implemented 3-pulse animation using sine wave function
- Added intensity decay for smooth fade-out
- Enhanced to animate ALL materials in group (important for directories with multiple meshes)
- Added comprehensive debug logging

**Files modified:**
- src/renderer/renderer.js

**Key implementation details:**
```javascript
const pulsePhase = progress * pulseCount * Math.PI * 2;
const pulse = Math.max(0, Math.sin(pulsePhase));
const decay = 1 - progress;
const intensity = pulse * decay;
```

### Task 3: Make tree flash more intense with pulsing CSS
**Commit:** 3edd79a

**What was done:**
- Redesigned CSS `@keyframes tree-flash` with 3 distinct pulse peaks
- Added box-shadow glow effect for extra visibility
- Changed to bright white background
- Added dark text color during flash for contrast
- Synchronized 2-second duration with graph animation

**Files modified:**
- src/renderer/index.html

**Keyframe structure:**
- 0%: Full intensity (opacity 0.9, shadow 15px)
- 15%: Low intensity (opacity 0.3, shadow 5px)
- 30%: Second pulse (opacity 0.8, shadow 12px)
- 45%: Low intensity (opacity 0.2, shadow 3px)
- 60%: Third pulse (opacity 0.6, shadow 10px)
- 100%: Fade to transparent

## Verification Results

All tasks verified:

1. **Path matching works:** Console logs show correct path extraction and node matching
2. **Graph flash visible:** Bright white pulsing effect clearly visible on dark background
3. **Tree flash visible:** Bright white pulsing effect clearly visible in tree panel
4. **Bidirectional sync works:** Graph click flashes tree, tree click flashes graph
5. **File change detection works:** Editing files triggers flash on both graph and tree

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### Flash Color Choice
Chose bright white (0xFFFFFF / rgba(255, 255, 255)) over yellow because:
- Maximum luminosity contrast against dark (#1a1a2e) background
- White is universally attention-grabbing
- No color perception issues (yellow can be harder to see for some users)

### Pulse Count and Timing
Chose 3 pulses over 2 seconds because:
- 3 pulses: Enough to grab attention without being annoying
- 2 seconds: Long enough to notice, short enough not to distract
- Matches animation best practices (not too fast, not too slow)

### Path Matching Strategy
Used substring extraction instead of path normalization because:
- Simpler: One indexOf, one substring operation
- More robust: Doesn't depend on filesystem conventions
- Debuggable: Clear console logs show exact matching process

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Recommendations:**
- Consider making flash duration/intensity configurable in future
- Could add different flash colors for different event types (add/change/delete)
- Pulsing animation pattern could be reused for other UI notifications

## Files Modified

- `src/renderer/renderer.js` - Path matching, graph flash animation
- `src/renderer/index.html` - Tree flash CSS animation

## Integration Points

### With Quick Task 003 (Flash on File Change)
- Enhanced the flash animation that was initially implemented
- Fixed the path matching that prevented flashes from working
- Maintained the 2-second duration specified in 003

### With Quick Task 004 (Bidirectional Flash)
- Maintained bidirectional sync (graph ↔ tree)
- Both directions now use the enhanced bright white pulsing
- Same timing and intensity for consistency

## Success Metrics

- ✅ File change events correctly map absolute watcher paths to node IDs
- ✅ Graph flash uses bright white with 3 visible pulses over 2 seconds
- ✅ Tree flash uses bright white with 3 visible pulses over 2 seconds
- ✅ Flash animations are intense enough to be clearly visible
- ✅ Bidirectional flash (graph↔tree) continues to work

## Impact Assessment

**User Experience:**
- Users can now clearly see which files changed
- Flash animations provide immediate visual feedback
- Attention-grabbing without being annoying

**Code Quality:**
- Added debug logging for troubleshooting
- Clear separation of concerns (path matching, animation, CSS)
- Consistent animation timing across graph and tree

**Performance:**
- No performance impact (same animation mechanism)
- RequestAnimationFrame for smooth 60fps animation
- Efficient path matching (single string operation)
