/**
 * Dashboard Renderer
 *
 * Real-time activity dashboard showing Claude's current operations,
 * session statistics, activity sparkline, and context usage estimation.
 */

import { state, subscribe } from './state-manager.js';

// Dashboard state
let dashboardMounted = false;
let sessionStartTime = null;
let sessionStats = {
  filesTouched: new Set(),
  operationCount: 0,
  reads: 0,
  writes: 0,
  creates: 0,
  deletes: 0
};
let recentOperations = [];
let sparklineData = []; // Array of {timestamp, count} for last 5 min
let contextFiles = []; // Files estimated to be in context
let currentOperation = { type: 'idle', file: null };
let updateIntervalId = null;
let sparklineIntervalId = null;

// Constants
const MAX_RECENT_OPS = 20;
const SPARKLINE_DURATION = 5 * 60 * 1000; // 5 minutes
const SPARKLINE_BUCKET_SIZE = 10 * 1000; // 10 second buckets
const CONTEXT_WINDOW_ESTIMATE = 200000; // ~200k tokens estimated
const AVG_TOKENS_PER_FILE = 2000; // Rough estimate

/**
 * Mount the dashboard view
 */
export function mount() {
  console.log('[DashboardRenderer] Mounting...');
  dashboardMounted = true;

  // Initialize session if not started
  if (!sessionStartTime) {
    sessionStartTime = Date.now();
  }

  // Start update intervals
  updateIntervalId = setInterval(updateSessionTime, 1000);
  sparklineIntervalId = setInterval(updateSparkline, SPARKLINE_BUCKET_SIZE);

  // Initial render
  renderDashboard();

  console.log('[DashboardRenderer] Mounted');
}

/**
 * Unmount the dashboard view
 */
export function unmount() {
  console.log('[DashboardRenderer] Unmounting...');
  dashboardMounted = false;

  // Clear intervals
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  if (sparklineIntervalId) {
    clearInterval(sparklineIntervalId);
    sparklineIntervalId = null;
  }

  console.log('[DashboardRenderer] Unmounted');
}

/**
 * Handle incoming Claude operation
 */
export function onClaudeOperation(data) {
  const { operation, file_path } = data;

  // Update current operation
  currentOperation = {
    type: mapOperationType(operation),
    file: file_path
  };

  // Update stats
  sessionStats.operationCount++;
  if (file_path) {
    sessionStats.filesTouched.add(file_path);
  }

  // Update operation type counts
  switch (currentOperation.type) {
    case 'read':
      sessionStats.reads++;
      break;
    case 'write':
    case 'edit':
      sessionStats.writes++;
      break;
    case 'create':
      sessionStats.creates++;
      break;
    case 'delete':
      sessionStats.deletes++;
      break;
  }

  // Add to recent operations
  recentOperations.unshift({
    type: currentOperation.type,
    file: file_path,
    timestamp: Date.now()
  });
  if (recentOperations.length > MAX_RECENT_OPS) {
    recentOperations.pop();
  }

  // Update context files
  updateContextFiles(file_path, currentOperation.type);

  // Re-render if mounted
  if (dashboardMounted) {
    renderDashboard();
  }

  // Clear current operation after delay
  setTimeout(() => {
    if (currentOperation.file === file_path) {
      currentOperation = { type: 'idle', file: null };
      if (dashboardMounted) {
        renderCurrentOperation();
      }
    }
  }, 2000);
}

/**
 * Handle file change from watcher
 */
export function onFileChanged(data) {
  const { event, path } = data;

  const type = event === 'add' ? 'create' :
               event === 'unlink' ? 'delete' : 'write';

  onClaudeOperation({
    operation: type,
    file_path: path
  });
}

/**
 * Map operation type to standard names
 */
function mapOperationType(operation) {
  const opLower = (operation || '').toLowerCase();
  if (opLower.includes('read')) return 'read';
  if (opLower.includes('write') || opLower.includes('edit')) return 'write';
  if (opLower.includes('create')) return 'create';
  if (opLower.includes('delete') || opLower.includes('unlink')) return 'delete';
  return 'write'; // Default to write
}

/**
 * Update context files estimation
 */
function updateContextFiles(filePath, opType) {
  if (!filePath) return;

  // Remove if exists (to update position)
  const existingIndex = contextFiles.findIndex(f => f.path === filePath);
  if (existingIndex >= 0) {
    contextFiles.splice(existingIndex, 1);
  }

  // Add to front (most recent)
  if (opType !== 'delete') {
    contextFiles.unshift({
      path: filePath,
      timestamp: Date.now()
    });
  }

  // Limit based on estimated context window
  const maxFiles = Math.floor(CONTEXT_WINDOW_ESTIMATE / AVG_TOKENS_PER_FILE);
  if (contextFiles.length > maxFiles) {
    contextFiles = contextFiles.slice(0, maxFiles);
  }
}

