import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';

// Color palette by node type (WCAG AA compliant against #1a1a2e background)
const nodeColors = {
  root: '#FF6B6B',       // Coral red - focal point
  phase: '#4ECDC4',      // Teal - major structure
  plan: '#45B7D1',       // Sky blue - work units
  task: '#98D8C8',       // Mint green - granular items
  requirement: '#F7DC6F', // Gold - specifications
  file: '#DDA0DD',       // Plum - source references (default for .planning/)
  directory: '#BB8FCE',  // Purple - directories (default for .planning/)
  commit: '#9B59B6'      // Purple - git commits
};

// src/ specific node colors (cooler tones for visual differentiation)
const srcNodeColors = {
  file: '#7EC8E3',       // Cool blue (vs #DDA0DD plum for planning)
  directory: '#5B9BD5'   // Steel blue (vs #BB8FCE purple for planning)
};

// File extension colors for better visual distinction
const extensionColors = {
  '.md': '#5DADE2',      // Blue - markdown
  '.js': '#F7DC6F',      // Yellow - javascript
  '.ts': '#3498DB',      // Dark blue - typescript
  '.tsx': '#3498DB',     // Dark blue - typescript react
  '.jsx': '#F7DC6F',     // Yellow - javascript react
  '.json': '#27AE60',    // Green - json
  '.html': '#E74C3C',    // Red - html
  '.css': '#9B59B6',     // Purple - css
  '.scss': '#CC6699',    // Pink - sass
  '.less': '#1D365D',    // Dark blue - less
  '.py': '#2ECC71',      // Green - python
  '.yaml': '#F39C12',    // Orange - yaml
  '.yml': '#F39C12',     // Orange - yaml
  '.toml': '#F39C12',    // Orange - toml
  '.txt': '#BDC3C7',     // Gray - text
  '.sh': '#1ABC9C',      // Teal - shell
  '.bash': '#1ABC9C',    // Teal - bash
  '.zsh': '#1ABC9C',     // Teal - zsh
  '.gitignore': '#7F8C8D', // Dark gray - git files
  '.env': '#F1C40F',     // Yellow - environment
  '.lock': '#95A5A6',    // Gray - lock files
  '.log': '#7F8C8D',     // Dark gray - logs
  '.svg': '#FF6B6B',     // Coral - svg images
  '.png': '#E91E63',     // Pink - png images
  '.jpg': '#E91E63',     // Pink - jpg images
  '.jpeg': '#E91E63',    // Pink - jpeg images
  '.gif': '#E91E63',     // Pink - gif images
  '.sql': '#336791',     // PostgreSQL blue - sql
  '.prisma': '#2D3748',  // Dark - prisma
  '.graphql': '#E10098', // GraphQL pink
  '.gql': '#E10098',     // GraphQL pink
  '.rs': '#DEA584',      // Rust orange
  '.go': '#00ADD8',      // Go cyan
  '.rb': '#CC342D',      // Ruby red
  '.java': '#B07219',    // Java orange
  '.vue': '#4FC08D',     // Vue green
  '.svelte': '#FF3E00'   // Svelte orange
};

// Status-based colors (progress visualization)
const statusColors = {
  complete: '#2ECC71',      // Green - done
  'in-progress': '#F39C12', // Yellow/Orange - active
  pending: '#95A5A6',       // Gray - not started
  blocked: '#E74C3C'        // Red - blocked
};

// Default color for unknown types
const DEFAULT_NODE_COLOR = '#888888';

// Current graph data (starts with placeholder, replaced when project is loaded)
let currentGraphData = {
  nodes: [
    { id: 'placeholder', name: 'Select a project folder', type: 'root' }
  ],
  links: []
};

// Store selected project path and state
let selectedProjectPath = null;
let currentState = null;
let selectedNode = null;
let treeData = null; // Hierarchical tree structure
let treeExpanded = new Set(); // Track expanded directories
let is3D = true; // Track current dimension mode

// Activity feed state
let activityEntries = []; // Array of {id, path, relativePath, event, timestamp, sourceType, nodeId}
let activityUnreadCount = 0; // Badge counter
const MAX_ACTIVITY_ENTRIES = 100; // Limit to prevent memory issues

// Timeline replay state
let timelinePosition = null; // null = live mode (tracking latest), number = historical timestamp
let isTimelinePlaying = false;
let playbackInterval = null;
const PLAYBACK_SPEED = 500; // ms between steps during playback

// Track nodes currently flashing (nodeId -> animation state)
const flashingNodes = new Map();

// Track currently highlighted node (for hover effect)
let highlightedNodeId = null;

// Change type colors for type-specific animations
const changeTypeColors = {
  created: 0x2ECC71,  // Green
  modified: 0xF39C12, // Orange
  deleted: 0xE74C3C   // Red
};

// Git status colors for node indicators
const gitStatusColors = {
  staged: 0x2ECC71,    // Green - ready to commit
  modified: 0xF39C12,  // Orange - uncommitted changes
  untracked: 0x9B59B6  // Purple - new untracked file
};

// Heat map configuration
const HEAT_MAX_DURATION = 300000; // 5 minutes default (ms) - time for full cool down
let heatDecayDuration = HEAT_MAX_DURATION; // User-configurable via slider

// Heat color gradient (hot to cool): red -> orange -> yellow -> normal
const heatGradient = [
  { pos: 0.0, color: 0xFF4444 },  // Hot red
  { pos: 0.3, color: 0xFF8C00 },  // Orange
  { pos: 0.6, color: 0xFFD700 },  // Yellow/gold
  { pos: 1.0, color: null }       // null = use node's original color
];

// Track heat state per node: nodeId -> { lastChangeTime, originalColor }
const nodeHeatMap = new Map();

// Format duration in seconds to human-readable string
function formatHeatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

// Load heat decay setting from store
async function loadHeatDecaySetting() {
  try {
    const saved = await window.electronAPI.store.get('heatDecaySeconds');
    if (saved && typeof saved === 'number') {
      heatDecayDuration = saved * 1000; // Convert to ms
      const slider = document.getElementById('heat-decay-slider');
      const valueDisplay = document.getElementById('heat-decay-value');
      if (slider) slider.value = saved;
      if (valueDisplay) valueDisplay.textContent = formatHeatDuration(saved);
    }
  } catch (err) {
    console.log('[Heat] Using default decay duration:', HEAT_MAX_DURATION / 1000, 'seconds');
  }
}

// Color interpolation helper for flash animation
function lerpColor(color1, color2, t) {
  const r1 = (color1 >> 16) & 0xFF, g1 = (color1 >> 8) & 0xFF, b1 = color1 & 0xFF;
  const r2 = (color2 >> 16) & 0xFF, g2 = (color2 >> 8) & 0xFF, b2 = color2 & 0xFF;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

// Calculate heat color based on time elapsed since last change
function calculateHeatColor(nodeId, originalColorHex) {
  const heatState = nodeHeatMap.get(nodeId);
  if (!heatState) return originalColorHex;

  const elapsed = Date.now() - heatState.lastChangeTime;
  const progress = Math.min(elapsed / heatDecayDuration, 1.0);

  // Find gradient segment
  for (let i = 0; i < heatGradient.length - 1; i++) {
    const start = heatGradient[i];
    const end = heatGradient[i + 1];
    if (progress >= start.pos && progress <= end.pos) {
      const segmentProgress = (progress - start.pos) / (end.pos - start.pos);
      if (end.color === null) {
        // Interpolate to original color
        return lerpColor(start.color, originalColorHex, segmentProgress);
      }
      return lerpColor(start.color, end.color, segmentProgress);
    }
  }

  return originalColorHex; // Fully cooled
}

// Apply heat color to node materials
function applyNodeHeatColor(nodeId) {
  const node = currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node || !node.__threeObj) return;

  const heatState = nodeHeatMap.get(nodeId);
  if (!heatState) return;

  // Skip if node is currently flashing (flash animation takes priority)
  if (flashingNodes.has(nodeId)) return;

  const threeObj = node.__threeObj;
  const materials = [];
  if (threeObj.material) materials.push(threeObj.material);
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  if (materials.length === 0) return;

  const heatColor = calculateHeatColor(nodeId, heatState.originalColor);
  materials.forEach(m => {
    m.color.setHex(heatColor);
  });
}

// Heat decay animation loop
let heatLoopRunning = false;
let heatLoopRafId = null;

// Start the heat decay animation loop
function startHeatDecayLoop() {
  if (heatLoopRunning) return;
  heatLoopRunning = true;

  function heatLoop() {
    if (!heatLoopRunning) return;

    const now = Date.now();
    const nodesToRemove = [];

    // Update all heated nodes
    nodeHeatMap.forEach((heatState, nodeId) => {
      const elapsed = now - heatState.lastChangeTime;

      // Remove from heat map if fully cooled
      if (elapsed >= heatDecayDuration) {
        nodesToRemove.push(nodeId);
        // Restore original color
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (node && node.__threeObj && !flashingNodes.has(nodeId)) {
          const materials = [];
          if (node.__threeObj.material) materials.push(node.__threeObj.material);
          if (node.__threeObj.children) {
            node.__threeObj.children.forEach(child => {
              if (child.material) materials.push(child.material);
            });
          }
          materials.forEach(m => m.color.setHex(heatState.originalColor));
        }
      } else {
        // Apply current heat color
        applyNodeHeatColor(nodeId);
      }
    });

    // Clean up fully cooled nodes
    nodesToRemove.forEach(id => nodeHeatMap.delete(id));

    // Continue loop if there are still heated nodes
    if (nodeHeatMap.size > 0) {
      heatLoopRafId = requestAnimationFrame(heatLoop);
    } else {
      heatLoopRunning = false;
      heatLoopRafId = null;
    }
  }

  heatLoopRafId = requestAnimationFrame(heatLoop);
}

// Stop heat decay loop (for cleanup)
function stopHeatDecayLoop() {
  heatLoopRunning = false;
  if (heatLoopRafId) {
    cancelAnimationFrame(heatLoopRafId);
    heatLoopRafId = null;
  }
}

// =====================================================
// TIMELINE REPLAY HELPER FUNCTIONS
// =====================================================

// Get timeline range from activity entries
function getTimelineRange() {
  if (activityEntries.length === 0) {
    const now = Date.now();
    return { min: now, max: now };
  }

  const timestamps = activityEntries.map(e => e.timestamp);
  return {
    min: Math.min(...timestamps),
    max: Math.max(...timestamps)
  };
}

// Update timeline UI to reflect current position
function updateTimelineUI() {
  const scrubber = document.getElementById('timeline-scrubber');
  const positionDisplay = document.getElementById('timeline-position');
  const liveIndicator = document.getElementById('timeline-live');
  const playButton = document.getElementById('timeline-play');

  if (!scrubber || !positionDisplay) return;

  const { min, max } = getTimelineRange();

  if (timelinePosition === null) {
    // Live mode
    scrubber.value = 100;
    positionDisplay.textContent = 'Live';
    if (liveIndicator) liveIndicator.classList.add('visible');
    document.body.classList.remove('timeline-historical-mode');
  } else {
    // Historical mode
    const range = max - min;
    const sliderValue = range > 0 ? ((timelinePosition - min) / range) * 100 : 100;
    scrubber.value = Math.round(sliderValue);

    // Format position time
    const date = new Date(timelinePosition);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    positionDisplay.textContent = `${hours}:${mins}:${secs}`;

    if (liveIndicator) liveIndicator.classList.remove('visible');
    document.body.classList.add('timeline-historical-mode');
  }

  // Update play button icon
  if (playButton) {
    playButton.innerHTML = isTimelinePlaying ? '&#10074;&#10074;' : '&#9658;';
    playButton.title = isTimelinePlaying ? 'Pause timeline' : 'Play timeline';
  }
}

