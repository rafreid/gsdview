---
quick: 012
status: complete
completed: 2026-01-25
duration: 8min
---

# Quick Task 012: Fix Setup Guide Button Summary

**Fixed CSP violation blocking inline onclick handlers**

## Root Cause

Content Security Policy (CSP) in Electron was blocking inline event handlers:
```
Refused to execute inline event handler because it violates the following
Content Security Policy directive: "script-src 'self' 'unsafe-eval'"
```

The HTML had `onclick="showHookHelp()"` which CSP blocks for security.

## Solution

Replace inline onclick handlers with proper event listeners.

### src/renderer/index.html

**Before:**
```html
<button class="notification-dismiss" onclick="dismissHookNotification()">×</button>
<button class="notification-help" onclick="showHookHelp()">Setup Guide</button>
```

**After:**
```html
<button id="hook-dismiss-btn" class="notification-dismiss">×</button>
<button id="hook-help-btn" class="notification-help">Setup Guide</button>
```

### src/renderer/renderer.js

**Before:**
```javascript
window.dismissHookNotification = dismissHookNotification;
window.showHookHelp = showHookHelp;
```

**After:**
```javascript
document.getElementById('hook-dismiss-btn')?.addEventListener('click', dismissHookNotification);
document.getElementById('hook-help-btn')?.addEventListener('click', showHookHelp);
```

## Commits

1. `93a7028` - fix(quick-012): add error handling to Setup Guide button
2. `f750f63` - fix(quick-012): replace inline onclick with event listeners (CSP fix)

## Lesson Learned

Electron's CSP blocks inline JavaScript event handlers. Always use `addEventListener()` instead of inline `onclick` attributes.
