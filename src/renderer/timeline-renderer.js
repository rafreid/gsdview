/**
 * Timeline Renderer
 *
 * Horizontal timeline showing GSD operations in chronological order.
 * Supports scrubbing, swimlanes by file, and pattern detection.
 */

import { state } from './state-manager.js';

// Timeline state
let timelineMounted = false;
let operations = []; // Array of { timestamp, operation, file_path }
let viewStart = null; // Timestamp for left edge of view
let viewEnd = null; // Timestamp for right edge of view
let zoomLevel = 1; // 1 = default, higher = more zoomed in
let scrubPosition = null; // Current scrub timestamp
let playbackSpeed = 1;
let isPlaying = false;
let playbackIntervalId = null;

// Constants
const OPERATION_COLORS = {
  read: '#4488FF',
  write: '#FFAA00',
  create: '#00FF88',
  delete: '#FF3333',
  edit: '#FFAA00'
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const LANE_HEIGHT = 40;
const HEADER_HEIGHT = 50;

/**
 * Mount the timeline view
 */
export function mount() {
  console.log('[TimelineRenderer] Mounting...');
  timelineMounted = true;

  // Set initial view range
  const now = Date.now();
  viewEnd = now;
  viewStart = now - (30 * 60 * 1000); // Last 30 minutes

  // Initial render
  renderTimeline();

  // Set up event listeners
  setupEventListeners();

  console.log('[TimelineRenderer] Mounted');
}

/**
 * Unmount the timeline view
 */
export function unmount() {
  console.log('[TimelineRenderer] Unmounting...');
  timelineMounted = false;

  // Stop playback if running
  if (playbackIntervalId) {
    clearInterval(playbackIntervalId);
    playbackIntervalId = null;
  }

  console.log('[TimelineRenderer] Unmounted');
}

/**
 * Record an operation
 */
export function recordOperation(data) {
  const { operation, file_path } = data;

  operations.push({
    timestamp: Date.now(),
    operation: normalizeOperation(operation),
    file_path: file_path
  });

  // Keep last 1000 operations
  if (operations.length > 1000) {
    operations = operations.slice(-1000);
  }

  // Re-render if mounted
  if (timelineMounted) {
    renderTimeline();
  }
}

/**
 * Normalize operation type
 */
function normalizeOperation(op) {
  const opLower = (op || '').toLowerCase();
  if (opLower.includes('read')) return 'read';
  if (opLower.includes('write') || opLower.includes('edit')) return 'write';
  if (opLower.includes('create') || opLower.includes('add')) return 'create';
  if (opLower.includes('delete') || opLower.includes('unlink')) return 'delete';
  return 'write';
}

/**
 * Set up mouse/touch event listeners
 */
function setupEventListeners() {
  const container = document.getElementById('timeline-canvas');
  if (!container) return;

  // Mouse wheel for zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoomLevel * delta);
  });

  // Mouse drag for panning
  let isDragging = false;
  let startX = 0;
  let startViewStart = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startViewStart = viewStart;
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const timeRange = viewEnd - viewStart;
    const pixelsPerMs = container.clientWidth / timeRange;
    const timeDelta = dx / pixelsPerMs;

    viewStart = startViewStart - timeDelta;
    viewEnd = viewStart + timeRange;

    renderTimeline();
  });

  container.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });

  container.addEventListener('mouseleave', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });

  // Click for scrubbing
  container.addEventListener('click', (e) => {
    if (isDragging) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const timeRange = viewEnd - viewStart;
    scrubPosition = viewStart + (x / container.clientWidth) * timeRange;

    renderTimeline();
    highlightFilesAtTime(scrubPosition);
  });
}

/**
 * Set zoom level
 */
export function setZoom(level) {
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));

  // Adjust view range based on zoom
  const center = (viewStart + viewEnd) / 2;
  const baseRange = 30 * 60 * 1000; // 30 minutes base
  const range = baseRange / zoomLevel;

  viewStart = center - range / 2;
  viewEnd = center + range / 2;

  if (timelineMounted) {
    renderTimeline();
  }
}

/**
 * Start/stop playback
 */
export function togglePlayback() {
  isPlaying = !isPlaying;

  if (isPlaying) {
    // Start from beginning of visible operations
    const visibleOps = operations.filter(op =>
      op.timestamp >= viewStart && op.timestamp <= viewEnd
    );

    if (visibleOps.length === 0) {
      isPlaying = false;
      return;
    }

    scrubPosition = visibleOps[0].timestamp;

    playbackIntervalId = setInterval(() => {
      scrubPosition += 1000 * playbackSpeed;

      if (scrubPosition > viewEnd) {
        stopPlayback();
        return;
      }

      renderTimeline();
      highlightFilesAtTime(scrubPosition);
    }, 100);
  } else {
    stopPlayback();
  }

  renderControls();
}