// Set timeline to live mode
function setTimelineToLive() {
  timelinePosition = null;

  // Stop any playback
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
  }
  isTimelinePlaying = false;

  updateTimelineUI();
  updateGraphForTimeline();
  updateActivityPanelForTimeline();
}

// Placeholder for updateActivityPanelForTimeline (defined later with event handlers)
function updateActivityPanelForTimeline() {
  if (!activityEntries.length) return;

  const entries = document.querySelectorAll('.activity-entry');
  entries.forEach(entryEl => {
    const timestamp = parseInt(entryEl.dataset.timestamp, 10);
    if (timelinePosition !== null && timestamp > timelinePosition) {
      entryEl.classList.add('future');
    } else {
      entryEl.classList.remove('future');
    }
  });
}

// Update graph to show file state at current timeline position
function updateGraphForTimeline() {
  console.log('[Timeline] Updating graph for position:', timelinePosition === null ? 'LIVE' : new Date(timelinePosition).toLocaleTimeString());

  // If in live mode, restore all nodes to full opacity
  if (timelinePosition === null) {
    restoreAllNodeOpacity();
    return;
  }

  // Get file state at current timeline position
  const fileState = getFileStateAtTime(timelinePosition);

  // Update each node's opacity based on file state
  currentGraphData.nodes.forEach(node => {
    if (node.type !== 'file' || !node.__threeObj) return;

    // Build relative path key (matching activity entry format)
    let relativePath;
    if (node.sourceType === 'planning') {
      relativePath = '.planning/' + node.path;
    } else if (node.sourceType === 'src') {
      relativePath = 'src/' + node.path;
    } else {
      relativePath = node.path;
    }

    const state = fileState.get(relativePath);
    let targetOpacity = 0.85; // Default opacity for files

    if (state === undefined) {
      // File not in activity history at this time - show normally
      targetOpacity = 0.85;
    } else if (state === 'exists') {
      // File exists at this time - show normally
      targetOpacity = 0.85;
    } else if (state === 'deleted') {
      // File was deleted - show faded
      targetOpacity = 0.3;
    } else if (state === 'not-yet-created') {
      // File hasn't been created yet - show very faded
      targetOpacity = 0.1;
    }

    setNodeOpacity(node, targetOpacity);
  });
}

// Get file state map at a given timestamp
// Returns Map<relativePath, 'exists' | 'deleted' | 'not-yet-created'>
function getFileStateAtTime(timestamp) {
  const fileState = new Map();

  // Sort entries by timestamp (oldest first)
  const sortedEntries = [...activityEntries].sort((a, b) => a.timestamp - b.timestamp);

  // Track all files that have any activity
  const allFiles = new Set();
  sortedEntries.forEach(entry => allFiles.add(entry.relativePath));

  // Build state by replaying events up to timestamp
  sortedEntries.forEach(entry => {
    if (entry.timestamp > timestamp) return; // Skip future events

    const path = entry.relativePath;
    if (entry.event === 'created') {
      fileState.set(path, 'exists');
    } else if (entry.event === 'modified') {
      fileState.set(path, 'exists');
    } else if (entry.event === 'deleted') {
      fileState.set(path, 'deleted');
    }
  });

  // For files that have future activity but no state yet,
  // they haven't been created yet at this point
  allFiles.forEach(path => {
    if (!fileState.has(path)) {
      // Check if first event is after timestamp
      const firstEvent = sortedEntries.find(e => e.relativePath === path);
      if (firstEvent && firstEvent.timestamp > timestamp) {
        fileState.set(path, 'not-yet-created');
      }
    }
  });

  return fileState;
}

// Set node opacity (updates Three.js material)
function setNodeOpacity(node, opacity) {
  const threeObj = node.__threeObj;
  if (!threeObj) return;

  const materials = [];
  if (threeObj.material) materials.push(threeObj.material);
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  materials.forEach(m => {
    m.transparent = true;
    m.opacity = opacity;
  });
}

// Restore all nodes to their normal opacity
function restoreAllNodeOpacity() {
  currentGraphData.nodes.forEach(node => {
    if (node.type !== 'file' || !node.__threeObj) return;
    setNodeOpacity(node, 0.85); // Default file opacity
  });
}

// Get relative path for display in activity feed
function getRelativePath(absolutePath) {
  if (!absolutePath) return '';
  const normalized = absolutePath.replace(/\\/g, '/');

  // Check for .planning/ path
  const planningIndex = normalized.indexOf('.planning/');
  if (planningIndex !== -1) {
    return '.planning/' + normalized.substring(planningIndex + '.planning/'.length);
  }

  // Check for src/ path
  const srcIndex = normalized.indexOf('/src/');
  if (srcIndex !== -1) {
    return 'src/' + normalized.substring(srcIndex + '/src/'.length);
  }

  // Fallback: show last 2 path segments
  const parts = normalized.split('/');
  return parts.slice(-2).join('/');
}

// Add activity entry to feed
function addActivityEntry(event, filePath, sourceType) {
  const nodeId = findNodeIdFromPath(filePath);

  // Map chokidar events to user-friendly types
  const eventMap = {
    'add': 'created',
    'change': 'modified',
    'unlink': 'deleted',
    'addDir': 'created',
    'unlinkDir': 'deleted'
  };

  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    path: filePath,
    relativePath: getRelativePath(filePath),
    event: eventMap[event] || event,
    timestamp: Date.now(),
    sourceType: sourceType,
    nodeId: nodeId
  };

  // Add to front (newest first)
  activityEntries.unshift(entry);

  // Trim old entries
  if (activityEntries.length > MAX_ACTIVITY_ENTRIES) {
    activityEntries = activityEntries.slice(0, MAX_ACTIVITY_ENTRIES);
  }

  // Update badge if panel is closed
  const panel = document.getElementById('activity-panel');
  if (!panel || !panel.classList.contains('visible')) {
    activityUnreadCount++;
    updateActivityBadge();
    // Pulse the toggle button
    pulseActivityToggle();
  }

  updateActivityPanel();

  // Auto-scroll to top to show newest entry
  scrollActivityToTop();

  // Register heat state for this node
  if (entry.nodeId && entry.event !== 'deleted') {
    const node = currentGraphData.nodes.find(n => n.id === entry.nodeId);
    if (node && node.__threeObj) {
      const materials = [];
      if (node.__threeObj.material) materials.push(node.__threeObj.material);
      if (node.__threeObj.children) {
        node.__threeObj.children.forEach(child => {
          if (child.material) materials.push(child.material);
        });
      }

      // Store original color from first material
      const originalColor = materials.length > 0 ? materials[0].color.getHex() : 0xDDA0DD;

      nodeHeatMap.set(entry.nodeId, {
        lastChangeTime: Date.now(),
        originalColor: originalColor
      });

      // Start heat decay loop if not already running
      startHeatDecayLoop();
    }
  }

  // Update statistics panel if visible
  const statsPanel = document.getElementById('statistics-panel');
  if (statsPanel && statsPanel.classList.contains('visible')) {
    updateStatisticsPanel();
  }

  return entry;
}

// Pulse the activity toggle button for notification
function pulseActivityToggle() {
  const toggle = document.getElementById('activity-toggle');
  if (!toggle) return;

  toggle.classList.add('pulse');
  setTimeout(() => toggle.classList.remove('pulse'), 600);
}

// Find node ID from file path
function findNodeIdFromPath(changedPath) {
  // changedPath is absolute: /path/to/project/.planning/some/file.md
  //                     or: /path/to/project/src/components/App.js
  // node.path is relative: some/file.md (relative to .planning/ or src/)
  // node.id is prefixed: planning-file-xxx or src-file-xxx

  // Normalize path separators for cross-platform support
  const normalizedPath = changedPath.replace(/\\/g, '/');

  // Check for .planning/ path
  const planningIndex = normalizedPath.indexOf('.planning/');
  if (planningIndex !== -1) {
    const relativePath = normalizedPath.substring(planningIndex + '.planning/'.length);
    console.log('[Flash] Looking for planning node with path:', relativePath);

    // Look for node with matching path and planning sourceType
    const node = currentGraphData.nodes.find(n =>
      n.path === relativePath && n.sourceType === 'planning'
    );
    if (node) {
      console.log('[Flash] Found planning node:', node.id);
      return node.id;
    }
  }

  // Check for src/ path
  const srcIndex = normalizedPath.indexOf('/src/');
  if (srcIndex !== -1) {
    const relativePath = normalizedPath.substring(srcIndex + '/src/'.length);
    console.log('[Flash] Looking for src node with path:', relativePath);

    // Look for node with matching path and src sourceType
    const node = currentGraphData.nodes.find(n =>
      n.path === relativePath && n.sourceType === 'src'
    );
    if (node) {
      console.log('[Flash] Found src node:', node.id);
      return node.id;
    }
  }

  console.log('[Flash] No node found for path:', changedPath);
  return null;
}

// Flash a node with change-type-specific color
function flashNodeWithType(nodeId, changeType) {
  const node = currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.log('[Flash] Node not found:', nodeId);
    return;
  }

  const threeObj = node.__threeObj;
  if (!threeObj) {
    console.log('[Flash] No THREE object for node:', nodeId);
    return;
  }

  // Collect all materials to animate
  const materials = [];
  if (threeObj.material) {
    materials.push(threeObj.material);
  }
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  if (materials.length === 0) return;

  // Cancel existing animation
  if (flashingNodes.has(nodeId)) {
    const existing = flashingNodes.get(nodeId);
    if (existing.rafId) cancelAnimationFrame(existing.rafId);
  }

  const originalColors = materials.map(m => m.color.getHex());
  const flashColor = changeTypeColors[changeType] || 0xFFFFFF;

  // Animation parameters
  const duration = 2000;
  const pulseCount = 3;
  const startTime = Date.now();

  // For deleted nodes, we'll fade out at the end
  const isDelete = changeType === 'deleted';
  const originalOpacities = materials.map(m => m.opacity || 1);

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Pulsing effect
    const pulsePhase = progress * pulseCount * Math.PI * 2;
    const pulse = Math.max(0, Math.sin(pulsePhase));
    const decay = 1 - progress;
    const intensity = pulse * decay;

    materials.forEach((material, i) => {
      // Color pulse
      material.color.setHex(lerpColor(originalColors[i], flashColor, intensity));

      // For delete: fade out opacity in last 50% of animation
      if (isDelete && progress > 0.5) {
        const fadeProgress = (progress - 0.5) * 2; // 0 to 1 over second half
        material.opacity = originalOpacities[i] * (1 - fadeProgress * 0.7);
      }
    });

    if (progress < 1) {
      const rafId = requestAnimationFrame(animate);
      flashingNodes.set(nodeId, { rafId, startTime, changeType });
    } else {
      // Restore original state (or leave faded for deleted)
      materials.forEach((material, i) => {
        // After flash, apply heat color if node is heated, else original
        const heatState = nodeHeatMap.get(nodeId);
        if (heatState && !isDelete) {
          material.color.setHex(calculateHeatColor(nodeId, originalColors[i]));
        } else {
          material.color.setHex(originalColors[i]);
        }
        if (!isDelete) {
          material.opacity = originalOpacities[i];
        }
        // For deleted nodes, leave them faded as visual indicator
      });
      flashingNodes.delete(nodeId);
    }
  }

  const rafId = requestAnimationFrame(animate);
  flashingNodes.set(nodeId, { rafId, startTime, changeType });
  console.log('[Flash] Started', changeType, 'flash for:', nodeId);
}

