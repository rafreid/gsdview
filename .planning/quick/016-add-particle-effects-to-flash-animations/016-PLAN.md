---
task: 016
type: quick
description: Add particle effects to flash animations
files_modified:
  - src/renderer/renderer.js
autonomous: true
---

<objective>
Add particle burst effects to flash animations when files change.

Purpose: Enhance visual feedback by adding small particles that emanate outward from nodes during flash animations, making changes more noticeable and visually appealing.

Output: Particle system integrated with existing flashNodeWithType() function that creates burst effects matching the change type color scheme.
</objective>

<context>
@.planning/STATE.md (decisions 152-160 for flash animation context)
@src/renderer/renderer.js (flashNodeWithType function at ~line 1372)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create particle burst system for flash animations</name>
  <files>src/renderer/renderer.js</files>
  <action>
Add a particle burst effect to the flash animation system:

1. Create a `createParticleBurst(nodeId, color, intensity)` function near flashNodeWithType (~line 1370):
   - Use THREE.Points with THREE.BufferGeometry for the particle system
   - Create 15-25 particles per burst (scaled by intensity)
   - Store particle velocities as random outward vectors (normalized * random speed 0.5-1.5)
   - Use THREE.PointsMaterial with size 3, transparent, opacity 0.8, color from flash color
   - Add particles to the graph scene via Graph.scene().add()
   - Track active particle systems in a `activeParticleBursts` array (similar to flashingNodes Map)

2. Create an `animateParticleBursts()` function:
   - Called from the main animation loop or its own RAF loop
   - For each particle system:
     - Update particle positions based on velocities
     - Apply gravity (slight downward drift: -0.01 per frame)
     - Fade opacity over lifetime (800ms total)
     - Remove particle system when opacity reaches 0
   - Clean up disposed particle geometries and materials

3. Integrate with flashNodeWithType:
   - Call createParticleBurst at the START of flashNodeWithType (after getting node position)
   - Pass node world position: threeObj.getWorldPosition(new THREE.Vector3())
   - Pass flashColor and flashIntensity
   - For 'created' type: trigger 2 bursts (one at start, one at 50% progress)
   - For 'modified' type: trigger 1 burst at start
   - For 'deleted' type: trigger 1 larger burst (more particles)
   - For 'read' type: trigger 1 smaller burst (fewer particles, dimmer)

4. Add particle toggle setting:
   - Add `let particleEffectsEnabled = true;` near other settings (~line 170)
   - Load from electron-store in loadPersistedSettings(): `particleEffectsEnabled = await window.electronAPI.store.get('particleEffectsEnabled') ?? true`
   - Check particleEffectsEnabled before creating bursts in flashNodeWithType

5. Add UI control for particle effects:
   - In settings panel (search for "Flash Duration" slider), add a checkbox after flash intensity:
   ```html
   <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
     <input type="checkbox" id="particle-effects-toggle" checked>
     <span>Particle Effects</span>
   </label>
   ```
   - Add event listener to toggle particleEffectsEnabled and persist to electron-store

Note: Use THREE.Points (not THREE.Sprite or mesh particles) for performance - handles many particles efficiently.
  </action>
  <verify>
    1. npm run build && npm start
    2. Open a project with files
    3. Modify a file - should see particle burst emanating from the flashing node
    4. Create a new file - should see 2 particle bursts (celebration effect)
    5. Delete a file - should see larger particle burst
    6. Toggle particle effects checkbox off - no particles should appear
    7. Check console for any errors during animations
  </verify>
  <done>
    - Particle bursts appear during flash animations matching change type colors
    - Created files show 2 bursts, modified show 1, deleted show larger burst, read shows smaller burst
    - Particles emanate outward, fade over 800ms, and clean up properly
    - Particle effects toggle in settings panel works and persists
    - No performance degradation (particles use efficient Points geometry)
  </done>
</task>

</tasks>

<verification>
- Visual: Particle bursts visible during file change flash animations
- Performance: No frame drops during particle animations (check with multiple rapid changes)
- Memory: Particle systems properly disposed (no memory leaks from accumulated geometries)
- Settings: Particle toggle persists across app restarts
</verification>

<success_criteria>
- Particle burst effects enhance flash animation visibility
- Different change types have appropriately sized/timed particle effects
- User can disable particle effects if desired
- Clean memory management with proper disposal
</success_criteria>

<output>
After completion, create `.planning/quick/016-add-particle-effects-to-flash-animations/016-SUMMARY.md`
</output>
