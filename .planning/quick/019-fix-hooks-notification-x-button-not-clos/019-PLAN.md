---
phase: quick
plan: 019
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/renderer.js
autonomous: true

must_haves:
  truths:
    - "Clicking X button dismisses hooks notification"
    - "Notification does not reappear once dismissed"
  artifacts:
    - path: "src/renderer/renderer.js"
      provides: "Working dismiss button event handler"
      contains: "hook-dismiss-btn"
  key_links:
    - from: "button#hook-dismiss-btn"
      to: "dismissHookNotification()"
      via: "click event listener"
      pattern: "addEventListener.*click.*dismissHookNotification"
---

<objective>
Fix the hooks notification X button not closing the notification

Purpose: The "Claude Code hooks not detected" notification's X close button does not dismiss the notification when clicked.

Output: Working close button that properly dismisses the notification banner
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/renderer.js (lines 7504-7540 - hook status detection section)
@src/renderer/index.html (lines 3433-3439 - notification banner HTML)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix dismiss button event listener timing</name>
  <files>src/renderer/renderer.js</files>
  <action>
The dismiss button event listener is currently attached at script load time (line 7537):

```javascript
document.getElementById('hook-dismiss-btn')?.addEventListener('click', dismissHookNotification);
```

This runs when the script executes, but if the DOM isn't fully parsed yet, the element won't be found. The fix is to wrap the event listener attachment in a DOMContentLoaded check or move it to ensure DOM is ready.

Locate the hook notification button event listeners section (around line 7536-7538) and update to:

```javascript
// Hook notification button event listeners (CSP blocks inline onclick)
// Wrap in DOMContentLoaded to ensure elements exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('hook-dismiss-btn')?.addEventListener('click', dismissHookNotification);
    document.getElementById('hook-help-btn')?.addEventListener('click', showHookHelp);
  });
} else {
  // DOM already loaded, attach immediately
  document.getElementById('hook-dismiss-btn')?.addEventListener('click', dismissHookNotification);
  document.getElementById('hook-help-btn')?.addEventListener('click', showHookHelp);
}
```

This handles both cases: if script runs before DOM is ready (wait for DOMContentLoaded) or if DOM is already loaded (attach immediately).
  </action>
  <verify>
1. Run `npm run build` to rebuild bundle.js
2. Run `npm start` to launch app
3. Wait 30 seconds for notification to appear (or don't configure hooks)
4. Click the X button - notification should dismiss
5. Verify notification stays dismissed (doesn't reappear)
  </verify>
  <done>X button successfully dismisses the hooks notification banner</done>
</task>

</tasks>

<verification>
- Build completes without errors: `npm run build`
- App launches without console errors: `npm start`
- Hooks notification X button dismisses the notification
- Dismissed state persists (notification stays hidden)
</verification>

<success_criteria>
Clicking the X close button on the "Claude Code hooks not detected" notification dismisses and hides the notification banner.
</success_criteria>

<output>
After completion, create `.planning/quick/019-fix-hooks-notification-x-button-not-clos/019-SUMMARY.md`
</output>