// Flash a node when its file changes (fallback for manual flashes like tree clicks)
function flashNode(nodeId) {
  flashNodeWithType(nodeId, 'modified');
}

// Highlight a node in the graph (for hover effect from activity entries)
function highlightNodeInGraph(nodeId) {
  // Skip if already highlighted
  if (highlightedNodeId === nodeId) return;

  // Clear previous highlight
  clearNodeHighlight();

  const node = currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node || !node.__threeObj) return;

  highlightedNodeId = nodeId;

  // Store original scale and apply highlight
  const threeObj = node.__threeObj;
  if (!threeObj.userData) threeObj.userData = {};
  threeObj.userData.originalScale = threeObj.scale.clone();

  // Scale up slightly for highlight effect
  threeObj.scale.multiplyScalar(1.3);

  // Add emissive glow if material supports it
  const materials = [];
  if (threeObj.material) materials.push(threeObj.material);
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  materials.forEach(m => {
    m.userData = m.userData || {};
    m.userData.originalOpacity = m.opacity;
    m.opacity = Math.min(1, m.opacity * 1.3);
  });
}

// Clear node highlight (for mouseout from activity entries)
function clearNodeHighlight() {
  if (!highlightedNodeId) return;

  const node = currentGraphData.nodes.find(n => n.id === highlightedNodeId);
  if (node && node.__threeObj) {
    const threeObj = node.__threeObj;

    // Restore original scale
    if (threeObj.userData && threeObj.userData.originalScale) {
      threeObj.scale.copy(threeObj.userData.originalScale);
    }

    // Restore opacity
    const materials = [];
    if (threeObj.material) materials.push(threeObj.material);
    if (threeObj.children) {
      threeObj.children.forEach(child => {
        if (child.material) materials.push(child.material);
      });
    }

    materials.forEach(m => {
      if (m.userData && m.userData.originalOpacity !== undefined) {
        m.opacity = m.userData.originalOpacity;
      }
    });
  }

  highlightedNodeId = null;
}

// Flash a tree item with change-type-specific color
function flashTreeItem(nodeId, changeType = 'modified') {
  const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
  if (!treeItem) return;

  // Remove existing animation classes
  treeItem.classList.remove('tree-flash', 'tree-flash-created', 'tree-flash-modified', 'tree-flash-deleted');

  // Force reflow to restart animation
  void treeItem.offsetWidth;

  // Add type-specific animation class
  const className = `tree-flash-${changeType}`;
  treeItem.classList.add(className);

  // Remove class after animation completes
  setTimeout(() => {
    treeItem.classList.remove(className);
  }, 2000);
}

// Calculate connection count for each node
function calculateConnectionCounts(graphData) {
  const counts = {};

  graphData.nodes.forEach(node => {
    counts[node.id] = 0;
  });

  graphData.links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    counts[sourceId] = (counts[sourceId] || 0) + 1;
    counts[targetId] = (counts[targetId] || 0) + 1;
  });

  return counts;
}

// Get node size based on connection count
function getNodeSize(node, connectionCounts) {
  const connections = connectionCounts[node.id] || 0;
  const minSize = 4;
  const maxSize = 12;
  const scale = Math.min(connections / 6, 1);
  return minSize + (maxSize - minSize) * scale;
}

// Helper to apply cooler tint to a color for src/ files
function applySourceTint(hexColor, sourceType) {
  if (sourceType !== 'src') return hexColor;

  // Parse hex to RGB
  const hex = hexColor.replace('#', '');
  let r = parseInt(hex.substr(0, 2), 16);
  let g = parseInt(hex.substr(2, 2), 16);
  let b = parseInt(hex.substr(4, 2), 16);

  // Shift toward cooler tones (increase blue, decrease red slightly)
  r = Math.max(0, Math.round(r * 0.85));
  b = Math.min(255, Math.round(b * 1.15 + 20));

  // Convert back to hex
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Get git status for a file node
function getNodeGitStatus(node) {
  if (node.type !== 'file' || !node.path) return null;

  // Normalize path for comparison (git uses forward slashes)
  const normalizedPath = node.path.replace(/\\/g, '/');

  // Build full relative path based on sourceType
  let fullRelativePath;
  if (node.sourceType === 'planning') {
    fullRelativePath = '.planning/' + normalizedPath;
  } else if (node.sourceType === 'src') {
    fullRelativePath = 'src/' + normalizedPath;
  } else {
    fullRelativePath = normalizedPath;
  }

  // Check staged first (takes priority)
  if (gitStatusData.staged.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
    return 'staged';
  }
  // Check modified (unstaged changes)
  if (gitStatusData.modified.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
    return 'modified';
  }
  // Check untracked
  if (gitStatusData.untracked.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
    return 'untracked';
  }

  return null;
}

// Get node color based on type and status
function getNodeColor(node) {
  // For phases, plans, tasks, requirements - use status colors if available
  const statusTypes = ['phase', 'plan', 'task', 'requirement'];
  if (statusTypes.includes(node.type) && node.status) {
    // Check if this is the current active phase
    if (node.type === 'phase' && currentState && currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === currentState.currentPhase && node.status !== 'complete') {
        return statusColors['in-progress'];
      }
    }
    return statusColors[node.status] || nodeColors[node.type] || DEFAULT_NODE_COLOR;
  }

  // For files, use extension colors with sourceType tint
  if (node.type === 'file') {
    // Get base color from extension or default
    let baseColor = extensionColors[node.extension] || nodeColors.file;

    // Apply cooler tint for src/ files
    if (node.sourceType === 'src') {
      baseColor = applySourceTint(baseColor, 'src');
    }

    return baseColor;
  }

  // For directories, use sourceType-specific colors
  if (node.type === 'directory') {
    if (node.sourceType === 'src') {
      return srcNodeColors.directory;
    }
    return nodeColors.directory;
  }

  return nodeColors[node.type] || DEFAULT_NODE_COLOR;
}

// Get link color based on source node and link type
function getLinkColor(link, graphData) {
  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
  const targetNode = graphData.nodes.find(n => n.id === targetId);

  // Red for blocked connections
  if (link.type === 'blocked' || (targetNode && targetNode.status === 'blocked')) {
    return '#E74C3C'; // Red
  }

  if (sourceNode) {
    const baseColor = getNodeColor(sourceNode);
    return baseColor + '66'; // 40% opacity
  }
  return 'rgba(255,255,255,0.2)';
}

// Get link width based on hierarchy level and type
function getLinkWidth(link, graphData) {
  // Blocked links are thicker for visibility
  if (link.type === 'blocked') {
    return 3;
  }

  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
  if (sourceNode) {
    if (sourceNode.type === 'root') return 2.5;
    if (sourceNode.type === 'phase') return 2;
    if (sourceNode.type === 'plan') return 1.5;
    if (sourceNode.type === 'directory') return 1;
    return 1;
  }
  return 1;
}

// Initialize 3D force graph
const container = document.getElementById('graph-container');
let connectionCounts = calculateConnectionCounts(currentGraphData);

const Graph = ForceGraph3D()(container)
  .graphData(currentGraphData)
  .nodeLabel(node => {
    let label = node.name;
    if (node.status) label += ` [${node.status}]`;
    if (node.description) label += `\n${node.description}`;
    if (node.goal) label += `\n${node.goal}`;
    return label;
  })
  .nodeColor(node => getNodeColor(node))
  .nodeVal(node => getNodeSize(node, connectionCounts))
  .nodeThreeObject(node => {
    const size = getNodeSize(node, connectionCounts);
    const color = getNodeColor(node);

    // Directories: Use box/cube geometry with folder-like appearance
    if (node.type === 'directory') {
      const group = new THREE.Group();
      group.name = node.id;

      // Main folder body (slightly flattened box)
      const bodyGeometry = new THREE.BoxGeometry(size * 1.5, size * 1.2, size * 0.8);
      const bodyMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.name = node.id + '-body';

      // Folder tab (small box on top)
      const tabGeometry = new THREE.BoxGeometry(size * 0.6, size * 0.3, size * 0.8);
      const tabMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.95
      });
      const tab = new THREE.Mesh(tabGeometry, tabMaterial);
      tab.position.set(-size * 0.4, size * 0.75, 0);

      // Wireframe outline for clarity
      const edges = new THREE.EdgesGeometry(bodyGeometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);

      group.add(body);
      group.add(tab);
      group.add(wireframe);

      return group;
    }

    // Files: Different shapes based on sourceType for visual distinction
    // .planning/ files: Octahedron (diamond, 8 faces) - angular, document-like
    // src/ files: Icosahedron (20 faces) - rounder, code-like
    if (node.type === 'file') {
      let geometry;

      if (node.sourceType === 'src') {
        // src/ files: Icosahedron (20-sided, more spherical)
        geometry = new THREE.IcosahedronGeometry(size * 0.7);
      } else {
        // .planning/ files: Octahedron (diamond shape) - existing
        geometry = new THREE.OctahedronGeometry(size * 0.8);
      }

      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = node.id;

      // Add wireframe for clarity
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.3,
        transparent: true
      });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);

      // Add git status indicator ring if applicable
      const gitStatus = getNodeGitStatus(node);
      if (gitStatus && gitStatusColors[gitStatus]) {
        const ringGeometry = new THREE.RingGeometry(size * 1.1, size * 1.4, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: gitStatusColors[gitStatus],
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);

        // Store git status on the mesh for tooltip
        mesh.userData = mesh.userData || {};
        mesh.userData.gitStatus = gitStatus;

        mesh.add(ring);
      }

      return mesh;
    }

    // Current active phase: glow effect
    if (node.type === 'phase' && currentState && currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === currentState.currentPhase && node.status !== 'complete') {
        // Create glowing sphere for current phase
        const geometry = new THREE.SphereGeometry(size);
        const material = new THREE.MeshBasicMaterial({
          color: statusColors['in-progress'],
          transparent: true,
          opacity: 0.8
        });
        const sphere = new THREE.Mesh(geometry, material);

        // Add outer glow ring
        const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: statusColors['in-progress'],
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        sphere.add(ring);

        return sphere;
      }
    }

    // Commit nodes: small hexagonal shape
    if (node.type === 'commit') {
      const geometry = new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 0.4, 6);
      const material = new THREE.MeshBasicMaterial({
        color: nodeColors.commit,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = node.id;

      // Rotate to show hexagonal face
      mesh.rotation.x = Math.PI / 2;

      // Add wireframe for clarity
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.5,
        transparent: true
      });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      wireframe.rotation.x = Math.PI / 2;
      mesh.add(wireframe);

      return mesh;
    }

    // Root node: larger icosahedron
    if (node.type === 'root') {
      const geometry = new THREE.IcosahedronGeometry(size * 1.2);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
      return new THREE.Mesh(geometry, material);
    }

    return false; // Use default sphere for other types
  })
  .linkColor(link => getLinkColor(link, currentGraphData))
  .linkWidth(link => getLinkWidth(link, currentGraphData))
  .linkOpacity(0.6)
  .linkDirectionalArrowLength(3.5)
  .linkDirectionalArrowRelPos(1)
  .backgroundColor('#1a1a2e')
  .showNavInfo(false)
  // Click-to-fly navigation
  .onNodeClick(node => {
    // Calculate distance based on node size for optimal viewing
    const distance = 50 + getNodeSize(node, connectionCounts) * 4;

    // Animate camera to node position
    if (is3D) {
      // 3D mode: calculate position relative to node position
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      Graph.cameraPosition(
        {
          x: (node.x || 0) * distRatio,
          y: (node.y || 0) * distRatio,
          z: (node.z || 0) * distRatio
        },
        node, // lookAt target
        1000 // transition duration ms
      );
    } else {
      // 2D mode: position camera above the node looking down
      Graph.cameraPosition(
        { x: node.x || 0, y: node.y || 0, z: distance + 100 },
        node,
        1000
      );
    }

    // Show details panel
    showDetailsPanel(node);
  })
  // Hover tooltips
  .onNodeHover(node => {
    const tooltip = document.getElementById('tooltip');
    if (node) {
      let content = `<strong>${node.name}</strong><br>`;
      content += `<span style="color: ${getNodeColor(node)}; text-transform: capitalize;">`;

      // Show type with icon
      if (node.type === 'directory') {
        content += '📁 Directory';
      } else if (node.type === 'file') {
        content += '📄 File';
        if (node.extension) {
          content += ` (${node.extension})`;
        }
      } else if (node.type === 'commit') {
        content += '📝 Commit';
        if (node.hash) {
          content += `<br><code style="font-family: monospace;">${node.hash.substring(0, 7)}</code>`;
        }
      } else {
        content += `Type: ${node.type}`;
      }
      content += '</span>';

      if (node.status) {
        const statusColor = statusColors[node.status] || '#888';
        content += `<br><span style="color: ${statusColor}">Status: ${node.status}</span>`;
      }
      if (node.category) content += `<br>Category: ${node.category}`;
      if (node.path) content += `<br><span style="color: #888; font-size: 10px;">${node.path}</span>`;

      // Show git status in tooltip
      const gitStatus = getNodeGitStatus(node);
      if (gitStatus) {
        const statusColor = '#' + gitStatusColors[gitStatus].toString(16).padStart(6, '0');
        const statusLabel = gitStatus === 'staged' ? 'Staged' :
                            gitStatus === 'modified' ? 'Modified (uncommitted)' :
                            'Untracked';
        content += `<br><span style="color: ${statusColor}">Git: ${statusLabel}</span>`;
      }

      tooltip.innerHTML = content;
      tooltip.classList.add('visible');
      container.style.cursor = 'pointer';
    } else {
      tooltip.classList.remove('visible');
      container.style.cursor = 'grab';
    }
  });

