/**
 * Notification Renderer
 *
 * Smart toast notifications for significant GSD activity events.
 * Detects patterns like file creation bursts and rapid edits.
 */

// Notification settings
let settings = {
  enabled: true,
  showFileCreationBursts: true,
  showRapidActivity: true,
  showDirectoryActivity: true
};

// Activity tracking for pattern detection
let recentOperations = []; // { timestamp, operation, file_path, directory }
const BURST_WINDOW_MS = 30 * 1000; // 30 seconds
const BURST_THRESHOLD = 3; // 3+ creates in window = burst
const RAPID_WINDOW_MS = 10 * 1000; // 10 seconds
const RAPID_THRESHOLD = 5; // 5+ ops in 10s = rapid

// Active notifications
let activeNotifications = [];
let notificationId = 0;

// Cooldowns to prevent notification spam
let lastBurstNotification = 0;
let lastRapidNotification = 0;
const NOTIFICATION_COOLDOWN = 30 * 1000; // 30 seconds between similar notifications

/**
 * Initialize the notification system
 */
export function init() {
  // Create notification container if not exists
  if (!document.getElementById('notification-container')) {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 350px;
    `;
    document.body.appendChild(container);
  }

  // Load settings from localStorage
  loadSettings();

  console.log('[Notifications] Initialized');
}

/**
 * Handle incoming file operation
 */
export function onFileOperation(data) {
  if (!settings.enabled) return;

  const { operation, file_path } = data;
  if (!file_path) return;

  const directory = file_path.split('/').slice(0, -1).join('/');

  recentOperations.push({
    timestamp: Date.now(),
    operation,
    file_path,
    directory
  });

  // Clean old operations
  const cutoff = Date.now() - BURST_WINDOW_MS;
  recentOperations = recentOperations.filter(op => op.timestamp > cutoff);

  // Detect patterns
  detectPatterns();
}

/**
 * Detect activity patterns and show notifications
 */
function detectPatterns() {
  const now = Date.now();

  // Detect file creation bursts
  if (settings.showFileCreationBursts && now - lastBurstNotification > NOTIFICATION_COOLDOWN) {
    const creates = recentOperations.filter(op =>
      op.operation === 'create' &&
      op.timestamp > now - BURST_WINDOW_MS
    );

    if (creates.length >= BURST_THRESHOLD) {
      // Group by directory
      const dirCounts = new Map();
      creates.forEach(op => {
        const count = dirCounts.get(op.directory) || 0;
        dirCounts.set(op.directory, count + 1);
      });

      // Find directory with most creates
      let maxDir = null;
      let maxCount = 0;
      dirCounts.forEach((count, dir) => {
        if (count > maxCount) {
          maxCount = count;
          maxDir = dir;
        }
      });

      if (maxCount >= BURST_THRESHOLD) {
        const shortDir = maxDir.split('/').slice(-2).join('/');
        showNotification({
          type: 'burst',
          icon: '✨',
          title: 'File Creation Burst',
          message: `Claude created ${maxCount} new files in ${shortDir}`,
          color: '#00FF88'
        });
        lastBurstNotification = now;
      }
    }
  }

  // Detect rapid activity
  if (settings.showRapidActivity && now - lastRapidNotification > NOTIFICATION_COOLDOWN) {
    const rapidOps = recentOperations.filter(op =>
      op.timestamp > now - RAPID_WINDOW_MS
    );

    if (rapidOps.length >= RAPID_THRESHOLD) {
      // Group by directory
      const dirCounts = new Map();
      rapidOps.forEach(op => {
        const count = dirCounts.get(op.directory) || 0;
        dirCounts.set(op.directory, count + 1);
      });

      // Find most active directory
      let maxDir = null;
      let maxCount = 0;
      dirCounts.forEach((count, dir) => {
        if (count > maxCount) {
          maxCount = count;
          maxDir = dir;
        }
      });

      if (maxCount >= RAPID_THRESHOLD) {
        const shortDir = maxDir.split('/').slice(-2).join('/');
        showNotification({
          type: 'rapid',
          icon: '⚡',
          title: 'Rapid Activity',
          message: `Intensive work in ${shortDir}`,
          color: '#FFAA00'
        });
        lastRapidNotification = now;
      }
    }
  }
}

/**
 * Show a notification toast
 */
export function showNotification({ type, icon, title, message, color, duration = 5000 }) {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const id = ++notificationId;

  const toast = document.createElement('div');
  toast.id = `notification-${id}`;
  toast.className = `notification-toast ${type}`;
  toast.style.cssText = `
    background: rgba(26, 26, 46, 0.95);
    border: 1px solid ${color || '#4ECDC4'};
    border-left: 4px solid ${color || '#4ECDC4'};
    border-radius: 6px;
    padding: 12px 16px;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
    cursor: pointer;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">${icon}</span>
      <div style="flex: 1;">
        <div style="font-weight: bold; font-size: 13px; color: ${color || '#4ECDC4'};">${title}</div>
        <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 2px;">${message}</div>
      </div>
      <button style="background: none; border: none; color: #666; cursor: pointer; font-size: 16px;"
              onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  toast.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);

  activeNotifications.push({ id, toast });
}

