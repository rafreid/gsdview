---
phase: quick-014
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .gsd-viewer/events/1737829200000-read-9eaccafbbc4fc4a4.json
  - .gsd-viewer/events/1737829201000-write-9165bcd45c8057e4.json
  - .gsd-viewer/events/1737829202000-edit-879856c18f6afec1.json
  - src/main/main.js
autonomous: true

must_haves:
  truths:
    - "Claude Code hooks fire and write events to .gsd-viewer/events/"
    - "App detects hook events and triggers flash animations"
    - "False positive 'hooks not detected' notification is prevented"
  artifacts:
    - path: "src/main/main.js"
      provides: "Improved hook detection logging"
    - path: ".gsd-viewer/events/.gitkeep"
      provides: "Clean events directory with only .gitkeep"
  key_links:
    - from: ".gsd-viewer/hooks/notify-electron.sh"
      to: ".gsd-viewer/events/"
      via: "atomic file write"
    - from: "src/main/main.js claudeEventWatcher"
      to: "renderer via IPC"
      via: "claude-operation channel"
---

<objective>
Fix the "Claude Code hooks not detected" false positive notification.

Purpose: Investigation revealed that hooks ARE working correctly - the shell script receives input, parses it successfully, and writes events. The events are being consumed by the app's chokidar watcher. The issue is likely stale sample event files and missing diagnostic logging.

Output: Clean events directory, improved diagnostic logging to help identify actual issues vs. false positives.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Key findings from investigation:
1. Hooks ARE firing - verified by .gsd-viewer/hooks/errors.log showing DEBUG INPUT with tool_name/tool_input
2. Events ARE being written - verified by events directory mtime changing
3. Events ARE being consumed - files disappear after watcher processes them
4. Old sample files with fake paths (/home/user/test.txt) exist from development

The notification shows after 30s with no Claude events, which is correct behavior but may feel like false positive if user hasn't triggered Read/Write/Edit operations.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clean up stale sample event files</name>
  <files>.gsd-viewer/events/</files>
  <action>
Remove the old sample event files from the events directory. These were created during development with fake paths like /home/user/test.txt and serve no purpose:
- 1737829200000-read-9eaccafbbc4fc4a4.json
- 1737829201000-write-9165bcd45c8057e4.json
- 1737829202000-edit-879856c18f6afec1.json

Keep only the .gitkeep file to ensure the directory is tracked by git but starts empty.
  </action>
  <verify>
```bash
ls -la .gsd-viewer/events/
# Should show only . .. and .gitkeep
```
  </verify>
  <done>Events directory contains only .gitkeep, no stale sample files</done>
</task>

<task type="auto">
  <name>Task 2: Add diagnostic logging to Claude event watcher</name>
  <files>src/main/main.js</files>
  <action>
Improve the startClaudeEventWatcher function to log more diagnostic information:

1. Log when watcher starts successfully with the path being watched
2. Log when events directory doesn't exist (already done, but ensure it's clear)
3. Log when the watcher's 'ready' event fires to confirm it's active
4. Log any watcher errors

This helps diagnose whether the issue is:
- Events directory not found (path mismatch)
- Watcher not starting
- Events not being received

Add chokidar's 'ready' and 'error' event handlers to claudeEventWatcher in startClaudeEventWatcher():

```javascript
claudeEventWatcher.on('ready', () => {
  console.log('[ClaudeEvents] Watcher ready, monitoring:', eventsPath);
});

claudeEventWatcher.on('error', (err) => {
  console.error('[ClaudeEvents] Watcher error:', err.message);
});
```
  </action>
  <verify>
```bash
# Start the app and check console output
npm run start
# Look for "[ClaudeEvents] Watcher ready" message
```
  </verify>
  <done>Claude event watcher logs ready state and errors for debugging</done>
</task>

<task type="auto">
  <name>Task 3: Verify end-to-end hook flow</name>
  <files>N/A (verification only)</files>
  <action>
Verify the complete hook flow is working:

1. Start the GSD Viewer app
2. Use Claude Code to read a file in the project (trigger a Read operation)
3. Confirm the hook fires (check .gsd-viewer/hooks/errors.log for DEBUG INPUT)
4. Confirm the app received the event (check browser console for "[ClaudeEvents] Forwarded" message)
5. Confirm the flash animation triggers (visual check or console log)

If all steps pass, the hooks are working correctly. The "not detected" notification only appears after 30s of no events, which is expected when no file operations occur.
  </action>
  <verify>
```bash
# Check hook error log after a Read operation
tail -5 .gsd-viewer/hooks/errors.log
# Should show recent DEBUG INPUT with tool_name: "Read"
```
  </verify>
  <done>End-to-end hook flow verified working - hook fires, event written, event consumed, IPC sent</done>
</task>

</tasks>

<verification>
1. Events directory is clean (only .gitkeep)
2. App starts and logs "[ClaudeEvents] Watcher ready"
3. After Claude Read/Write/Edit operation, "[ClaudeEvents] Forwarded" appears in console
4. Node flashes in the 3D graph when Claude operates on it
</verification>

<success_criteria>
- Stale sample event files removed
- Improved diagnostic logging added to main.js
- Hook flow verified working end-to-end
- No code changes needed to actual hook detection logic (it's working correctly)
</success_criteria>

<output>
After completion, create `.planning/quick/014-fix-claude-code-hooks-not-detected/014-SUMMARY.md`
</output>