// Handle window resize
function handleResize() {
  const toolbar = document.getElementById('toolbar');
  const toolbarHeight = toolbar ? toolbar.offsetHeight : 50;
  const treePanel = document.getElementById('tree-panel');
  const treeWidth = treePanel && treePanel.classList.contains('visible') ? 280 : 0;
  const activityPanel = document.getElementById('activity-panel');
  const activityHeight = activityPanel && activityPanel.classList.contains('visible') ? 180 : 0;
  const statisticsPanel = document.getElementById('statistics-panel');
  const statisticsWidth = statisticsPanel && statisticsPanel.classList.contains('visible') ? 320 : 0;
  Graph.width(window.innerWidth - treeWidth - statisticsWidth);
  Graph.height(window.innerHeight - toolbarHeight - activityHeight);
}

window.addEventListener('resize', handleResize);
handleResize();

// Build graph from parsed project data
function buildGraphFromProject(projectData) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Store state for coloring
  if (projectData.state) {
    currentState = projectData.state;
  }

  function addNode(node) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
      nodes.push(node);
    }
    return nodeMap.get(node.id);
  }

  function addLink(source, target, type = 'default') {
    links.push({ source, target, type });
  }

  // Add project root
  const projectNode = addNode({
    id: 'project-root',
    name: 'Project',
    type: 'root'
  });

  // Process phases from roadmap
  const { roadmap } = projectData;
  if (roadmap && roadmap.phases) {
    for (const phase of roadmap.phases) {
      const phaseNode = addNode({
        id: phase.id,
        name: `Phase ${phase.number}: ${phase.name}`,
        type: 'phase',
        status: phase.status,
        goal: phase.goal
      });

      addLink(projectNode.id, phaseNode.id, 'contains');

      if (phase.plans) {
        for (const plan of phase.plans) {
          const planNode = addNode({
            id: plan.id,
            name: plan.name,
            type: 'plan',
            status: plan.status,
            description: plan.description,
            file: plan.file
          });

          addLink(phaseNode.id, planNode.id, 'contains');
        }
      }
    }
  }

  // Process requirements
  const { requirements } = projectData;
  if (requirements && requirements.requirements) {
    for (const req of requirements.requirements) {
      const reqNode = addNode({
        id: req.id,
        name: req.code,
        type: 'requirement',
        status: req.status,
        description: req.description,
        category: req.category
      });

      // Link requirement to its phase
      if (requirements.phaseMapping && requirements.phaseMapping[req.code]) {
        const phaseNum = requirements.phaseMapping[req.code];
        const phaseId = `phase-${phaseNum}`;
        if (nodeMap.has(phaseId)) {
          addLink(reqNode.id, phaseId, 'maps-to');
        }
      }
    }
  }

  // Process directory structure
  const { directory } = projectData;
  if (directory && directory.nodes) {
    // Store directory data for tree building
    storedDirectoryData = directory;

    for (const dirNode of directory.nodes) {
      addNode({
        id: dirNode.id,
        name: dirNode.name,
        type: dirNode.type, // 'directory' or 'file'
        path: dirNode.path,
        extension: dirNode.extension,
        sourceType: dirNode.sourceType
      });
    }

    for (const link of directory.links) {
      addLink(link.source, link.target, 'contains');
    }

    // Link .planning root to project
    if (nodeMap.has('dir-planning')) {
      addLink(projectNode.id, 'dir-planning', 'contains');
    }
  }

  // Process git commits
  if (gitCommitsData && gitCommitsData.length > 0) {
    // Add git commits parent node
    const gitNode = addNode({
      id: 'git-commits',
      name: 'Recent Commits',
      type: 'directory',  // Use directory type for grouping
      description: `Last ${gitCommitsData.length} commits`
    });

    // Link to project root
    addLink(projectNode.id, gitNode.id, 'contains');

    // Add individual commit nodes
    gitCommitsData.forEach((commit, index) => {
      const commitNode = addNode({
        id: `commit-${commit.hash}`,
        name: commit.hash.substring(0, 7),
        type: 'commit',
        description: commit.message,
        hash: commit.hash,
        fullMessage: commit.message
      });

      addLink(gitNode.id, commitNode.id, 'contains');
    });
  }

  // Add blocker links if any
  const { state } = projectData;
  if (state && state.blockers && state.blockers.length > 0) {
    for (const blocker of state.blockers) {
      // Add blocker as a node
      const blockerNode = addNode({
        id: blocker.id,
        name: `Blocker: ${blocker.description.substring(0, 30)}...`,
        type: 'blocker',
        status: 'blocked',
        description: blocker.description
      });

      // Link blocker to current phase
      if (state.currentPhase) {
        const currentPhaseId = `phase-${state.currentPhase}`;
        if (nodeMap.has(currentPhaseId)) {
          addLink(blockerNode.id, currentPhaseId, 'blocked');
        }
      }
    }
  }

  return { nodes, links };
}

// Update graph with new data
function updateGraph(graphData) {
  currentGraphData = graphData;
  connectionCounts = calculateConnectionCounts(graphData);

  Graph
    .graphData(graphData)
    .nodeColor(node => getNodeColor(node))
    .nodeVal(node => getNodeSize(node, connectionCounts))
    .linkColor(link => getLinkColor(link, graphData))
    .linkWidth(link => getLinkWidth(link, graphData));

  // Zoom to fit after data update
  setTimeout(() => {
    Graph.zoomToFit(400);
  }, 500);

  // Build and update tree panel
  if (storedDirectoryData) {
    treeData = buildTreeStructure(storedDirectoryData);
    // Auto-expand root and both top-level directories (.planning and src)
    if (treeData && treeData.length > 0) {
      treeExpanded.add(treeData[0].id);  // Project root
      // Expand children (should be .planning and src)
      if (treeData[0].children) {
        treeData[0].children.forEach(child => {
          treeExpanded.add(child.id);
        });
      }
    }
    updateTreePanel();
  }
}

// Load project and update graph
async function loadProject(projectPath) {
  if (!window.electronAPI || !window.electronAPI.parseProject) {
    console.error('electronAPI.parseProject not available');
    return;
  }

  console.log('Loading project:', projectPath);
  document.getElementById('selected-path').textContent = 'Loading...';

  try {
    const projectData = await window.electronAPI.parseProject(projectPath);

    if (projectData.error) {
      console.error('Error loading project:', projectData.error);
      document.getElementById('selected-path').textContent = `Error: ${projectData.error}`;
      return;
    }

    console.log('Project data loaded:', projectData);

    // Fetch git data before building graph so commit nodes can be added
    await fetchGitStatus(projectPath);
    await fetchGitBranch(projectPath);
    await fetchGitCommits(projectPath, 10);

    const graphData = buildGraphFromProject(projectData);
    console.log('Graph built:', graphData.nodes.length, 'nodes,', graphData.links.length, 'links');

    updateGraph(graphData);

    document.getElementById('selected-path').textContent = projectPath;
    selectedProjectPath = projectPath;

    // Start file watching
    if (window.electronAPI && window.electronAPI.startWatching) {
      await window.electronAPI.startWatching(projectPath);
    }

    // Add to recent projects
    if (window.electronAPI && window.electronAPI.addRecentProject) {
      await window.electronAPI.addRecentProject(projectPath);
      updateRecentProjects();
    }

  } catch (error) {
    console.error('Error loading project:', error);
    document.getElementById('selected-path').textContent = `Error: ${error.message}`;
  }
}

// Folder selection handler
document.getElementById('select-folder-btn').addEventListener('click', async () => {
  console.log('Select folder button clicked');
  console.log('electronAPI:', window.electronAPI);

  if (window.electronAPI && window.electronAPI.selectFolder) {
    console.log('Calling selectFolder...');
    try {
      const folderPath = await window.electronAPI.selectFolder();
      console.log('Selected folder:', folderPath);
      if (folderPath) {
        await loadProject(folderPath);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  } else {
    console.warn('electronAPI.selectFolder not available');
  }
});

// Populate color legend with both type and status colors
function populateColorLegend() {
  const legendContent = document.getElementById('legend-content');
  if (!legendContent) return;

  // Node types section
  const typeTitle = document.createElement('div');
  typeTitle.className = 'legend-title';
  typeTitle.textContent = 'Node Types';
  legendContent.appendChild(typeTitle);

  const formatTypeName = (type) => type.charAt(0).toUpperCase() + type.slice(1);

  for (const [type, color] of Object.entries(nodeColors)) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = color;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = formatTypeName(type);

    item.appendChild(colorCircle);
    item.appendChild(label);
    legendContent.appendChild(item);
  }

  // Status section
  const statusTitle = document.createElement('div');
  statusTitle.className = 'legend-title';
  statusTitle.style.marginTop = '12px';
  statusTitle.textContent = 'Status';
  legendContent.appendChild(statusTitle);

  const statusLabels = {
    complete: 'Complete',
    'in-progress': 'In Progress',
    pending: 'Pending',
    blocked: 'Blocked'
  };

  for (const [status, color] of Object.entries(statusColors)) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = color;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = statusLabels[status];

    item.appendChild(colorCircle);
    item.appendChild(label);
    legendContent.appendChild(item);
  }

  // File extensions section
  const extTitle = document.createElement('div');
  extTitle.className = 'legend-title';
  extTitle.style.marginTop = '12px';
  extTitle.textContent = 'File Types';
  legendContent.appendChild(extTitle);

  const extLabels = {
    '.md': 'Markdown',
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'JSX',
    '.tsx': 'TSX',
    '.json': 'JSON',
    '.html': 'HTML',
    '.css': 'CSS',
    '.py': 'Python',
    '.yaml': 'YAML',
    '.sh': 'Shell',
    '.txt': 'Text'
  };

  for (const [ext, label] of Object.entries(extLabels)) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = extensionColors[ext];

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(colorCircle);
    item.appendChild(labelSpan);
    legendContent.appendChild(item);
  }

  // Git Status section
  const gitTitle = document.createElement('div');
  gitTitle.className = 'legend-title';
  gitTitle.style.marginTop = '12px';
  gitTitle.textContent = 'Git Status';
  legendContent.appendChild(gitTitle);

  const gitStatusLabels = {
    staged: 'Staged (ready to commit)',
    modified: 'Modified (uncommitted)',
    untracked: 'Untracked (new file)'
  };

  for (const [status, label] of Object.entries(gitStatusLabels)) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = '#' + gitStatusColors[status].toString(16).padStart(6, '0');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(colorCircle);
    item.appendChild(labelSpan);
    legendContent.appendChild(item);
  }
}

