/**
 * Heatmap Renderer
 *
 * Treemap visualization showing file activity intensity.
 * Rectangle size represents file size, color intensity shows activity frequency.
 */

import { state } from './state-manager.js';

// Heatmap state
let heatmapMounted = false;
let activityData = new Map(); // filePath -> { count, lastActivity }
let currentPath = null; // Current directory being viewed (null = root)
let timeFilter = 'session'; // 'hour' | 'session' | 'all'
let hoveredFile = null;

// Constants
const HEAT_DECAY_MS = 30 * 60 * 1000; // 30 minutes for full decay
const COLOR_COLD = { r: 66, g: 135, b: 245 }; // Blue
const COLOR_HOT = { r: 239, g: 68, b: 68 }; // Red

/**
 * Mount the heatmap view
 */
export function mount() {
  console.log('[HeatmapRenderer] Mounting...');
  heatmapMounted = true;

  // Initial render
  renderHeatmap();

  console.log('[HeatmapRenderer] Mounted');
}

/**
 * Unmount the heatmap view
 */
export function unmount() {
  console.log('[HeatmapRenderer] Unmounting...');
  heatmapMounted = false;
  console.log('[HeatmapRenderer] Unmounted');
}

/**
 * Handle incoming file operation
 */
export function onFileOperation(data) {
  const { file_path, operation } = data;
  if (!file_path) return;

  // Update activity data
  const existing = activityData.get(file_path) || { count: 0, lastActivity: 0 };
  activityData.set(file_path, {
    count: existing.count + 1,
    lastActivity: Date.now()
  });

  // Re-render if mounted
  if (heatmapMounted) {
    renderHeatmap();
  }
}

/**
 * Set the time filter
 */
export function setTimeFilter(filter) {
  timeFilter = filter;
  if (heatmapMounted) {
    renderHeatmap();
  }
}

/**
 * Navigate into a directory
 */
export function drillDown(path) {
  currentPath = path;
  if (heatmapMounted) {
    renderHeatmap();
  }
}

/**
 * Navigate up one level
 */
export function drillUp() {
  if (!currentPath) return;

  const parts = currentPath.split('/');
  parts.pop();
  currentPath = parts.length > 0 ? parts.join('/') : null;

  if (heatmapMounted) {
    renderHeatmap();
  }
}

/**
 * Build hierarchical data from files for treemap
 */
