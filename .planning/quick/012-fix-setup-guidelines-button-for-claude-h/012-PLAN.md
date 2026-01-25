---
quick: 012
type: bugfix
files_modified:
  - src/renderer/renderer.js
  - src/main/main.js
---

# Quick Task 012: Fix Setup Guide Button for Claude Hooks

## Problem

The "Setup Guide" button in the hook status notification banner was reported as not working.

## Investigation

Reviewed the implementation from Phase 29-02:
1. `showHookHelp()` function defined in renderer.js
2. Function exposed globally via `window.showHookHelp = showHookHelp`
3. Button in index.html has `onclick="showHookHelp()"`
4. Function calls `window.electronAPI.openExternal(url)`
5. Preload exposes `openExternal` via IPC
6. Main process has `open-external` handler calling `shell.openExternal()`

All components appear correctly wired. Issue may be:
- Silent promise rejection without error handling
- Timing issue with async call
- Missing error visibility

## Solution

Add error handling and logging to diagnose and fix:

1. Make `showHookHelp` async for proper promise handling
2. Add try/catch with console logging in renderer
3. Add try/catch with console logging in main process handler

## Tasks

- [x] Add async/await and error handling to showHookHelp()
- [x] Add logging to main process open-external handler