populateColorLegend();

// Legend toggle handler
document.getElementById('legend-header').addEventListener('click', () => {
  const legend = document.getElementById('color-legend');
  legend.classList.toggle('collapsed');
});

// Track mouse for tooltip positioning
container.addEventListener('mousemove', (e) => {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.left = e.clientX + 15 + 'px';
  tooltip.style.top = e.clientY + 15 + 'px';
});

// Format file size for display
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Format date for display
function formatDate(date) {
  return new Date(date).toLocaleString();
}

// Simple syntax highlighting for code
function highlightCode(content, extension) {
  // Escape HTML
  let escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Basic highlighting based on extension
  if (['.js', '.ts', '.json'].includes(extension)) {
    // Highlight strings
    escaped = escaped.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span style="color: #98C379;">$&</span>');
    // Highlight keywords
    escaped = escaped.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|new|this|true|false|null|undefined)\b/g, '<span style="color: #C678DD;">$1</span>');
    // Highlight comments
    escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span style="color: #5C6370;">$1</span>');
  } else if (extension === '.md') {
    // Highlight headers
    escaped = escaped.replace(/^(#{1,6}\s.*)$/gm, '<span style="color: #E06C75; font-weight: bold;">$1</span>');
    // Highlight bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #E5C07B;">$1</strong>');
    // Highlight code blocks
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: #3E4451; padding: 2px 4px; border-radius: 3px;">$1</code>');
  }

  return escaped;
}

// Escape HTML for safe display in diff view
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Render diff view with syntax highlighting for diff lines
function renderDiffView(diffResult) {
  if (!diffResult) return '<div class="diff-status">Unable to load diff</div>';

  if (diffResult.error) {
    return `<div class="diff-status">Error: ${diffResult.error}</div>`;
  }

  if (!diffResult.diff) {
    return `<div class="diff-status">${diffResult.message || 'No diff available'}</div>`;
  }

  // Check for binary file indicator in diff output
  if (diffResult.diff.includes('Binary files') || diffResult.diff.includes('GIT binary patch')) {
    return '<div class="diff-status">Binary file - diff not available</div>';
  }

  // Parse and highlight diff lines
  const lines = diffResult.diff.split('\n');

  // Truncate very long diffs (100 lines)
  const MAX_DIFF_LINES = 100;
  const truncated = lines.length > MAX_DIFF_LINES;
  const displayLines = truncated ? lines.slice(0, MAX_DIFF_LINES) : lines;

  const htmlLines = displayLines.map(line => {
    let className = 'diff-line context';
    if (line.startsWith('+') && !line.startsWith('+++')) {
      className = 'diff-line added';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      className = 'diff-line removed';
    } else if (line.startsWith('@@')) {
      className = 'diff-line header';
    } else if (line.startsWith('diff ') || line.startsWith('index ') ||
               line.startsWith('---') || line.startsWith('+++')) {
      className = 'diff-line header';
    }
    return `<div class="${className}">${escapeHtml(line)}</div>`;
  }).join('');

  let truncateMsg = '';
  if (truncated) {
    truncateMsg = `<div class="diff-status">... (diff truncated, showing first ${MAX_DIFF_LINES} of ${lines.length} lines)</div>`;
  }

  return `<div class="diff-content">${htmlLines}${truncateMsg}</div>`;
}

// Details panel functions
async function showDetailsPanel(node) {
  selectedNode = node;
  const panel = document.getElementById('details-panel');
  const title = document.getElementById('panel-title');
  const content = document.getElementById('panel-content');

  // Sync with tree panel - highlight the node in tree
  if (node.type === 'directory' || node.type === 'file') {
    highlightTreeItem(node.id);
  }

  title.textContent = node.name;

  let html = `<p><strong>Type:</strong> <span style="color: ${getNodeColor(node)}; text-transform: capitalize;">${node.type}</span></p>`;

  if (node.status) {
    const statusColor = statusColors[node.status] || '#888';
    html += `<p><strong>Status:</strong> <span style="color: ${statusColor}">${node.status}</span></p>`;
  }

  if (node.description) {
    html += `<p><strong>Description:</strong><br>${node.description}</p>`;
  }

  if (node.goal) {
    html += `<p><strong>Goal:</strong><br>${node.goal}</p>`;
  }

  if (node.category) {
    html += `<p><strong>Category:</strong> ${node.category}</p>`;
  }

  if (node.path) {
    html += `<p><strong>Path:</strong> ${node.path}</p>`;
  }

  if (node.file) {
    html += `<p><strong>File:</strong> ${node.file}</p>`;
  }

  if (node.extension) {
    html += `<p><strong>Extension:</strong> <span style="color: ${extensionColors[node.extension] || '#888'}">${node.extension}</span></p>`;
  }

  // For commit nodes, show hash and message
  if (node.type === 'commit') {
    html += `<p><strong>Commit Hash:</strong> <code style="font-family: monospace; background: #2a2a4e; padding: 2px 6px; border-radius: 3px;">${node.hash}</code></p>`;
    if (node.fullMessage) {
      html += `<p><strong>Message:</strong><br>${node.fullMessage}</p>`;
    }
  }

  // Add open button for nodes with file paths
  const filePath = node.path || node.file;
  let fullPath = null;

  if (filePath && selectedProjectPath) {
    // Build full path based on sourceType
    if (node.sourceType === 'src') {
      fullPath = `${selectedProjectPath}/src/${node.path}`;
    } else if (node.sourceType === 'planning') {
      fullPath = `${selectedProjectPath}/.planning/${node.path}`;
    } else if (node.path) {
      fullPath = `${selectedProjectPath}/.planning/${node.path}`;
    } else if (node.file) {
      fullPath = `${selectedProjectPath}/.planning/phases/${node.file}`;
    }
    html += `<button id="open-file-btn" class="panel-btn">Open in Editor</button>`;
  }

  // For files, show content preview
  if (node.type === 'file' && fullPath && window.electronAPI && window.electronAPI.readFileContent) {
    html += `<div id="file-preview-container">
      <p><strong>File Preview:</strong></p>
      <div id="file-preview-loading">Loading...</div>
      <pre id="file-preview"></pre>
    </div>`;
  }

  // For file nodes in git projects, show diff section
  if (node.type === 'file' && selectedProjectPath && window.electronAPI && window.electronAPI.getGitDiff) {
    html += `<div class="diff-container">
      <div class="diff-header">Recent Changes</div>
      <div id="diff-view-content"><div class="diff-status">Loading diff...</div></div>
    </div>`;
  }

  // For directories, show children count info
  if (node.type === 'directory') {
    const childLinks = currentGraphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      return sourceId === node.id;
    });
    html += `<p><strong>Contains:</strong> ${childLinks.length} items</p>`;
  }

  content.innerHTML = html;

  // Load file content preview
  if (node.type === 'file' && fullPath && window.electronAPI && window.electronAPI.readFileContent) {
    try {
      const result = await window.electronAPI.readFileContent(fullPath);
      const previewEl = document.getElementById('file-preview');
      const loadingEl = document.getElementById('file-preview-loading');

      if (loadingEl) loadingEl.style.display = 'none';

      if (result.error) {
        if (previewEl) previewEl.innerHTML = `<span style="color: #E74C3C;">Error: ${result.error}</span>`;
      } else {
        // Show file stats
        const statsHtml = `<p style="font-size: 11px; color: #888; margin-bottom: 8px;">
          Size: ${formatFileSize(result.size)} | Modified: ${formatDate(result.modified)}
          ${result.truncated ? ' | <span style="color: #F39C12;">Truncated</span>' : ''}
        </p>`;

        const container = document.getElementById('file-preview-container');
        if (container) {
          container.insertAdjacentHTML('afterbegin', statsHtml);
        }

        if (previewEl) {
          previewEl.innerHTML = highlightCode(result.content, node.extension);
        }
      }
    } catch (err) {
      console.error('Error loading file preview:', err);
      const previewEl = document.getElementById('file-preview');
      if (previewEl) previewEl.innerHTML = `<span style="color: #E74C3C;">Error loading preview</span>`;
    }
  }

  // Add click handler for open button
  const openBtn = document.getElementById('open-file-btn');
  if (openBtn && fullPath) {
    openBtn.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.openFile) {
        const result = await window.electronAPI.openFile(fullPath);
        if (result.error) {
          console.error('Error opening file:', result.error);
        }
      }
    });
  }

  // Load and render diff for file nodes
  if (node.type === 'file' && selectedProjectPath && window.electronAPI && window.electronAPI.getGitDiff) {
    // Build relative path for git (relative to project root)
    let relativePath;
    if (node.sourceType === 'planning') {
      relativePath = '.planning/' + node.path;
    } else if (node.sourceType === 'src') {
      relativePath = 'src/' + node.path;
    } else {
      relativePath = node.path;
    }

    try {
      const diffResult = await window.electronAPI.getGitDiff(selectedProjectPath, relativePath);
      const diffContent = document.getElementById('diff-view-content');
      if (diffContent) {
        diffContent.innerHTML = renderDiffView(diffResult);
      }
    } catch (err) {
      console.error('Error loading diff:', err);
      const diffContent = document.getElementById('diff-view-content');
      if (diffContent) {
        diffContent.innerHTML = '<div class="diff-status">Error loading diff</div>';
      }
    }
  }

  panel.classList.remove('hidden');
  panel.classList.add('visible');
}

function hideDetailsPanel() {
  const panel = document.getElementById('details-panel');
  panel.classList.remove('visible');
  panel.classList.add('hidden');
  selectedNode = null;
}

// Refresh details panel content (re-renders with current selectedNode)
function refreshDetailsPanel() {
  if (selectedNode) {
    showDetailsPanel(selectedNode);
  }
}