/**
 * Show notification settings panel
 */
export function showSettings() {
  // Remove existing if present
  const existing = document.getElementById('notification-settings-panel');
  if (existing) {
    existing.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'notification-settings-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1a1a2e;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 20px;
    z-index: 10001;
    min-width: 300px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #4ECDC4;">Notification Settings</h3>
      <button id="close-notification-settings" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">×</button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="notif-enabled" ${settings.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
        <span style="color: white;">Enable notifications</span>
      </label>
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="notif-bursts" ${settings.showFileCreationBursts ? 'checked' : ''} style="width: 18px; height: 18px;">
        <span style="color: rgba(255,255,255,0.8);">File creation bursts</span>
      </label>
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="notif-rapid" ${settings.showRapidActivity ? 'checked' : ''} style="width: 18px; height: 18px;">
        <span style="color: rgba(255,255,255,0.8);">Rapid activity alerts</span>
      </label>
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <input type="checkbox" id="notif-directory" ${settings.showDirectoryActivity ? 'checked' : ''} style="width: 18px; height: 18px;">
        <span style="color: rgba(255,255,255,0.8);">Directory activity</span>
      </label>
    </div>
    <button id="save-notification-settings" style="
      margin-top: 20px;
      width: 100%;
      padding: 10px;
      background: rgba(78, 205, 196, 0.3);
      border: 1px solid #4ECDC4;
      border-radius: 4px;
      color: #4ECDC4;
      cursor: pointer;
      font-size: 14px;
    ">Save Settings</button>
  `;

  document.body.appendChild(panel);

  // Add overlay
  const overlay = document.createElement('div');
  overlay.id = 'notification-settings-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
  `;
  overlay.addEventListener('click', () => {
    panel.remove();
    overlay.remove();
  });
  document.body.insertBefore(overlay, panel);

  // Event handlers
  document.getElementById('close-notification-settings').addEventListener('click', () => {
    panel.remove();
    overlay.remove();
  });

  document.getElementById('save-notification-settings').addEventListener('click', () => {
    settings.enabled = document.getElementById('notif-enabled').checked;
    settings.showFileCreationBursts = document.getElementById('notif-bursts').checked;
    settings.showRapidActivity = document.getElementById('notif-rapid').checked;
    settings.showDirectoryActivity = document.getElementById('notif-directory').checked;
    saveSettings();
    panel.remove();
    overlay.remove();
    showNotification({
      type: 'info',
      icon: '✅',
      title: 'Settings Saved',
      message: 'Notification preferences updated',
      color: '#4ECDC4',
      duration: 3000
    });
  });
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem('gsdv-notification-settings');
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('[Notifications] Failed to load settings:', e);
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  try {
    localStorage.setItem('gsdv-notification-settings', JSON.stringify(settings));
  } catch (e) {
    console.error('[Notifications] Failed to save settings:', e);
  }
}

/**
 * Get current settings
 */
export function getSettings() {
  return { ...settings };
}

/**
 * Update settings programmatically
 */
export function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  saveSettings();
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