function buildHierarchy() {
  const graphData = state.graphData;
  if (!graphData || !graphData.nodes) {
    return { name: 'root', children: [] };
  }

  // Filter to file nodes
  const fileNodes = graphData.nodes.filter(n => n.type === 'file');

  // Build tree structure
  const root = { name: 'root', children: [], path: '' };

  fileNodes.forEach(node => {
    const filePath = node.id;
    const parts = filePath.split('/').filter(p => p);

    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath += '/' + part;
      const isFile = i === parts.length - 1;

      if (isFile) {
        // Add file node
        const activity = activityData.get(filePath) || { count: 0, lastActivity: 0 };
        const heat = calculateHeat(activity);

        current.children.push({
          name: part,
          path: filePath,
          size: node.size || 1000,
          heat: heat,
          activity: activity,
          isFile: true
        });
      } else {
        // Find or create directory
        let dir = current.children.find(c => c.name === part && !c.isFile);
        if (!dir) {
          dir = { name: part, path: currentPath, children: [], isFile: false };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  });

  // If we're drilled down, find that subtree
  if (currentPath) {
    const parts = currentPath.split('/').filter(p => p);
    let current = root;
    for (const part of parts) {
      const child = current.children.find(c => c.name === part);
      if (child && child.children) {
        current = child;
      } else {
        break;
      }
    }
    return current;
  }

  return root;
}

/**
 * Calculate heat value (0-1) based on activity
 */
function calculateHeat(activity) {
  if (!activity || activity.count === 0) return 0;

  const now = Date.now();
  const age = now - activity.lastActivity;

  // Time-based decay
  const timeDecay = Math.max(0, 1 - (age / HEAT_DECAY_MS));

  // Activity count factor (log scale)
  const countFactor = Math.min(1, Math.log10(activity.count + 1) / 2);

  return (timeDecay * 0.7) + (countFactor * 0.3);
}

/**
 * Get color for heat value
 */
function getHeatColor(heat) {
  const r = Math.round(COLOR_COLD.r + (COLOR_HOT.r - COLOR_COLD.r) * heat);
  const g = Math.round(COLOR_COLD.g + (COLOR_HOT.g - COLOR_COLD.g) * heat);
  const b = Math.round(COLOR_COLD.b + (COLOR_HOT.b - COLOR_COLD.b) * heat);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Render the treemap heatmap
 */
function renderHeatmap() {
  const container = document.getElementById('heatmap-treemap');
  if (!container) return;

  const hierarchy = buildHierarchy();
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  // Clear existing
  container.innerHTML = '';

  if (!hierarchy.children || hierarchy.children.length === 0) {
    container.innerHTML = `
      <div style="color: #666; text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <div>No file data available</div>
        <div style="font-size: 12px; margin-top: 8px;">Activity will appear here as files are accessed</div>
      </div>
    `;
    return;
  }

  // Simple treemap layout (squarified algorithm)
  const items = flattenForTreemap(hierarchy, currentPath);
  const rects = squarify(items, { x: 0, y: 0, width, height });

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.display = 'block';

  rects.forEach(rect => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Rectangle
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', rect.x + 1);
    r.setAttribute('y', rect.y + 1);
    r.setAttribute('width', Math.max(0, rect.width - 2));
    r.setAttribute('height', Math.max(0, rect.height - 2));
    r.setAttribute('fill', rect.item.isFile ? getHeatColor(rect.item.heat || 0) : '#2a2a3e');
    r.setAttribute('stroke', '#1a1a2e');
    r.setAttribute('stroke-width', '1');
    r.style.cursor = 'pointer';
    r.style.transition = 'opacity 0.2s';

    // Hover effects
    r.addEventListener('mouseenter', () => {
      r.style.opacity = '0.8';
      showTooltip(rect.item, rect.x + rect.width / 2, rect.y);
    });
    r.addEventListener('mouseleave', () => {
      r.style.opacity = '1';
      hideTooltip();
    });

    // Click to drill down for directories
    if (!rect.item.isFile && rect.item.children && rect.item.children.length > 0) {
      r.addEventListener('click', () => drillDown(rect.item.path));
    }

    g.appendChild(r);

    // Label (if rect is big enough)
    if (rect.width > 40 && rect.height > 20) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', rect.x + rect.width / 2);
      text.setAttribute('y', rect.y + rect.height / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#fff');
      text.setAttribute('font-size', Math.min(14, rect.height / 3));
      text.style.pointerEvents = 'none';

      // Truncate text if needed
      let label = rect.item.name;
      if (label.length > rect.width / 8) {
        label = label.slice(0, Math.floor(rect.width / 8)) + '...';
      }
      text.textContent = label;

      g.appendChild(text);
    }

    svg.appendChild(g);
  });

  container.appendChild(svg);

  // Render breadcrumb
  renderBreadcrumb();

  // Render filter controls
  renderFilters();
}

/**
 * Flatten hierarchy for treemap layout
 */
function flattenForTreemap(node, basePath) {
  if (!node.children || node.children.length === 0) {
    return [node];
  }

  // For directories, show immediate children
  return node.children.map(child => {
    if (!child.isFile && child.children) {
      // Calculate aggregate size and heat for directories
      const stats = calculateDirStats(child);
      return {
        ...child,
        size: stats.size,
        heat: stats.avgHeat
      };
    }
    return child;
  });
}

/**
 * Calculate aggregate stats for a directory
 */
function calculateDirStats(dir) {
  let totalSize = 0;
  let totalHeat = 0;
  let fileCount = 0;

  function traverse(node) {
    if (node.isFile) {
      totalSize += node.size || 1000;
      totalHeat += node.heat || 0;
      fileCount++;
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(dir);

  return {
    size: totalSize || 1000,
    avgHeat: fileCount > 0 ? totalHeat / fileCount : 0
  };
}

/**
 * Simple squarified treemap algorithm
 */
function squarify(items, bounds) {
  if (!items || items.length === 0) return [];

  const totalSize = items.reduce((sum, item) => sum + (item.size || 1), 0);
  const scale = (bounds.width * bounds.height) / totalSize;

  const rects = [];
  let x = bounds.x;
  let y = bounds.y;
  let remainingWidth = bounds.width;
  let remainingHeight = bounds.height;

  // Sort by size descending
  const sorted = [...items].sort((a, b) => (b.size || 1) - (a.size || 1));

  sorted.forEach(item => {
    const area = (item.size || 1) * scale;

    // Decide orientation based on remaining space
    if (remainingWidth > remainingHeight) {
      // Vertical strip
      const width = area / remainingHeight;
      rects.push({ x, y, width: Math.min(width, remainingWidth), height: remainingHeight, item });
      x += width;
      remainingWidth -= width;
    } else {
      // Horizontal strip
      const height = area / remainingWidth;
      rects.push({ x, y, width: remainingWidth, height: Math.min(height, remainingHeight), item });
      y += height;
      remainingHeight -= height;
    }
  });

  return rects;
}

/**
 * Show tooltip for hovered item
 */
function showTooltip(item, x, y) {
  let tooltip = document.getElementById('heatmap-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'heatmap-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0,0,0,0.9);
      color: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 300px;
    `;
    document.body.appendChild(tooltip);
  }

  const activity = item.activity || { count: 0 };
  const heat = item.heat || 0;

  tooltip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">${item.name}</div>
    <div style="color: #888; font-size: 11px;">${item.path}</div>
    <div style="margin-top: 8px;">
      <span style="color: ${getHeatColor(heat)};">●</span>
      Activity: ${activity.count} operations
    </div>
    ${activity.lastActivity ? `<div style="color: #666; font-size: 10px;">Last: ${formatTimeAgo(activity.lastActivity)}</div>` : ''}
  `;

  const container = document.getElementById('heatmap-container');
  const containerRect = container.getBoundingClientRect();

  tooltip.style.left = (containerRect.left + x) + 'px';
  tooltip.style.top = (containerRect.top + y - 10) + 'px';
  tooltip.style.display = 'block';
}

/**
 * Hide tooltip
 */
function hideTooltip() {
  const tooltip = document.getElementById('heatmap-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

/**
 * Render breadcrumb navigation
 */
function renderBreadcrumb() {
  const breadcrumb = document.getElementById('heatmap-breadcrumb');
  if (!breadcrumb) return;

  const parts = currentPath ? currentPath.split('/').filter(p => p) : [];

  let html = `<span class="breadcrumb-item" onclick="window.heatmapDrillDown(null)">Root</span>`;

  let path = '';
  parts.forEach((part, i) => {
    path += '/' + part;
    const isLast = i === parts.length - 1;
    html += ` <span style="color: #666;">/</span> `;
    if (isLast) {
      html += `<span class="breadcrumb-item active">${part}</span>`;
    } else {
      const clickPath = path;
      html += `<span class="breadcrumb-item" onclick="window.heatmapDrillDown('${clickPath}')">${part}</span>`;
    }
  });

  breadcrumb.innerHTML = html;

  // Expose drill down globally for onclick
  window.heatmapDrillDown = (path) => {
    currentPath = path;
    renderHeatmap();
  };
}

/**
 * Render time filter controls
 */
function renderFilters() {
  const filters = document.getElementById('heatmap-filters');
  if (!filters) return;

  filters.innerHTML = `
    <button class="filter-btn ${timeFilter === 'hour' ? 'active' : ''}" onclick="window.setHeatmapFilter('hour')">Last Hour</button>
    <button class="filter-btn ${timeFilter === 'session' ? 'active' : ''}" onclick="window.setHeatmapFilter('session')">This Session</button>
    <button class="filter-btn ${timeFilter === 'all' ? 'active' : ''}" onclick="window.setHeatmapFilter('all')">All Time</button>
  `;

  window.setHeatmapFilter = setTimeFilter;
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
 * Reset heatmap data
 */
export function reset() {
  activityData.clear();
  currentPath = null;
  timeFilter = 'session';

  if (heatmapMounted) {
    renderHeatmap();
  }
}