// Refresh only the diff section in details panel (more efficient than full refresh)
async function refreshDiffSection() {
  if (!selectedNode || selectedNode.type !== 'file') return;
  if (!selectedProjectPath || !window.electronAPI || !window.electronAPI.getGitDiff) return;

  const diffContent = document.getElementById('diff-view-content');
  if (!diffContent) return;

  // Build relative path for git (relative to project root)
  let relativePath;
  if (selectedNode.sourceType === 'planning') {
    relativePath = '.planning/' + selectedNode.path;
  } else if (selectedNode.sourceType === 'src') {
    relativePath = 'src/' + selectedNode.path;
  } else {
    relativePath = selectedNode.path;
  }

  try {
    diffContent.innerHTML = '<div class="diff-status">Loading diff...</div>';
    const diffResult = await window.electronAPI.getGitDiff(selectedProjectPath, relativePath);
    diffContent.innerHTML = renderDiffView(diffResult);
  } catch (err) {
    console.error('Error refreshing diff:', err);
    diffContent.innerHTML = '<div class="diff-status">Error loading diff</div>';
  }
}

// Close panel button handler
document.getElementById('close-panel').addEventListener('click', hideDetailsPanel);

// Close panel when clicking on background (optional - ESC key)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideDetailsPanel();
  }
});

// Refresh button handler
document.getElementById('refresh-btn').addEventListener('click', async () => {
  if (selectedProjectPath) {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    showRefreshIndicator();
    await loadProject(selectedProjectPath);
    btn.disabled = false;
    btn.textContent = '↻ Refresh';
  }
});

// Show refresh indicator
function showRefreshIndicator() {
  const indicator = document.getElementById('refresh-indicator');
  if (indicator) {
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 1500);
  }
}

// Recent projects functions
async function updateRecentProjects() {
  if (!window.electronAPI || !window.electronAPI.getRecentProjects) return;

  try {
    const recent = await window.electronAPI.getRecentProjects();
    const dropdown = document.getElementById('recent-projects');
    dropdown.innerHTML = '<option value="">Recent Projects...</option>';

    for (const projectPath of recent) {
      const opt = document.createElement('option');
      opt.value = projectPath;
      // Show just the folder name, with full path as title
      const folderName = projectPath.split('/').pop() || projectPath;
      opt.textContent = folderName;
      opt.title = projectPath;
      dropdown.appendChild(opt);
    }
  } catch (error) {
    console.error('Error loading recent projects:', error);
  }
}

// Recent projects dropdown handler
document.getElementById('recent-projects').addEventListener('change', async (e) => {
  const projectPath = e.target.value;
  if (projectPath) {
    await loadProject(projectPath);
    e.target.value = ''; // Reset dropdown
  }
});

// Listen for file changes (auto-refresh)
if (window.electronAPI && window.electronAPI.onFilesChanged) {
  window.electronAPI.onFilesChanged(async (data) => {
    console.log('Files changed:', data.event, data.path, 'sourceType:', data.sourceType);
    if (selectedProjectPath) {
      // Add to activity feed and get entry with mapped event type
      const entry = addActivityEntry(data.event, data.path, data.sourceType);

      // Flash the node with type-appropriate animation
      if (entry.nodeId) {
        flashNodeWithType(entry.nodeId, entry.event);
        flashTreeItem(entry.nodeId, entry.event);
      }

      // Check if the changed file is currently shown in details panel
      // and auto-refresh the diff section if so
      if (selectedNode && selectedNode.type === 'file' && entry.nodeId === selectedNode.id) {
        // Refresh diff section for the currently displayed file
        refreshDiffSection();
      }

      // Update timeline UI (range may have expanded with new entry)
      // If in live mode, timeline stays at live; if historical, don't auto-advance
      if (timelinePosition === null) {
        // In live mode - just update UI to reflect new range
        updateTimelineUI();
      }

      showRefreshIndicator();
      await loadProject(selectedProjectPath);

      // Refresh git status after file changes
      await fetchGitStatus(selectedProjectPath);
    }
  });
}

// Load recent projects on startup
updateRecentProjects();

// =====================================================
// TREE PANEL FUNCTIONALITY
// =====================================================

// Build hierarchical tree structure from flat directory data
function buildTreeStructure(directoryData) {
  if (!directoryData || !directoryData.nodes) return null;

  const nodeMap = new Map();
  const roots = [];

  // Create map of all nodes
  for (const node of directoryData.nodes) {
    nodeMap.set(node.id, {
      ...node,
      children: []
    });
  }

  // Build parent-child relationships
  for (const link of directoryData.links) {
    const parent = nodeMap.get(link.source);
    const child = nodeMap.get(link.target);
    if (parent && child) {
      parent.children.push(child);
    }
  }

  // Find root nodes (nodes with no parent)
  const childIds = new Set(directoryData.links.map(l => l.target));
  for (const node of directoryData.nodes) {
    if (!childIds.has(node.id)) {
      roots.push(nodeMap.get(node.id));
    }
  }

  // Sort children: directories first, then alphabetically
  function sortChildren(node) {
    node.children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
    return node;
  }

  roots.forEach(sortChildren);
  return roots;
}

// Get icon for tree item
function getTreeIcon(node) {
  if (node.type === 'directory') {
    return treeExpanded.has(node.id) ? '📂' : '📁';
  }
  // File icons by extension
  const extIcons = {
    '.md': '📝',
    '.js': '📜',
    '.ts': '📘',
    '.json': '📋',
    '.html': '🌐',
    '.css': '🎨',
    '.yaml': '⚙️',
    '.yml': '⚙️',
    '.txt': '📄'
  };
  return extIcons[node.extension] || '📄';
}

// Get color for tree item based on sourceType
function getTreeColor(node) {
  if (node.type === 'directory') {
    if (node.sourceType === 'src') return '#5B9BD5';  // Cool steel blue for src/
    if (node.sourceType === 'root') return '#FFFFFF'; // White for project root
    return '#BB8FCE';  // Purple for .planning/ (existing)
  }

  // Files: apply sourceType tint to extension colors
  let baseColor = extensionColors[node.extension] || '#DDA0DD';
  if (node.sourceType === 'src') {
    baseColor = applySourceTint(baseColor, 'src');
  }
  return baseColor;
}

// Render tree recursively
function renderTree(nodes, depth = 0) {
  let html = '';
  const indent = depth * 16;

  for (const node of nodes) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = treeExpanded.has(node.id);
    const isSelected = selectedNode && selectedNode.id === node.id;

    html += `<div class="tree-item ${isSelected ? 'selected' : ''}"
                  data-node-id="${node.id}"
                  style="padding-left: ${indent + 8}px">
      <span class="tree-toggle-icon ${isExpanded ? 'expanded' : ''} ${!hasChildren ? 'no-children' : ''}"
            data-node-id="${node.id}">▶</span>
      <span class="tree-icon" style="color: ${getTreeColor(node)}">${getTreeIcon(node)}</span>
      <span class="tree-name">${node.name}</span>
    </div>`;

    if (hasChildren) {
      html += `<div class="tree-children ${isExpanded ? 'expanded' : ''}" data-parent-id="${node.id}">
        ${renderTree(node.children, depth + 1)}
      </div>`;
    }
  }

  return html;
}

// Update tree display
function updateTreePanel() {
  const content = document.getElementById('tree-content');
  if (!content || !treeData) return;

  content.innerHTML = renderTree(treeData);

  // Add click handlers for tree items
  content.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = item.dataset.nodeId;

      // If clicking on toggle icon, just toggle expand/collapse
      if (e.target.classList.contains('tree-toggle-icon')) {
        toggleTreeExpand(nodeId);
        return;
      }

      // Otherwise, select the node and fly to it in graph
      selectTreeItem(nodeId);
    });
  });

  // Add double-click to expand/collapse directories
  content.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('dblclick', (e) => {
      const nodeId = item.dataset.nodeId;
      const node = findNodeById(nodeId);
      if (node && node.type === 'directory') {
        toggleTreeExpand(nodeId);
      }
    });
  });
}

// Find node in graph data by ID
function findNodeById(nodeId) {
  return currentGraphData.nodes.find(n => n.id === nodeId);
}

// Toggle expand/collapse for a directory
function toggleTreeExpand(nodeId) {
  if (treeExpanded.has(nodeId)) {
    treeExpanded.delete(nodeId);
  } else {
    treeExpanded.add(nodeId);
  }
  updateTreePanel();
}

// Expand all parents of a node
function expandParentsOf(nodeId) {
  // Find the path to this node from root
  function findPath(nodes, targetId, path = []) {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...path, node.id];
      }
      if (node.children && node.children.length > 0) {
        const found = findPath(node.children, targetId, [...path, node.id]);
        if (found) return found;
      }
    }
    return null;
  }

  if (!treeData) return;
  const path = findPath(treeData, nodeId);
  if (path) {
    // Expand all nodes in path except the target itself
    path.slice(0, -1).forEach(id => treeExpanded.add(id));
  }
}

// Select a tree item and fly to it in graph
function selectTreeItem(nodeId) {
  const graphNode = findNodeById(nodeId);
  if (!graphNode) return;

  // Update visual selection in tree
  document.querySelectorAll('.tree-item').forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.nodeId === nodeId) {
      item.classList.add('selected');
    }
  });

  // Fly to node in graph
  if (graphNode.x !== undefined) {
    const distance = 50 + getNodeSize(graphNode, connectionCounts) * 4;

    if (is3D) {
      // 3D mode: calculate position relative to node position
      const distRatio = 1 + distance / Math.hypot(graphNode.x || 0, graphNode.y || 0, graphNode.z || 0);
      Graph.cameraPosition(
        {
          x: (graphNode.x || 0) * distRatio,
          y: (graphNode.y || 0) * distRatio,
          z: (graphNode.z || 0) * distRatio
        },
        graphNode,
        1000
      );
    } else {
      // 2D mode: position camera above the node looking down
      Graph.cameraPosition(
        { x: graphNode.x || 0, y: graphNode.y || 0, z: distance + 100 },
        graphNode,
        1000
      );
    }

    // Flash the graph node
    flashNode(nodeId);
  }

  // Show details panel
  showDetailsPanel(graphNode);
}

// Highlight a node in the tree (called when graph node is clicked)
function highlightTreeItem(nodeId) {
  // Expand parents first
  expandParentsOf(nodeId);
  updateTreePanel();

  // Scroll to and highlight the item
  setTimeout(() => {
    const treeContent = document.getElementById('tree-content');
    const treeItems = document.querySelectorAll('.tree-item');

    treeItems.forEach(item => {
      item.classList.remove('selected', 'highlighted');
      if (item.dataset.nodeId === nodeId) {
        item.classList.add('selected');
        // Scroll into view
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Flash the tree item
    flashTreeItem(nodeId);
  }, 50);
}

// Tree toggle button handler
document.getElementById('tree-toggle').addEventListener('click', () => {
  const panel = document.getElementById('tree-panel');
  const toggle = document.getElementById('tree-toggle');
  const graphContainer = document.getElementById('graph-container');

  panel.classList.toggle('visible');
  toggle.classList.toggle('panel-open');
  graphContainer.classList.toggle('tree-open');

  // Update toggle icon
  toggle.textContent = panel.classList.contains('visible') ? '◀' : '📁';

  // Apply current panel width when opening
  if (panel.classList.contains('visible')) {
    applyTreePanelWidth(treePanelWidth);
  } else {
    // Reset inline styles when closing
    panel.style.width = '';
    toggle.style.left = '';
    graphContainer.style.left = '';
    graphContainer.style.width = '';
  }

  // Resize graph
  setTimeout(() => handleResize(), 300);
});

// =====================================================
// TREE PANEL RESIZER
// =====================================================

let treePanelWidth = 280; // Default width
const MIN_TREE_WIDTH = 150;
const MAX_TREE_WIDTH = 600;

// Initialize tree panel resizer
const treeResizer = document.getElementById('tree-resizer');
if (treeResizer) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  treeResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = treePanelWidth;
    treeResizer.classList.add('active');
    document.body.classList.add('resizing');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;

    // Clamp to min/max
    newWidth = Math.max(MIN_TREE_WIDTH, Math.min(MAX_TREE_WIDTH, newWidth));

    treePanelWidth = newWidth;
    applyTreePanelWidth(newWidth);
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      treeResizer.classList.remove('active');
      document.body.classList.remove('resizing');
      handleResize(); // Update graph size
    }
  });
}