/**
 * Stop playback
 */
function stopPlayback() {
  isPlaying = false;
  if (playbackIntervalId) {
    clearInterval(playbackIntervalId);
    playbackIntervalId = null;
  }
}

/**
 * Set playback speed
 */
export function setPlaybackSpeed(speed) {
  playbackSpeed = speed;
  renderControls();
}

/**
 * Render the timeline
 */
function renderTimeline() {
  const container = document.getElementById('timeline-canvas');
  if (!container) return;

  const width = container.clientWidth || 800;
  const visibleOps = operations.filter(op =>
    op.timestamp >= viewStart && op.timestamp <= viewEnd
  );

  // Group operations by file for swimlanes
  const fileGroups = new Map();
  visibleOps.forEach(op => {
    if (!op.file_path) return;
    if (!fileGroups.has(op.file_path)) {
      fileGroups.set(op.file_path, []);
    }
    fileGroups.get(op.file_path).push(op);
  });

  const files = Array.from(fileGroups.keys());
  const height = HEADER_HEIGHT + (files.length * LANE_HEIGHT) + 20;

  // Clear and create SVG
  container.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', Math.max(height, 200));
  svg.style.display = 'block';
  svg.style.cursor = 'grab';

  // Draw time axis
  drawTimeAxis(svg, width);

  // Draw swimlanes
  files.forEach((file, index) => {
    const y = HEADER_HEIGHT + (index * LANE_HEIGHT);
    drawSwimlane(svg, file, fileGroups.get(file), y, width);
  });

  // Draw scrub line if set
  if (scrubPosition !== null && scrubPosition >= viewStart && scrubPosition <= viewEnd) {
    const x = ((scrubPosition - viewStart) / (viewEnd - viewStart)) * width;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', height);
    line.setAttribute('stroke', '#FF5555');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(line);
  }

  // Detect and highlight patterns
  highlightPatterns(svg, visibleOps, width);

  container.appendChild(svg);

  // Render controls
  renderControls();

  // Show empty state if no operations
  if (visibleOps.length === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', width / 2);
    text.setAttribute('y', 120);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#666');
    text.textContent = 'No operations in this time range';
    svg.appendChild(text);
  }
}

/**
 * Draw time axis
 */
function drawTimeAxis(svg, width) {
  const timeRange = viewEnd - viewStart;

  // Determine tick interval based on range
  let tickInterval;
  if (timeRange < 60000) tickInterval = 10000; // 10 seconds
  else if (timeRange < 300000) tickInterval = 30000; // 30 seconds
  else if (timeRange < 3600000) tickInterval = 300000; // 5 minutes
  else tickInterval = 1800000; // 30 minutes

  // Draw axis line
  const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  axisLine.setAttribute('x1', 0);
  axisLine.setAttribute('y1', HEADER_HEIGHT - 10);
  axisLine.setAttribute('x2', width);
  axisLine.setAttribute('y2', HEADER_HEIGHT - 10);
  axisLine.setAttribute('stroke', '#444');
  axisLine.setAttribute('stroke-width', '1');
  svg.appendChild(axisLine);

  // Draw ticks
  const firstTick = Math.ceil(viewStart / tickInterval) * tickInterval;

  for (let t = firstTick; t <= viewEnd; t += tickInterval) {
    const x = ((t - viewStart) / timeRange) * width;

    // Tick mark
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('y1', HEADER_HEIGHT - 15);
    tick.setAttribute('x2', x);
    tick.setAttribute('y2', HEADER_HEIGHT - 5);
    tick.setAttribute('stroke', '#666');
    tick.setAttribute('stroke-width', '1');
    svg.appendChild(tick);

    // Label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', HEADER_HEIGHT - 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#888');
    label.setAttribute('font-size', '10');
    label.textContent = formatTime(t);
    svg.appendChild(label);
  }
}

/**
 * Draw a swimlane for a file
 */
