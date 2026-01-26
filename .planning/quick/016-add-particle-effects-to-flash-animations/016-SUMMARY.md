---
task: 016
type: quick
description: Add particle effects to flash animations
completed: 2026-01-26
duration: 2min
subsystem: visualization
tags: [three.js, particles, animation, effects]
key-files:
  modified:
    - src/renderer/renderer.js
    - src/renderer/index.html
decisions:
  - Use THREE.Points for efficient particle rendering
  - 800ms particle lifetime with gravity and fade
  - Different burst sizes per change type
  - Particle effects toggle defaults to enabled
tech-stack:
  patterns:
    - BufferGeometry for particle positions
    - AdditiveBlending for glowing particle effect
    - Separate RAF loop for particle animation
---

# Quick Task 016: Add Particle Effects to Flash Animations Summary

**One-liner:** Particle burst system with THREE.Points emanating from nodes during flash animations, configurable via settings toggle.

## What Was Built

### Particle Burst System

**createParticleBurst(position, color, intensity, changeType)**
- Creates particle system using THREE.Points with BufferGeometry
- Particle count varies by change type:
  - Created: 20 particles (2 bursts total at 0% and 50%)
  - Modified: 20 particles (1 burst)
  - Deleted: 25 particles (1 larger burst)
  - Read: 12 particles (1 smaller burst)
- Random outward velocities using spherical coordinates
- 800ms lifetime with fade-out animation

**animateParticleBursts()**
- RAF-based animation loop for active particle systems
- Updates particle positions with velocities
- Applies gravity (-0.01 downward drift per frame)
- Fades opacity from 0.8 to 0 over lifetime
- Proper cleanup with geometry/material disposal
- Loop only runs when particles exist (performance)

### Integration with Flash Animations

**flashNodeWithType() Enhancement**
- Gets node world position for particle spawn point
- Triggers initial particle burst at flash start
- Created type: triggers second burst at 50% progress
- Starts particle animation loop if first burst
- Respects particleEffectsEnabled setting

### User Controls

**Settings Panel**
- Checkbox toggle: "Particles" after Flash Intensity slider
- Default: checked (enabled)
- Persists via electron-store
- Loads on startup in loadFlashSettings()

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

**src/renderer/renderer.js**
- Added `particleEffectsEnabled` config (default: true)
- Added `activeParticleBursts` array for tracking
- Implemented `createParticleBurst()` function
- Implemented `animateParticleBursts()` function
- Enhanced `flashNodeWithType()` to trigger bursts
- Added particle settings persistence in `loadFlashSettings()`
- Added event listener for particle effects toggle

**src/renderer/index.html**
- Added particle effects checkbox in settings panel
- Positioned after flash intensity slider
- Inline styles for label/checkbox layout

## Technical Decisions

### Use THREE.Points for Performance
THREE.Points handles many particles efficiently using a single draw call, compared to individual mesh particles which would require one draw call per particle.

### 800ms Particle Lifetime
Matches well with flash animation duration (default 2s). Particles complete before flash finishes, avoiding visual overlap.

### Gravity Effect
Subtle downward drift (-0.01 per frame) makes particles feel more natural and grounded rather than purely spherical expansion.

### AdditiveBlending
Creates glowing effect where particles overlap, matching the emissive flash animation style.

### Change Type Burst Variations
- Created: 2 bursts (celebration effect)
- Deleted: Larger burst (dramatic effect)
- Read: Smaller burst (non-intrusive acknowledgment)
- Modified: Standard burst (attention-getting)

### Separate Animation Loop
Particle animation runs in its own RAF loop independent of flash animation. This allows particles to continue even if flash completes first, and automatically pauses when no particles exist.

## Verification Results

1. Build successful - no errors
2. All particle creation logic implemented
3. Memory management with proper disposal
4. Settings persistence integrated
5. UI toggle in settings panel

## Next Steps

None required - feature complete.

## Performance Notes

- THREE.Points uses single draw call per burst (efficient)
- Animation loop only runs when particles active
- Proper geometry/material disposal prevents memory leaks
- Typical load: 1-3 active bursts simultaneously
- Each burst: 12-25 particles (low overhead)

## Related Work

- Builds on flash animation system (19-01, 19-02)
- Uses same color scheme as changeTypeColors
- Integrates with flashIntensity multiplier
- Follows pattern of trails toggle (20-01)