// Apply tree panel width to DOM elements
function applyTreePanelWidth(width) {
  const panel = document.getElementById('tree-panel');
  const toggle = document.getElementById('tree-toggle');
  const graphContainer = document.getElementById('graph-container');
  const statsPanel = document.getElementById('statistics-panel');

  if (panel) {
    panel.style.width = width + 'px';
  }

  if (toggle && panel && panel.classList.contains('visible')) {
    toggle.style.left = (width + 10) + 'px';
  }

  // Update graph container left margin when tree is visible
  if (graphContainer && panel && panel.classList.contains('visible')) {
    graphContainer.style.left = width + 'px';

    // Check if statistics panel is also open
    const statsOpen = statsPanel && statsPanel.classList.contains('visible');
    const statsWidth = statsOpen ? 320 : 0;

    graphContainer.style.width = `calc(100% - ${width}px - ${statsWidth}px)`;
  }
}

// =====================================================
// ACTIVITY FEED FUNCTIONALITY
// =====================================================

// Update activity badge
function updateActivityBadge() {
  const badge = document.getElementById('activity-badge');
  if (!badge) return;

  if (activityUnreadCount > 0) {
    badge.textContent = activityUnreadCount > 99 ? '99+' : activityUnreadCount;
    badge.classList.add('visible', 'pulse');
  } else {
    badge.classList.remove('visible', 'pulse');
  }
}

// Get icon for activity entry based on event type
function getActivityIcon(event) {
  switch (event) {
    case 'created': return '+';
    case 'modified': return '~';
    case 'deleted': return '-';
    default: return '?';
  }
}

// Update activity panel content
function updateActivityPanel() {
  const content = document.getElementById('activity-content');
  if (!content) return;

  if (activityEntries.length === 0) {
    content.innerHTML = '<div class="activity-empty">No recent activity</div>';
    return;
  }

  // Render entries (newest first, already sorted)
  content.innerHTML = activityEntries.map(entry => {
    const icon = getActivityIcon(entry.event);
    const timeAgo = formatTimeAgo(entry.timestamp);

    return `<div class="activity-entry ${entry.event}"
         data-entry-id="${entry.id}"
         data-node-id="${entry.nodeId || ''}"
         data-timestamp="${entry.timestamp}"
         title="${new Date(entry.timestamp).toLocaleString()}">
      <span class="activity-icon">${icon}</span>
      <span class="activity-path">${entry.relativePath}</span>
      <span class="activity-type">${entry.event}</span>
      <span class="activity-time">${timeAgo}</span>
    </div>`;
  }).join('');
}

// Format relative time
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Auto-scroll activity feed to top to show newest entry
function scrollActivityToTop() {
  const content = document.getElementById('activity-content');
  if (content) {
    content.scrollTop = 0;
  }
}

// Activity feed toggle button handler
document.getElementById('activity-toggle').addEventListener('click', () => {
  const panel = document.getElementById('activity-panel');
  const toggle = document.getElementById('activity-toggle');
  const graphContainer = document.getElementById('graph-container');

  panel.classList.toggle('visible');
  toggle.classList.toggle('panel-open');
  graphContainer.classList.toggle('activity-open');

  // Clear unread count when opening
  if (panel.classList.contains('visible')) {
    activityUnreadCount = 0;
    updateActivityBadge();
  }

  // Resize graph
  setTimeout(() => handleResize(), 300);
});

// Clear button handler
document.getElementById('activity-clear').addEventListener('click', () => {
  activityEntries = [];
  activityUnreadCount = 0;
  updateActivityBadge();
  updateActivityPanel();
});

// Statistics panel toggle button handler
document.getElementById('statistics-toggle').addEventListener('click', () => {
  const panel = document.getElementById('statistics-panel');
  const toggle = document.getElementById('statistics-toggle');
  const graphContainer = document.getElementById('graph-container');

  panel.classList.toggle('visible');
  toggle.classList.toggle('panel-open');
  graphContainer.classList.toggle('statistics-open');

  // Update statistics when panel is opened
  if (panel.classList.contains('visible')) {
    updateStatisticsPanel();
  }

  // Resize graph
  setTimeout(() => handleResize(), 300);
});

// Statistics refresh button handler
document.getElementById('stats-refresh')?.addEventListener('click', () => {
  updateStatisticsPanel();
});

// Update relative timestamps every 30 seconds
setInterval(() => {
  if (activityEntries.length > 0) {
    updateActivityPanel();
  }
}, 30000);

// Store directory data for tree building
let storedDirectoryData = null;

// Dimension toggle button handler
document.getElementById('dimension-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('dimension-toggle');

  // Toggle dimension state
  is3D = !is3D;

  // Update graph dimensions
  Graph.numDimensions(is3D ? 3 : 2);

  // Update button text to reflect current mode
  toggle.textContent = is3D ? '3D' : '2D';

  // For 2D mode, adjust camera to top-down view for better visualization
  if (!is3D) {
    // Position camera directly above looking down
    Graph.cameraPosition(
      { x: 0, y: 0, z: 300 },  // Camera position (looking down from Z-axis)
      { x: 0, y: 0, z: 0 },     // Look at origin
      1000                       // Transition duration
    );
  } else {
    // For 3D mode, zoom to fit to see the spatial layout
    setTimeout(() => {
      Graph.zoomToFit(1000);
    }, 100);
  }
});

// =====================================================
// ACTIVITY ENTRY INTERACTIONS
// =====================================================

// Handle click on activity entry - navigate to node
function handleActivityEntryClick(nodeId, eventType, entryElement) {
  // Handle deleted files specially
  if (eventType === 'deleted') {
    // Show message that file no longer exists
    showDeletedFileMessage(entryElement);
    return;
  }

  // Navigate to node if it exists
  if (!nodeId) {
    console.log('[Activity] No nodeId for entry');
    return;
  }

  const graphNode = findNodeById(nodeId);
  if (!graphNode) {
    console.log('[Activity] Node not found in graph:', nodeId);
    showDeletedFileMessage(entryElement);
    return;
  }

  // Fly to node (reuse selectTreeItem logic for consistency)
  if (graphNode.x !== undefined) {
    const distance = 50 + getNodeSize(graphNode, connectionCounts) * 4;

    if (is3D) {
      const distRatio = 1 + distance / Math.hypot(graphNode.x || 0, graphNode.y || 0, graphNode.z || 0);
      Graph.cameraPosition(
        {
          x: (graphNode.x || 0) * distRatio,
          y: (graphNode.y || 0) * distRatio,
          z: (graphNode.z || 0) * distRatio
        },
        graphNode,
        1000
      );
    } else {
      Graph.cameraPosition(
        { x: graphNode.x || 0, y: graphNode.y || 0, z: distance + 100 },
        graphNode,
        1000
      );
    }

    // Flash the node
    flashNode(nodeId);
  }

  // Open details panel
  showDetailsPanel(graphNode);

  // Highlight in tree panel too
  highlightTreeItem(nodeId);
}

// Show message for deleted file entries
function showDeletedFileMessage(entryElement) {
  // Create tooltip-like message near the entry
  const existingMsg = document.querySelector('.activity-deleted-msg');
  if (existingMsg) existingMsg.remove();

  const msg = document.createElement('div');
  msg.className = 'activity-deleted-msg';
  msg.textContent = 'File no longer exists';
  msg.style.cssText = `
    position: fixed;
    background: rgba(231, 76, 60, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    pointer-events: none;
  `;

  // Position near the entry
  const rect = entryElement.getBoundingClientRect();
  msg.style.left = rect.left + 'px';
  msg.style.top = (rect.top - 35) + 'px';

  document.body.appendChild(msg);

  // Remove after 2 seconds
  setTimeout(() => msg.remove(), 2000);
}

// Initialize activity entry interactions (call once)
function initActivityInteractions() {
  const content = document.getElementById('activity-content');
  if (!content) return;

  // Use event delegation for entries - click handler
  content.addEventListener('click', (e) => {
    const entry = e.target.closest('.activity-entry');
    if (!entry) return;

    const nodeId = entry.dataset.nodeId;
    const entryEvent = entry.classList.contains('deleted') ? 'deleted' :
                       entry.classList.contains('created') ? 'created' : 'modified';

    handleActivityEntryClick(nodeId, entryEvent, entry);
  });

  // Hover handler for highlighting
  content.addEventListener('mouseover', (e) => {
    const entry = e.target.closest('.activity-entry');
    if (!entry) return;

    const nodeId = entry.dataset.nodeId;
    if (nodeId) {
      highlightNodeInGraph(nodeId);
    }
  });

  content.addEventListener('mouseout', (e) => {
    const entry = e.target.closest('.activity-entry');
    if (!entry) return;

    clearNodeHighlight();
  });
}

// Initialize activity interactions
initActivityInteractions();

// =====================================================
// TIMELINE REPLAY FUNCTIONALITY
// =====================================================

// Timeline scrubber input handler
document.getElementById('timeline-scrubber')?.addEventListener('input', (e) => {
  const sliderValue = parseInt(e.target.value, 10);
  const { min, max } = getTimelineRange();

  if (sliderValue >= 100) {
    // At max = live mode
    setTimelineToLive();
  } else {
    // Historical mode
    const range = max - min;
    if (range > 0) {
      timelinePosition = min + (sliderValue / 100) * range;
    } else {
      timelinePosition = min;
    }

    // Stop playback if manually scrubbing
    if (isTimelinePlaying) {
      clearInterval(playbackInterval);
      playbackInterval = null;
      isTimelinePlaying = false;
    }

    updateTimelineUI();
    updateGraphForTimeline();
    updateActivityPanelForTimeline();
  }
});

// Play/pause button click handler
document.getElementById('timeline-play')?.addEventListener('click', () => {
  if (isTimelinePlaying) {
    // Pause playback
    clearInterval(playbackInterval);
    playbackInterval = null;
    isTimelinePlaying = false;
  } else {
    // Start playback
    isTimelinePlaying = true;

    // If at live position, jump to oldest entry first
    if (timelinePosition === null && activityEntries.length > 0) {
      const { min } = getTimelineRange();
      timelinePosition = min;
    }

    // Start playback interval
    playbackInterval = setInterval(playbackStep, PLAYBACK_SPEED);
  }

  updateTimelineUI();
});

// Playback step function - advances to next activity entry
function playbackStep() {
  if (!isTimelinePlaying || activityEntries.length === 0) {
    // Stop if not playing or no entries
    clearInterval(playbackInterval);
    playbackInterval = null;
    isTimelinePlaying = false;
    updateTimelineUI();
    return;
  }

  // Find next activity entry after current timelinePosition
  // activityEntries is sorted newest first, so we search from end to find next
  const sortedByTime = [...activityEntries].sort((a, b) => a.timestamp - b.timestamp);

  let nextEntry = null;
  for (const entry of sortedByTime) {
    if (entry.timestamp > timelinePosition) {
      nextEntry = entry;
      break;
    }
  }

  if (nextEntry) {
    // Advance to next entry's timestamp
    timelinePosition = nextEntry.timestamp;
    updateTimelineUI();
    updateGraphForTimeline();
    updateActivityPanelForTimeline();
  } else {
    // No more entries - stop playback and switch to live mode
    setTimelineToLive();
  }
}