function drawSwimlane(svg, file, ops, y, width) {
  const timeRange = viewEnd - viewStart;

  // Lane background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', 0);
  bg.setAttribute('y', y);
  bg.setAttribute('width', width);
  bg.setAttribute('height', LANE_HEIGHT - 2);
  bg.setAttribute('fill', 'rgba(255,255,255,0.02)');
  svg.appendChild(bg);

  // File label
  const fileName = file.split('/').pop();
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', 5);
  label.setAttribute('y', y + LANE_HEIGHT / 2);
  label.setAttribute('dominant-baseline', 'middle');
  label.setAttribute('fill', '#888');
  label.setAttribute('font-size', '11');
  label.textContent = fileName.length > 20 ? fileName.slice(0, 17) + '...' : fileName;
  svg.appendChild(label);

  // Operation blocks
  ops.forEach(op => {
    const x = ((op.timestamp - viewStart) / timeRange) * width;

    const block = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    block.setAttribute('x', x - 4);
    block.setAttribute('y', y + 5);
    block.setAttribute('width', 8);
    block.setAttribute('height', LANE_HEIGHT - 12);
    block.setAttribute('rx', 2);
    block.setAttribute('fill', OPERATION_COLORS[op.operation] || OPERATION_COLORS.write);
    block.setAttribute('opacity', '0.8');

    // Tooltip on hover
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${op.operation} at ${formatTime(op.timestamp)}`;
    block.appendChild(title);

    svg.appendChild(block);
  });
}

/**
 * Highlight read-then-write patterns
 */
function highlightPatterns(svg, ops, width) {
  const timeRange = viewEnd - viewStart;

  // Find read-then-write sequences on same file within 10 seconds
  const patterns = [];

  ops.forEach((op, i) => {
    if (op.operation !== 'read') return;

    // Look for write on same file within next 10 seconds
    for (let j = i + 1; j < ops.length; j++) {
      const nextOp = ops[j];
      if (nextOp.file_path !== op.file_path) continue;
      if (nextOp.timestamp - op.timestamp > 10000) break;

      if (nextOp.operation === 'write' || nextOp.operation === 'create') {
        patterns.push({ read: op, write: nextOp });
        break;
      }
    }
  });

  // Draw pattern indicators
  patterns.forEach(pattern => {
    const x1 = ((pattern.read.timestamp - viewStart) / timeRange) * width;
    const x2 = ((pattern.write.timestamp - viewStart) / timeRange) * width;

    // Arc connecting read to write
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x1 + x2) / 2;
    const arcHeight = 15;
    arc.setAttribute('d', `M ${x1} 45 Q ${midX} ${45 - arcHeight} ${x2} 45`);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', 'rgba(147, 51, 234, 0.5)');
    arc.setAttribute('stroke-width', '2');
    arc.setAttribute('stroke-dasharray', '3,3');
    svg.appendChild(arc);
  });
}

/**
 * Highlight files in graph that were active at given time
 */
function highlightFilesAtTime(timestamp) {
  // Find operations within 1 second of timestamp
  const nearOps = operations.filter(op =>
    Math.abs(op.timestamp - timestamp) < 1000
  );

  // This would communicate with graph-renderer to highlight these files
  // For now, just log
  if (nearOps.length > 0) {
    console.log('[Timeline] Files at scrub position:', nearOps.map(o => o.file_path));
  }
}

/**
 * Render playback controls
 */
function renderControls() {
  const controls = document.getElementById('timeline-controls');
  if (!controls) return;

  controls.innerHTML = `
    <button class="timeline-btn ${isPlaying ? 'active' : ''}" onclick="window.toggleTimelinePlayback()">
      ${isPlaying ? '⏸️ Pause' : '▶️ Play'}
    </button>
    <select class="timeline-speed" onchange="window.setTimelineSpeed(this.value)">
      <option value="1" ${playbackSpeed === 1 ? 'selected' : ''}>1x</option>
      <option value="2" ${playbackSpeed === 2 ? 'selected' : ''}>2x</option>
      <option value="4" ${playbackSpeed === 4 ? 'selected' : ''}>4x</option>
      <option value="8" ${playbackSpeed === 8 ? 'selected' : ''}>8x</option>
    </select>
    <button class="timeline-btn" onclick="window.zoomTimelineIn()">🔍+</button>
    <button class="timeline-btn" onclick="window.zoomTimelineOut()">🔍-</button>
    <span style="color: #666; font-size: 11px; margin-left: 10px;">
      ${formatTimeRange(viewStart, viewEnd)}
    </span>
  `;

  // Expose functions globally
  window.toggleTimelinePlayback = togglePlayback;
  window.setTimelineSpeed = (speed) => setPlaybackSpeed(parseInt(speed));
  window.zoomTimelineIn = () => setZoom(zoomLevel * 1.5);
  window.zoomTimelineOut = () => setZoom(zoomLevel / 1.5);
}

/**
 * Format timestamp as time string
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format time range as string
 */
function formatTimeRange(start, end) {
  const rangeMs = end - start;
  const rangeMin = Math.round(rangeMs / 60000);

  if (rangeMin < 1) return 'Last minute';
  if (rangeMin < 60) return `Last ${rangeMin} minutes`;

  const rangeHr = Math.round(rangeMin / 60);
  return `Last ${rangeHr} hour${rangeHr > 1 ? 's' : ''}`;
}

/**
 * Get all recorded operations
 */
export function getOperations() {
  return [...operations];
}

/**
 * Clear all operations
 */
export function reset() {
  operations = [];
  scrubPosition = null;

  const now = Date.now();
  viewEnd = now;
  viewStart = now - (30 * 60 * 1000);

  if (timelineMounted) {
    renderTimeline();
  }
}