/**
 * Update session time display
 */
function updateSessionTime() {
  if (!dashboardMounted) return;

  const elapsed = Date.now() - sessionStartTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const timeDisplay = document.getElementById('stat-session-time');
  if (timeDisplay) {
    timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Update sparkline data
 */
function updateSparkline() {
  const now = Date.now();
  const cutoff = now - SPARKLINE_DURATION;

  // Count operations in current bucket
  const bucketOps = recentOperations.filter(op =>
    op.timestamp > now - SPARKLINE_BUCKET_SIZE
  ).length;

  sparklineData.push({
    timestamp: now,
    count: bucketOps
  });

  // Remove old data
  sparklineData = sparklineData.filter(d => d.timestamp > cutoff);

  if (dashboardMounted) {
    renderSparkline();
  }
}

/**
 * Render the entire dashboard
 */
function renderDashboard() {
  renderCurrentOperation();
  renderSessionStats();
  renderOperationBreakdown();
  renderSparkline();
  renderRecentOperations();
  renderContextMeter();
}

/**
 * Render current operation indicator
 */
function renderCurrentOperation() {
  const indicator = document.getElementById('current-op-indicator');
  const fileDisplay = document.getElementById('current-op-file');

  if (!indicator || !fileDisplay) return;

  // Update indicator class and content
  indicator.className = `op-${currentOperation.type}`;

  const icons = {
    idle: '💤',
    read: '📖',
    write: '✏️',
    create: '✨',
    delete: '🗑️'
  };

  const labels = {
    idle: 'Idle',
    read: 'Reading',
    write: 'Writing',
    create: 'Creating',
    delete: 'Deleting'
  };

  indicator.innerHTML = `
    <span class="op-icon">${icons[currentOperation.type] || icons.idle}</span>
    <span class="op-text">${labels[currentOperation.type] || labels.idle}</span>
  `;

  // Update file display
  if (currentOperation.file) {
    fileDisplay.textContent = currentOperation.file;
    fileDisplay.classList.add('active');
  } else {
    fileDisplay.textContent = 'No active file';
    fileDisplay.classList.remove('active');
  }
}

/**
 * Render session statistics
 */
function renderSessionStats() {
  const filesTouchedEl = document.getElementById('stat-files-touched');
  const operationsEl = document.getElementById('stat-operations');

  if (filesTouchedEl) {
    filesTouchedEl.textContent = sessionStats.filesTouched.size;
  }
  if (operationsEl) {
    operationsEl.textContent = sessionStats.operationCount;
  }
}

/**
 * Render operation breakdown pie chart
 */
function renderOperationBreakdown() {
  const canvas = document.getElementById('op-breakdown-chart');
  const legend = document.getElementById('op-breakdown-legend');

  if (!canvas || !legend) return;

  const ctx = canvas.getContext('2d');
  const { reads, writes, creates, deletes } = sessionStats;
  const total = reads + writes + creates + deletes;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    // Draw empty state
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(100, 100, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', 100, 105);
    return;
  }

  const data = [
    { label: 'Read', value: reads, color: '#4488FF' },
    { label: 'Write', value: writes, color: '#FFAA00' },
    { label: 'Create', value: creates, color: '#00FF88' },
    { label: 'Delete', value: deletes, color: '#FF3333' }
  ].filter(d => d.value > 0);

  // Draw pie chart
  let startAngle = -Math.PI / 2;

  data.forEach(segment => {
    const sliceAngle = (segment.value / total) * Math.PI * 2;

    ctx.fillStyle = segment.color;
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.arc(100, 100, 80, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Draw center circle (donut effect)
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(100, 100, 50, 0, Math.PI * 2);
  ctx.fill();

  // Draw total in center
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(total, 100, 105);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('total', 100, 125);

  // Update legend
  legend.innerHTML = data.map(d => `
    <span class="legend-item">
      <span class="legend-dot" style="background: ${d.color}"></span>
      ${d.label}: ${d.value}
    </span>
  `).join('');
}

/**
 * Render activity sparkline
 */
function renderSparkline() {
  const canvas = document.getElementById('activity-sparkline-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear
  ctx.clearRect(0, 0, width, height);

  if (sparklineData.length < 2) {
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data...', width / 2, height / 2);
    return;
  }

  // Find max value for scaling
  const maxCount = Math.max(...sparklineData.map(d => d.count), 1);

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = height - (i / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw sparkline
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth = 2;
  ctx.beginPath();

  sparklineData.forEach((point, i) => {
    const x = (i / (sparklineData.length - 1)) * width;
    const y = height - (point.count / maxCount) * (height - 10);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw fill
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
  ctx.fill();
}

/**
 * Render recent operations list
 */
function renderRecentOperations() {
  const container = document.getElementById('recent-ops-list');
  if (!container) return;

  if (recentOperations.length === 0) {
    container.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No operations yet</div>';
    return;
  }

  container.innerHTML = recentOperations.map(op => {
    const fileName = op.file ? op.file.split('/').pop() : 'Unknown';
    const timeAgo = formatTimeAgo(op.timestamp);

    return `
      <div class="recent-op-item">
        <span class="recent-op-type ${op.type}"></span>
        <span class="recent-op-file" title="${op.file || ''}">${fileName}</span>
        <span class="recent-op-time">${timeAgo}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render context window meter
 */
function renderContextMeter() {
  const bar = document.getElementById('context-bar');
  const percentage = document.getElementById('context-percentage');
  const filesList = document.getElementById('context-files-list');
  const warning = document.getElementById('context-warning');

  if (!bar || !percentage || !filesList) return;

  // Estimate context usage
  const estimatedTokens = contextFiles.length * AVG_TOKENS_PER_FILE;
  const usagePercent = Math.min((estimatedTokens / CONTEXT_WINDOW_ESTIMATE) * 100, 100);
  const maxFiles = Math.floor(CONTEXT_WINDOW_ESTIMATE / AVG_TOKENS_PER_FILE);

  bar.style.width = `${usagePercent}%`;
  percentage.textContent = `${Math.round(usagePercent)}%`;

  // Color and warning based on usage
  let warningHtml = '';
  if (usagePercent > 80) {
    bar.style.background = 'linear-gradient(90deg, #E74C3C, #C0392B)';
    percentage.style.color = '#E74C3C';
    warningHtml = '<div class="context-warning-badge">⚠️ High context usage - older files may be forgotten</div>';
  } else if (usagePercent > 50) {
    bar.style.background = 'linear-gradient(90deg, #F1C40F, #F39C12)';
    percentage.style.color = '#F1C40F';
    warningHtml = '<div class="context-warning-badge yellow">📊 Moderate context usage</div>';
  } else {
    bar.style.background = 'linear-gradient(90deg, #2ECC71, #27AE60)';
    percentage.style.color = '#2ECC71';
  }

  // Update warning if element exists
  if (warning) {
    warning.innerHTML = warningHtml;
  }

  // Show context files - most recent first
  const filesToShow = contextFiles.slice(0, 8);
  let html = '<div class="context-section-label">In Context (most recent):</div>';
  html += filesToShow.map(f => {
    const shortPath = f.path.split('/').slice(-2).join('/');
    const age = formatTimeAgo(f.timestamp);
    return `<div class="context-file">
      <span class="context-file-path">${shortPath}</span>
      <span class="context-file-age">${age}</span>
    </div>`;
  }).join('');

  // Show files that might fall out (if approaching limit)
  if (contextFiles.length > maxFiles * 0.7) {
    const atRisk = contextFiles.slice(-3); // Last 3 are oldest, might fall out
    if (atRisk.length > 0) {
      html += '<div class="context-section-label" style="margin-top: 10px; color: #E74C3C;">May fall out of context:</div>';
      html += atRisk.map(f => {
        const shortPath = f.path.split('/').slice(-2).join('/');
        return `<div class="context-file at-risk">
          <span class="context-file-path">${shortPath}</span>
          <span class="context-file-status">⚠️ oldest</span>
        </div>`;
      }).join('');
    }
  }

  if (contextFiles.length > 8) {
    html += `<div class="context-file" style="color: #666; font-style: italic;">... and ${contextFiles.length - 8} more files</div>`;
  }

  filesList.innerHTML = html;
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Reset session stats
 */
export function resetSession() {
  sessionStartTime = Date.now();
  sessionStats = {
    filesTouched: new Set(),
    operationCount: 0,
    reads: 0,
    writes: 0,
    creates: 0,
    deletes: 0
  };
  recentOperations = [];
  sparklineData = [];
  contextFiles = [];
  currentOperation = { type: 'idle', file: null };

  if (dashboardMounted) {
    renderDashboard();
  }
}