// =====================================================
// STATISTICS PANEL FUNCTIONALITY
// =====================================================

// Calculate statistics from activity entries
function calculateStatistics() {
  // Count changes per file
  const fileCounts = {};
  activityEntries.forEach(entry => {
    const key = entry.relativePath;
    if (!fileCounts[key]) {
      fileCounts[key] = {
        path: key,
        count: 0,
        lastChange: 0,
        events: { created: 0, modified: 0, deleted: 0 },
        nodeId: entry.nodeId
      };
    }
    fileCounts[key].count++;
    fileCounts[key].events[entry.event]++;
    if (entry.timestamp > fileCounts[key].lastChange) {
      fileCounts[key].lastChange = entry.timestamp;
    }
    // Update nodeId if we have a newer one
    if (entry.nodeId) {
      fileCounts[key].nodeId = entry.nodeId;
    }
  });

  // Sort by count descending
  const ranked = Object.values(fileCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  return { ranked, total: activityEntries.length };
}

// Determine dominant event type for a file
function getDominantEventType(events) {
  if (events.created > events.modified && events.created > events.deleted) {
    return 'created';
  }
  if (events.deleted > events.modified && events.deleted > events.created) {
    return 'deleted';
  }
  return 'modified';
}

// Truncate path for display (show end if too long)
function truncatePath(path, maxLen = 35) {
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-(maxLen - 3));
}

// Update statistics panel (calls both ranking and chart)
function updateStatisticsPanel() {
  updateFileRanking();
  updateActivityChart();
}

// Update file ranking display
function updateFileRanking() {
  const container = document.getElementById('stats-file-ranking');
  if (!container) return;

  if (activityEntries.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity recorded yet</div>';
    return;
  }

  const { ranked } = calculateStatistics();

  if (ranked.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity recorded yet</div>';
    return;
  }

  // Find max count for relative bar widths
  const maxCount = ranked[0].count;

  container.innerHTML = ranked.map(file => {
    const dominantType = getDominantEventType(file.events);
    const barWidth = Math.round((file.count / maxCount) * 100);
    const truncatedPath = truncatePath(file.path);

    return `<div class="ranking-entry" data-node-id="${file.nodeId || ''}" title="${file.path}\n${file.count} changes (${file.events.created} created, ${file.events.modified} modified, ${file.events.deleted} deleted)">
      <span class="ranking-path">${truncatedPath}</span>
      <div class="ranking-bar-container">
        <div class="ranking-bar">
          <div class="ranking-bar-fill ${dominantType}" style="width: ${barWidth}%"></div>
        </div>
        <span class="ranking-count">${file.count}</span>
      </div>
    </div>`;
  }).join('');

  // Add click handlers for ranking entries to navigate to node
  container.querySelectorAll('.ranking-entry').forEach(entry => {
    entry.addEventListener('click', () => {
      const nodeId = entry.dataset.nodeId;
      if (nodeId) {
        handleRankingEntryClick(nodeId);
      }
    });
  });
}

// Handle click on ranking entry - navigate to node
function handleRankingEntryClick(nodeId) {
  const graphNode = findNodeById(nodeId);
  if (!graphNode) {
    console.log('[Stats] Node not found:', nodeId);
    return;
  }

  // Fly to node (reuse same pattern as activity entry click)
  if (graphNode.x !== undefined) {
    const distance = 50 + getNodeSize(graphNode, connectionCounts) * 4;

    if (is3D) {
      const distRatio = 1 + distance / Math.hypot(graphNode.x || 0, graphNode.y || 0, graphNode.z || 0);
      Graph.cameraPosition(
        {
          x: (graphNode.x || 0) * distRatio,
          y: (graphNode.y || 0) * distRatio,
          z: (graphNode.z || 0) * distRatio
        },
        graphNode,
        1000
      );
    } else {
      Graph.cameraPosition(
        { x: graphNode.x || 0, y: graphNode.y || 0, z: distance + 100 },
        graphNode,
        1000
      );
    }

    // Flash the node
    flashNode(nodeId);
  }

  // Open details panel
  showDetailsPanel(graphNode);

  // Highlight in tree panel
  highlightTreeItem(nodeId);
}

// Format time for chart axis labels
function formatChartTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

// Format tooltip time (more detailed)
function formatChartTooltip(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Calculate time buckets for activity chart
function calculateTimeBuckets() {
  if (activityEntries.length === 0) {
    return { buckets: [], oldest: 0, newest: 0 };
  }

  // Find time range
  const timestamps = activityEntries.map(e => e.timestamp);
  const oldest = Math.min(...timestamps);
  const newest = Math.max(...timestamps);
  const span = newest - oldest;

  // Determine bucket size based on activity span
  let bucketSize;
  let maxBuckets;

  if (span < 60 * 60 * 1000) {
    // < 1 hour: use 5-minute buckets (12 max)
    bucketSize = 5 * 60 * 1000;
    maxBuckets = 12;
  } else if (span < 24 * 60 * 60 * 1000) {
    // 1-24 hours: use 30-minute buckets
    bucketSize = 30 * 60 * 1000;
    maxBuckets = 48;
  } else {
    // > 24 hours: use 1-hour buckets, cap at 24 hours
    bucketSize = 60 * 60 * 1000;
    maxBuckets = 24;
  }

  // Cap to last 24 hours of data
  const effectiveOldest = Math.max(oldest, newest - (24 * 60 * 60 * 1000));

  // Create buckets
  const buckets = [];
  const numBuckets = Math.min(Math.ceil((newest - effectiveOldest) / bucketSize) + 1, maxBuckets);

  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = effectiveOldest + (i * bucketSize);
    const bucketEnd = bucketStart + bucketSize;
    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      count: 0
    });
  }

  // Populate buckets with activity counts
  activityEntries.forEach(entry => {
    if (entry.timestamp < effectiveOldest) return; // Skip old entries

    for (const bucket of buckets) {
      if (entry.timestamp >= bucket.start && entry.timestamp < bucket.end) {
        bucket.count++;
        break;
      }
    }
  });

  return { buckets, oldest: effectiveOldest, newest };
}

// Update activity over time chart
function updateActivityChart() {
  const container = document.getElementById('stats-chart');
  if (!container) return;

  if (activityEntries.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity data</div>';
    return;
  }

  const { buckets, oldest, newest } = calculateTimeBuckets();

  if (buckets.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity data</div>';
    return;
  }

  // Handle single activity
  if (activityEntries.length === 1) {
    container.innerHTML = `<div class="activity-chart">
      <div class="chart-bars">
        <div class="chart-bar" style="height: 100%" title="1 change at ${formatChartTooltip(activityEntries[0].timestamp)}">
          <span class="bar-value">1</span>
        </div>
      </div>
      <div class="chart-axis">
        <span class="axis-start">${formatChartTime(activityEntries[0].timestamp)}</span>
        <span class="axis-end">Now</span>
      </div>
    </div>`;
    return;
  }

  // Find max count for height calculation
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  // Generate bar HTML
  const barsHtml = buckets.map(bucket => {
    const heightPercent = Math.round((bucket.count / maxCount) * 100);
    const tooltipTime = formatChartTooltip(bucket.start);
    const tooltipText = `${bucket.count} change${bucket.count !== 1 ? 's' : ''} at ${tooltipTime}`;

    // Don't show bars with 0 height, just show a minimal bar
    const effectiveHeight = bucket.count === 0 ? 2 : heightPercent;
    const opacity = bucket.count === 0 ? 0.2 : 1;

    return `<div class="chart-bar" style="height: ${effectiveHeight}%; opacity: ${opacity}" title="${tooltipText}">
      ${bucket.count > 0 ? `<span class="bar-value">${bucket.count}</span>` : ''}
    </div>`;
  }).join('');

  container.innerHTML = `<div class="activity-chart">
    <div class="chart-bars">
      ${barsHtml}
    </div>
    <div class="chart-axis">
      <span class="axis-start">${formatChartTime(oldest)}</span>
      <span class="axis-end">Now</span>
    </div>
  </div>`;
}

// Git status state
let gitStatusData = { modified: [], staged: [], untracked: [] };
let currentBranch = null;
let gitCommitsData = [];

// Fetch git status for the current project
async function fetchGitStatus(projectPath) {
  if (!window.electronAPI || !window.electronAPI.getGitStatus) {
    console.log('[Git] Git API not available');
    return;
  }

  try {
    const result = await window.electronAPI.getGitStatus(projectPath);
    if (result && !result.error) {
      gitStatusData = {
        modified: result.modified || [],
        staged: result.staged || [],
        untracked: result.untracked || []
      };
      console.log('[Git] Status loaded:', gitStatusData);
    } else {
      gitStatusData = { modified: [], staged: [], untracked: [] };
      console.log('[Git] Not a git repo or error:', result?.error);
    }
  } catch (err) {
    console.error('[Git] Error fetching status:', err);
    gitStatusData = { modified: [], staged: [], untracked: [] };
  }
}

// Fetch and display current git branch
async function fetchGitBranch(projectPath) {
  if (!window.electronAPI || !window.electronAPI.getGitBranch) {
    console.log('[Git] Branch API not available');
    return;
  }

  const branchDisplay = document.getElementById('branch-display');
  const branchName = document.getElementById('branch-name');

  try {
    const result = await window.electronAPI.getGitBranch(projectPath);
    if (result && result.branch && !result.error) {
      currentBranch = result.branch;
      branchName.textContent = result.branch;
      branchDisplay.classList.remove('no-branch');
      branchDisplay.title = `Current branch: ${result.branch}`;
      console.log('[Git] Branch:', result.branch);
    } else {
      currentBranch = null;
      branchName.textContent = 'not a git repo';
      branchDisplay.classList.add('no-branch');
      branchDisplay.title = 'Not a git repository';
    }
  } catch (err) {
    console.error('[Git] Error fetching branch:', err);
    currentBranch = null;
    branchName.textContent = '\u2014';
    branchDisplay.classList.add('no-branch');
  }
}

// Fetch recent git commits
async function fetchGitCommits(projectPath, limit = 10) {
  if (!window.electronAPI || !window.electronAPI.getGitCommits) {
    console.log('[Git] Commits API not available');
    return;
  }

  try {
    const result = await window.electronAPI.getGitCommits(projectPath, limit);
    if (result && result.commits && !result.error) {
      gitCommitsData = result.commits;
      console.log('[Git] Commits loaded:', gitCommitsData.length);
    } else {
      gitCommitsData = [];
    }
  } catch (err) {
    console.error('[Git] Error fetching commits:', err);
    gitCommitsData = [];
  }
}

// Heat decay slider handler
document.getElementById('heat-decay-slider')?.addEventListener('input', async (e) => {
  const seconds = parseInt(e.target.value, 10);
  heatDecayDuration = seconds * 1000; // Convert to ms

  // Update display
  const valueDisplay = document.getElementById('heat-decay-value');
  if (valueDisplay) valueDisplay.textContent = formatHeatDuration(seconds);

  // Save to store
  try {
    await window.electronAPI.store.set('heatDecaySeconds', seconds);
  } catch (err) {
    console.log('[Heat] Could not save setting:', err);
  }
});

// Load heat decay setting on startup
loadHeatDecaySetting();

console.log('GSD Viewer initialized - select a project folder to visualize');
