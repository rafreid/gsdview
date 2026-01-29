import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { state, subscribe, setState, getState, initializeState, resetViewState, callDiagramFilesChangedHandler, registerHighlightNodeHandler, registerOpenFileInspectorHandler } from './state-manager.js';
import { formatFileSize, formatRelativeTime } from './shared-utils.js';
import { dispatchClaudeOperation, dispatchFileChange } from './activity-dispatcher.js';

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
// NOTE: Moved to state-manager.js - access via state.state.currentGraphData

// Store selected project path and state
// NOTE: Moved to state-manager.js - access via state.state.selectedProjectPath, state.state.currentState, state.state.selectedNode

// Tree panel state
// NOTE: Moved to state-manager.js - access via state.state.treeData, state.state.treeExpanded

// View state
// NOTE: Moved to state-manager.js - access via state.state.is3D

// Activity feed state
// NOTE: Moved to state-manager.js - access via state.state.activityEntries, state.state.activityUnreadCount
const MAX_ACTIVITY_ENTRIES = 100; // Limit to prevent memory issues

// Activity trail state
let activityTrailsEnabled = true; // User toggle (default on)
let activityTrails = []; // Array of { fromNodeId, toNodeId, timestamp, lineObject }
const TRAIL_FADE_DURATION_DEFAULT = 60000; // 1 minute default (ms)
let trailFadeDuration = TRAIL_FADE_DURATION_DEFAULT; // User-configurable trail fade duration (ms)
const MAX_TRAILS = 20; // Maximum number of trail connections to show
let trailAnimationLoop = null; // Reference to animation loop

// Navigation history (browser-style back/forward)
// NOTE: Moved to state-manager.js - access via state.state.navigationHistory, state.state.navigationIndex
const MAX_HISTORY_SIZE = 50;     // Limit to prevent memory bloat
let isNavigating = false;        // Flag to prevent history push during back/forward (local state)

// Timeline replay state
let timelinePosition = null; // null = live mode (tracking latest), number = historical timestamp
let isTimelinePlaying = false;
let playbackInterval = null;
const PLAYBACK_SPEED = 500; // ms between steps during playback

// Bookmarks (slots 1-9)
// NOTE: Moved to state-manager.js - access via state.state.bookmarks
let currentBookmarkSlot = 0;  // Track selected slot in dialog (local state)

// Path playback state
let pathPlaybackEnabled = false;
let pathWaypoints = []; // Array of { nodeId, cameraPosition, name, slot }
let currentWaypointIndex = 0;
let pathPlaybackTimeoutId = null;
const PATH_DWELL_TIME = 2000; // Time to pause at each waypoint (ms)
const PATH_TRANSITION_TIME = 1500; // Time to fly between waypoints (ms)

// Minimap state
let minimapCollapsed = false;
let minimapCanvas = null;
let minimapCtx = null;
let minimapBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }; // World coordinate bounds
const MINIMAP_PADDING = 10; // Pixels of padding around minimap content
let minimapRafId = null; // RAF loop ID for continuous updates
let minimapDragging = false; // Track drag state for continuous positioning

// Modal search state
let currentSearchQuery = '';
let searchMatches = [];
let currentMatchIndex = -1;

// Track nodes currently flashing (nodeId -> animation state)
const flashingNodes = new Map();

// Animation batching to handle rapid operation bursts
const MAX_CONCURRENT_FLASHES = 20; // Limit concurrent animations
const pendingFlashes = [];          // Queue for overflow

// Track currently highlighted node (for hover effect)
// NOTE: Moved to state-manager.js - access via state.state.highlightedNodeId

// Double-click detection for file inspector
let lastClickTime = 0;
let lastClickNode = null;
const DOUBLE_CLICK_THRESHOLD = 300; // ms

// File inspector modal state
// NOTE: Moved to state-manager.js - access via state.state.inspectorNode
let inspectorDiffMode = 'git'; // 'git' or 'session' (local state)
const sessionFileSnapshots = new Map(); // filePath -> { content: string, timestamp: number } (local state)

// Change type colors for type-specific animations (brighter, more saturated)
const changeTypeColors = {
  read: 0x4488FF,     // Bright blue - read operations (Claude only)
  created: 0x00FF88,  // Bright neon green (was 0x2ECC71)
  modified: 0xFFAA00, // Bright amber/orange (was 0xF39C12)
  deleted: 0xFF3333   // Bright red (was 0xE74C3C)
};

// Flash animation configuration
let flashDuration = 2000;  // Default flash duration in ms
let flashIntensity = 1.5;  // Intensity multiplier for glow and scale effects (increased from 1.0)
let particleEffectsEnabled = true;  // Enable/disable particle burst effects

// Particle system tracking
const activeParticleBursts = [];  // Array of active particle systems

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

// Store reference to directory data for tree panel sync
let storedDirectoryData = null;

// ============================================================================
// Animation Frame Tracking for Cleanup
// ============================================================================

/**
 * Registry for all animation frame IDs to enable proper cleanup on unmount
 * All requestAnimationFrame calls should register their IDs here
 */
const animationFrameIds = {
  heatLoop: null,       // Heat map decay animation loop
  trailLoop: null,      // Activity trail fade animation loop
  minimap: null,        // Minimap continuous update loop
  orbit: null,          // Orbit camera animation loop
  particles: null       // Particle burst animation loop (self-calling, tracked separately)
};

// ============================================================================
// Position Fixing Functions (for smooth incremental graph updates)
// ============================================================================

// Fix all existing nodes at their current positions
// Call this BEFORE adding new nodes to prevent layout disruption
function fixExistingNodePositions() {
  state.currentGraphData.nodes.forEach(node => {
    // Only fix if the node has settled (has position)
    if (node.x !== undefined && node.y !== undefined) {
      node.fx = node.x;
      node.fy = node.y;
      if (node.z !== undefined) {
        node.fz = node.z;
      }
    }
  });
}

// Remove fixed positions from specified nodes (or all if no ids provided)
function unfixNodePositions(nodeIds = null) {
  state.currentGraphData.nodes.forEach(node => {
    if (nodeIds === null || nodeIds.includes(node.id)) {
      delete node.fx;
      delete node.fy;
      delete node.fz;
    }
  });
}

// Update storedDirectoryData when files are added or removed
function updateStoredDirectoryData(operation, node) {
  if (!storedDirectoryData) return;

  if (operation === 'add') {
    // Add to nodes array
    storedDirectoryData.nodes.push({
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      extension: node.extension,
      sourceType: node.sourceType
    });
  } else if (operation === 'remove') {
    // Remove from nodes array
    storedDirectoryData.nodes = storedDirectoryData.nodes.filter(n => n.id !== node.id);
    // Remove links
    storedDirectoryData.links = storedDirectoryData.links.filter(
      l => l.source !== node.id && l.target !== node.id
    );
  }
}

// Build a file or directory node with positioning near parent
// Returns { node, parentId } for easy linking
function buildFileNode(filePath, sourceType) {
  // Determine parent directory node ID
  const pathParts = filePath.split('/');
  const fileName = pathParts.pop();
  const parentPath = pathParts.join('/');

  // Build parent node ID
  let parentId;
  if (parentPath === '') {
    // Direct child of root directory (planning or src)
    parentId = sourceType === 'planning' ? 'dir-planning' : 'dir-src';
  } else {
    parentId = `${sourceType}-dir-${parentPath}`;
  }

  // Find parent node to get its position
  const parentNode = state.currentGraphData.nodes.find(n => n.id === parentId);

  // Determine if this is a file or directory based on extension
  const isDirectory = !fileName.includes('.');
  const nodeType = isDirectory ? 'directory' : 'file';
  const nodeId = `${sourceType}-${nodeType === 'directory' ? 'dir' : 'file'}-${filePath}`;

  // Build node object
  const node = {
    id: nodeId,
    name: fileName,
    type: nodeType,
    path: filePath,
    sourceType: sourceType
  };

  // If it's a file, extract extension
  if (nodeType === 'file') {
    const ext = fileName.split('.').pop();
    node.extension = ext;
  }

  // Position near parent with some random offset
  if (parentNode && parentNode.x !== undefined) {
    const offset = 20;  // Distance from parent
    node.x = parentNode.x + (Math.random() - 0.5) * offset;
    node.y = parentNode.y + (Math.random() - 0.5) * offset;
    node.z = (parentNode.z || 0) + (Math.random() - 0.5) * offset;
  }

  return { node, parentId };
}

// ============================================================================
// Heat & Animation Helper Functions
// ============================================================================

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

// Format flash duration in milliseconds to human-readable string
function formatFlashDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`.replace('.0s', 's');
}

// Format flash intensity multiplier to display string
function formatFlashIntensity(value) {
  return `${(value / 100).toFixed(1)}x`.replace('.0x', 'x');
}

// Load flash settings from store
async function loadFlashSettings() {
  try {
    const savedDuration = await window.electronAPI.store.get('flashDuration');
    if (savedDuration && typeof savedDuration === 'number') {
      flashDuration = savedDuration;
      const slider = document.getElementById('flash-duration-slider');
      const valueDisplay = document.getElementById('flash-duration-value');
      if (slider) slider.value = savedDuration;
      if (valueDisplay) valueDisplay.textContent = formatFlashDuration(savedDuration);
      // Update CSS custom property for tree flash animations
      document.documentElement.style.setProperty('--flash-duration', `${savedDuration}ms`);
    }

    const savedIntensity = await window.electronAPI.store.get('flashIntensity');
    if (savedIntensity && typeof savedIntensity === 'number') {
      // Allow up to 3x intensity (slider still 50-200 range, but multiply by 1.5)
      flashIntensity = (savedIntensity / 100) * 1.5; // Convert and boost: 50->0.75x, 100->1.5x, 200->3x
      const slider = document.getElementById('flash-intensity-slider');
      const valueDisplay = document.getElementById('flash-intensity-value');
      if (slider) slider.value = savedIntensity;
      if (valueDisplay) valueDisplay.textContent = formatFlashIntensity(savedIntensity);
    }

    const savedParticleEffects = await window.electronAPI.store.get('particleEffectsEnabled');
    if (savedParticleEffects !== undefined) {
      particleEffectsEnabled = savedParticleEffects;
      const toggle = document.getElementById('particle-effects-toggle');
      if (toggle) toggle.checked = particleEffectsEnabled;
    }
  } catch (err) {
    console.log('[Flash] Using default flash settings');
  }
}

// Follow-active camera mode
let followActiveEnabled = false; // Default off - user opts in

// Orbit mode state
let orbitModeEnabled = false;
let orbitSpeed = 0.5; // Radians per second (configurable)
let orbitAngle = 0; // Current orbit angle
let orbitAnimationId = null; // RAF reference
let orbitCenterNode = null; // Node being orbited
let orbitRadius = 0; // Current orbit radius (adjustable via zoom)
const ORBIT_RADIUS_MULTIPLIER = 1.5; // Distance from node (multiplied by node's current camera distance)
const ORBIT_ZOOM_SENSITIVITY = 0.002; // How much wheel affects orbit radius
const ORBIT_MIN_RADIUS = 50; // Minimum zoom distance
const ORBIT_MAX_RADIUS = 2000; // Maximum zoom distance

// Hook status detection
let hookStatusTimeout = null;
let hookNotificationDismissed = false;
const HOOK_DETECTION_DELAY = 30000; // 30 seconds

// Debug mode
let debugModeEnabled = false;
const MAX_DEBUG_ENTRIES = 50;

// Format trail duration for display (value in ms, display in seconds)
function formatTrailDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

// Load trail settings from store
async function loadTrailSettings() {
  try {
    // Load enabled state
    const savedEnabled = await window.electronAPI.store.get('activityTrailsEnabled');
    if (savedEnabled !== undefined && savedEnabled !== null) {
      activityTrailsEnabled = savedEnabled;
      const toggle = document.getElementById('trails-toggle');
      if (toggle) {
        if (activityTrailsEnabled) {
          toggle.classList.add('active');
        } else {
          toggle.classList.remove('active');
        }
      }
    }

    // Load trail fade duration
    const savedDuration = await window.electronAPI.store.get('trailFadeDuration');
    if (savedDuration && typeof savedDuration === 'number') {
      trailFadeDuration = savedDuration;
      const slider = document.getElementById('trail-duration-slider');
      const valueDisplay = document.getElementById('trail-duration-value');
      if (slider) slider.value = savedDuration / 1000; // Convert ms to seconds for slider
      if (valueDisplay) valueDisplay.textContent = formatTrailDuration(savedDuration);
    }

    console.log('[Trail] Loaded settings, enabled:', activityTrailsEnabled, 'duration:', trailFadeDuration);
  } catch (err) {
    console.log('[Trail] Using default trail settings');
  }
}

// Load follow-active setting from store
async function loadFollowActiveSetting() {
  try {
    const saved = await window.electronAPI.store.get('followActiveEnabled');
    if (typeof saved === 'boolean') {
      followActiveEnabled = saved;
      const toggle = document.getElementById('follow-toggle');
      if (toggle) {
        if (followActiveEnabled) {
          toggle.classList.add('active');
        } else {
          toggle.classList.remove('active');
        }
      }
    }
  } catch (err) {
    console.log('[Camera] Could not load follow-active setting:', err);
  }
}

// ===== Navigation History Functions =====

// Push node to navigation history (called when user selects a node)
function pushNavigationHistory(nodeId) {
  // Don't push if we're navigating via back/forward
  if (isNavigating) return;

  // Don't push duplicate of current position
  if (state.navigationHistory[state.navigationIndex] === nodeId) return;

  // If we navigated back and then select new node, truncate forward history
  if (state.navigationIndex < state.navigationHistory.length - 1) {
    state.navigationHistory = state.navigationHistory.slice(0, state.navigationIndex + 1);
  }

  // Add new entry
  state.navigationHistory.push(nodeId);
  state.navigationIndex = state.navigationHistory.length - 1;

  // Trim if exceeds max size (remove oldest)
  if (state.navigationHistory.length > MAX_HISTORY_SIZE) {
    state.navigationHistory.shift();
    state.navigationIndex--;
  }

  // Update UI state
  updateNavigationButtonStates();
  updateRecentNodesDropdown();

  // Persist to store (async, non-blocking)
  saveNavigationHistory();
}

// Navigate back in history
function navigateBack() {
  if (state.navigationIndex <= 0) return;

  isNavigating = true;
  state.navigationIndex--;
  const nodeId = state.navigationHistory[state.navigationIndex];

  // Find and navigate to node
  const node = state.currentGraphData?.nodes?.find(n => n.id === nodeId);
  if (node) {
    flyToNodeSmooth(nodeId, 80);
    showDetailsPanel(node);
  }

  updateNavigationButtonStates();
  updateRecentNodesDropdown();
  isNavigating = false;

  console.log('[Nav] Back to:', nodeId, 'index:', state.navigationIndex);
}

// Navigate forward in history
function navigateForward() {
  if (state.navigationIndex >= state.navigationHistory.length - 1) return;

  isNavigating = true;
  state.navigationIndex++;
  const nodeId = state.navigationHistory[state.navigationIndex];

  // Find and navigate to node
  const node = state.currentGraphData?.nodes?.find(n => n.id === nodeId);
  if (node) {
    flyToNodeSmooth(nodeId, 80);
    showDetailsPanel(node);
  }

  updateNavigationButtonStates();
  updateRecentNodesDropdown();
  isNavigating = false;

  console.log('[Nav] Forward to:', nodeId, 'index:', state.navigationIndex);
}

// Update navigation button enabled/disabled states
function updateNavigationButtonStates() {
  const backBtn = document.getElementById('nav-back');
  const forwardBtn = document.getElementById('nav-forward');

  if (backBtn) {
    if (state.navigationIndex > 0) {
      backBtn.classList.remove('disabled');
    } else {
      backBtn.classList.add('disabled');
    }
  }

  if (forwardBtn) {
    if (state.navigationIndex < state.navigationHistory.length - 1) {
      forwardBtn.classList.remove('disabled');
    } else {
      forwardBtn.classList.add('disabled');
    }
  }
}

// Update recent nodes dropdown with last 10 visited
function updateRecentNodesDropdown() {
  const dropdown = document.getElementById('recent-nodes');
  if (!dropdown) return;

  // Get last 10 unique node IDs (most recent first)
  const recentIds = [];
  for (let i = state.navigationHistory.length - 1; i >= 0 && recentIds.length < 10; i--) {
    const nodeId = state.navigationHistory[i];
    if (!recentIds.includes(nodeId)) {
      recentIds.push(nodeId);
    }
  }

  // Build dropdown options
  let html = '<option value="">Recent nodes...</option>';
  recentIds.forEach(nodeId => {
    const node = state.currentGraphData?.nodes?.find(n => n.id === nodeId);
    if (node) {
      // Extract display name (last part of path or node name)
      const displayName = node.name || nodeId.split('/').pop() || nodeId;
      const truncated = displayName.length > 25 ? displayName.substring(0, 22) + '...' : displayName;
      html += `<option value="${nodeId}">${truncated}</option>`;
    }
  });

  dropdown.innerHTML = html;
}

// Save navigation history to electron-store
async function saveNavigationHistory() {
  try {
    await window.electronAPI.store.set('state.navigationHistory', {
      history: state.navigationHistory,
      index: state.navigationIndex
    });
  } catch (err) {
    console.log('[Nav] Could not save history:', err);
  }
}

// Load navigation history from electron-store
async function loadNavigationHistory() {
  try {
    const saved = await window.electronAPI.store.get('state.navigationHistory');
    if (saved && Array.isArray(saved.history)) {
      state.navigationHistory = saved.history;
      state.navigationIndex = typeof saved.index === 'number' ? saved.index : saved.history.length - 1;
      updateNavigationButtonStates();
      updateRecentNodesDropdown();
      console.log('[Nav] Loaded history:', state.navigationHistory.length, 'entries, index:', state.navigationIndex);
    }
  } catch (err) {
    console.log('[Nav] Could not load history:', err);
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
  const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
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
        const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
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
      animationFrameIds.heatLoop = requestAnimationFrame(heatLoop);
      heatLoopRafId = animationFrameIds.heatLoop;
    } else {
      heatLoopRunning = false;
      heatLoopRafId = null;
      animationFrameIds.heatLoop = null;
    }
  }

  animationFrameIds.heatLoop = requestAnimationFrame(heatLoop);
  heatLoopRafId = animationFrameIds.heatLoop;
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
// ACTIVITY TRAIL FUNCTIONS
// =====================================================

// Create a trail line between two nodes
function createActivityTrail(fromNodeId, toNodeId) {
  // Find both nodes in the graph
  const fromNode = state.currentGraphData.nodes.find(n => n.id === fromNodeId);
  const toNode = state.currentGraphData.nodes.find(n => n.id === toNodeId);

  // If either node is missing (deleted file), skip trail creation
  if (!fromNode || !toNode) {
    console.log('[Trail] Skipping - missing node:', !fromNode ? fromNodeId : toNodeId);
    return null;
  }

  // Need positions to draw the line - check if nodes have settled
  if (fromNode.x === undefined || toNode.x === undefined) {
    console.log('[Trail] Skipping - nodes not yet positioned');
    return null;
  }

  // Create geometry with two points
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    fromNode.x, fromNode.y, fromNode.z || 0,
    toNode.x, toNode.y, toNode.z || 0
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Create dashed material for visual distinction from solid graph edges
  // Dash pattern: 8 units dash, 4 units gap
  const material = new THREE.LineDashedMaterial({
    color: 0x4ECDC4, // Bright cyan to match UI theme
    transparent: true,
    opacity: 0.8,
    dashSize: 8,
    gapSize: 4,
    linewidth: 2 // Note: linewidth only works on some platforms
  });

  // Create the line object
  const line = new THREE.Line(geometry, material);
  line.name = `trail-${fromNodeId}-${toNodeId}`;

  // Compute line distances for dashed material to work
  line.computeLineDistances();

  // Add to the graph's scene
  if (typeof Graph !== 'undefined' && Graph.scene) {
    Graph.scene().add(line);
  }

  // Store trail info
  const trail = {
    fromNodeId,
    toNodeId,
    timestamp: Date.now(),
    lineObject: line
  };

  activityTrails.push(trail);

  console.log('[Trail] Created trail from', fromNodeId, 'to', toNodeId);

  return trail;
}

// Clean up trails older than trailFadeDuration
function cleanupOldTrails() {
  const now = Date.now();
  const trailsToRemove = [];

  activityTrails.forEach((trail, index) => {
    const age = now - trail.timestamp;
    if (age > trailFadeDuration) {
      trailsToRemove.push(index);

      // Remove from scene
      if (trail.lineObject && typeof Graph !== 'undefined' && Graph.scene) {
        Graph.scene().remove(trail.lineObject);

        // Dispose geometry and material to prevent memory leaks
        if (trail.lineObject.geometry) {
          trail.lineObject.geometry.dispose();
        }
        if (trail.lineObject.material) {
          trail.lineObject.material.dispose();
        }
      }
    }
  });

  // Remove old trails from array (reverse order to maintain indices)
  for (let i = trailsToRemove.length - 1; i >= 0; i--) {
    activityTrails.splice(trailsToRemove[i], 1);
  }

  if (trailsToRemove.length > 0) {
    console.log('[Trail] Cleaned up', trailsToRemove.length, 'old trails');
  }
}

// Trim trails if exceeding MAX_TRAILS (remove oldest)
function trimExcessTrails() {
  while (activityTrails.length > MAX_TRAILS) {
    const oldest = activityTrails.shift();

    if (oldest.lineObject && typeof Graph !== 'undefined' && Graph.scene) {
      Graph.scene().remove(oldest.lineObject);

      if (oldest.lineObject.geometry) {
        oldest.lineObject.geometry.dispose();
      }
      if (oldest.lineObject.material) {
        oldest.lineObject.material.dispose();
      }
    }

    console.log('[Trail] Trimmed excess trail');
  }
}

// Clear all activity trails
function clearAllTrails() {
  activityTrails.forEach(trail => {
    if (trail.lineObject && typeof Graph !== 'undefined' && Graph.scene) {
      Graph.scene().remove(trail.lineObject);

      if (trail.lineObject.geometry) {
        trail.lineObject.geometry.dispose();
      }
      if (trail.lineObject.material) {
        trail.lineObject.material.dispose();
      }
    }
  });

  activityTrails = [];
  console.log('[Trail] Cleared all trails');
}

// Update trail line positions to follow moving nodes
function updateTrailPositions() {
  activityTrails.forEach(trail => {
    const fromNode = state.currentGraphData.nodes.find(n => n.id === trail.fromNodeId);
    const toNode = state.currentGraphData.nodes.find(n => n.id === trail.toNodeId);

    // If either node is gone, mark for removal
    if (!fromNode || !toNode || fromNode.x === undefined || toNode.x === undefined) {
      return;
    }

    // Update the line geometry positions
    if (trail.lineObject && trail.lineObject.geometry) {
      const positions = trail.lineObject.geometry.attributes.position;
      if (positions) {
        // Update from node position
        positions.array[0] = fromNode.x;
        positions.array[1] = fromNode.y;
        positions.array[2] = fromNode.z || 0;

        // Update to node position
        positions.array[3] = toNode.x;
        positions.array[4] = toNode.y;
        positions.array[5] = toNode.z || 0;

        positions.needsUpdate = true;

        // Recompute line distances for dashed material
        trail.lineObject.computeLineDistances();
      }
    }
  });
}

// Update trail opacities and colors based on age (newer = more opaque)
function updateTrailOpacities() {
  const now = Date.now();

  activityTrails.forEach(trail => {
    if (!trail.lineObject || !trail.lineObject.material) return;

    const age = now - trail.timestamp;
    const ageRatio = Math.min(age / trailFadeDuration, 1.0);

    // Opacity fades from 0.9 (new) to 0.15 (old) - smoother fade
    const opacity = 0.9 - (ageRatio * 0.75);
    trail.lineObject.material.opacity = Math.max(0.15, opacity);

    // Enhanced color gradient: bright cyan -> teal -> dim blue-gray
    // Phases: 0-0.3 bright cyan, 0.3-0.7 teal transition, 0.7-1.0 dim gray
    let r, g, b;
    if (ageRatio < 0.3) {
      // Bright cyan phase (0x4ECDC4)
      r = 0x4E;
      g = 0xCD;
      b = 0xC4;
    } else if (ageRatio < 0.7) {
      // Transition to teal (0x4ECDC4 -> 0x2D8B84)
      const phase = (ageRatio - 0.3) / 0.4;
      r = Math.round(0x4E - (phase * 0x21)); // 78 -> 45
      g = Math.round(0xCD - (phase * 0x42)); // 205 -> 139
      b = Math.round(0xC4 - (phase * 0x40)); // 196 -> 132
    } else {
      // Fade to dim blue-gray (0x2D8B84 -> 0x1a4a4a)
      const phase = (ageRatio - 0.7) / 0.3;
      r = Math.round(0x2D - (phase * 0x13)); // 45 -> 26
      g = Math.round(0x8B - (phase * 0x41)); // 139 -> 74
      b = Math.round(0x84 - (phase * 0x3A)); // 132 -> 74
    }

    const fadedColor = (r << 16) | (g << 8) | b;
    trail.lineObject.material.color.setHex(fadedColor);
  });
}

// Animation loop for trail updates
let trailLoopRunning = false;
let trailLoopRafId = null;

function startTrailAnimationLoop() {
  if (trailLoopRunning) return;
  trailLoopRunning = true;

  function trailLoop() {
    if (!trailLoopRunning) return;

    // Update positions as nodes move
    updateTrailPositions();

    // Update opacities based on age
    updateTrailOpacities();

    // Clean up old trails
    cleanupOldTrails();

    // Continue loop if there are still trails
    if (activityTrails.length > 0) {
      animationFrameIds.trailLoop = requestAnimationFrame(trailLoop);
      trailLoopRafId = animationFrameIds.trailLoop;
    } else {
      trailLoopRunning = false;
      trailLoopRafId = null;
      animationFrameIds.trailLoop = null;
    }
  }

  animationFrameIds.trailLoop = requestAnimationFrame(trailLoop);
  trailLoopRafId = animationFrameIds.trailLoop;
}

// Stop trail animation loop
function stopTrailAnimationLoop() {
  trailLoopRunning = false;
  if (trailLoopRafId) {
    cancelAnimationFrame(trailLoopRafId);
    trailLoopRafId = null;
  }
}

// =====================================================
// TIMELINE REPLAY HELPER FUNCTIONS
// =====================================================

// Get timeline range from activity entries
function getTimelineRange() {
  if (state.activityEntries.length === 0) {
    const now = Date.now();
    return { min: now, max: now };
  }

  const timestamps = state.activityEntries.map(e => e.timestamp);
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
  if (!state.activityEntries.length) return;

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
  state.currentGraphData.nodes.forEach(node => {
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

    const fileStatus = fileState.get(relativePath);
    let targetOpacity = 0.85; // Default opacity for files

    if (fileStatus === undefined) {
      // File not in activity history at this time - show normally
      targetOpacity = 0.85;
    } else if (fileStatus === 'exists') {
      // File exists at this time - show normally
      targetOpacity = 0.85;
    } else if (fileStatus === 'deleted') {
      // File was deleted - show faded
      targetOpacity = 0.3;
    } else if (fileStatus === 'not-yet-created') {
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
  const sortedEntries = [...state.activityEntries].sort((a, b) => a.timestamp - b.timestamp);

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
  state.currentGraphData.nodes.forEach(node => {
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
  state.activityEntries.unshift(entry);

  // Trim old entries
  if (state.activityEntries.length > MAX_ACTIVITY_ENTRIES) {
    state.activityEntries = state.activityEntries.slice(0, MAX_ACTIVITY_ENTRIES);
  }

  // Update badge if panel is closed
  const panel = document.getElementById('activity-panel');
  if (!panel || !panel.classList.contains('visible')) {
    state.activityUnreadCount++;
    updateActivityBadge();
    // Pulse the toggle button
    pulseActivityToggle();
  }

  updateActivityPanel();

  // Auto-scroll to top to show newest entry
  scrollActivityToTop();

  // Register heat state for this node
  if (entry.nodeId && entry.event !== 'deleted') {
    const node = state.currentGraphData.nodes.find(n => n.id === entry.nodeId);
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

  // Create activity trail if enabled and there's a previous entry
  if (activityTrailsEnabled && entry.nodeId && state.activityEntries.length > 1) {
    // Get the previous entry (second in array since we just unshifted new entry)
    const previousEntry = state.activityEntries[1];
    if (previousEntry && previousEntry.nodeId && previousEntry.nodeId !== entry.nodeId) {
      // Create trail from previous to current
      createActivityTrail(previousEntry.nodeId, entry.nodeId);

      // Cleanup old trails
      cleanupOldTrails();

      // Trim if exceeding max
      trimExcessTrails();

      // Start trail animation loop if not running
      startTrailAnimationLoop();
    }
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
    const node = state.currentGraphData.nodes.find(n =>
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
    const node = state.currentGraphData.nodes.find(n =>
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

// Create particle burst effect at node position
function createParticleBurst(position, color, intensity, changeType) {
  if (!particleEffectsEnabled) return;

  // Determine particle count based on change type
  let particleCount;
  if (changeType === 'deleted') {
    particleCount = Math.floor(25 * intensity);  // Larger burst for deletions
  } else if (changeType === 'read') {
    particleCount = Math.floor(12 * intensity);  // Smaller burst for reads
  } else {
    particleCount = Math.floor(20 * intensity);  // Standard burst
  }

  // Create particle geometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];

  for (let i = 0; i < particleCount; i++) {
    // Start all particles at the node position
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;

    // Random outward velocity
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 0.5 + Math.random() * 1.0;

    velocities.push({
      x: Math.sin(phi) * Math.cos(theta) * speed,
      y: Math.sin(phi) * Math.sin(theta) * speed,
      z: Math.cos(phi) * speed
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Create particle material
  const material = new THREE.PointsMaterial({
    color: color,
    size: 3,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // Create particle system
  const particles = new THREE.Points(geometry, material);
  Graph.scene().add(particles);

  // Track particle system for animation
  activeParticleBursts.push({
    particles,
    velocities,
    startTime: Date.now(),
    lifetime: 800  // ms
  });
}

// Animate all active particle bursts
function animateParticleBursts() {
  const now = Date.now();

  for (let i = activeParticleBursts.length - 1; i >= 0; i--) {
    const burst = activeParticleBursts[i];
    const elapsed = now - burst.startTime;
    const progress = Math.min(elapsed / burst.lifetime, 1);

    if (progress >= 1) {
      // Remove and dispose
      Graph.scene().remove(burst.particles);
      burst.particles.geometry.dispose();
      burst.particles.material.dispose();
      activeParticleBursts.splice(i, 1);
      continue;
    }

    // Update particle positions
    const positions = burst.particles.geometry.attributes.position.array;
    for (let j = 0; j < burst.velocities.length; j++) {
      const vel = burst.velocities[j];
      positions[j * 3] += vel.x;
      positions[j * 3 + 1] += vel.y - 0.01;  // Gravity
      positions[j * 3 + 2] += vel.z;
    }
    burst.particles.geometry.attributes.position.needsUpdate = true;

    // Fade opacity
    burst.particles.material.opacity = 0.8 * (1 - progress);
  }

  // Continue animation loop
  if (activeParticleBursts.length > 0) {
    requestAnimationFrame(animateParticleBursts);
  }
}

// Flash a node with change-type-specific color, emissive glow, and scale pulsing
function flashNodeWithType(nodeId, changeType) {
  const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.log('[Flash] Node not found:', nodeId);
    return;
  }

  const threeObj = node.__threeObj;
  if (!threeObj) {
    console.log('[Flash] No THREE object for node:', nodeId);
    return;
  }

  // Check concurrent flash limit - queue if at capacity
  if (flashingNodes.size >= MAX_CONCURRENT_FLASHES && !flashingNodes.has(nodeId)) {
    pendingFlashes.push({ nodeId, changeType });
    console.log('[Flash] Queued (active:', flashingNodes.size, 'pending:', pendingFlashes.length, '):', nodeId);
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

  // Get node world position for particle burst
  const nodePosition = new THREE.Vector3();
  threeObj.getWorldPosition(nodePosition);

  // Create initial particle burst
  createParticleBurst(nodePosition, flashColor, flashIntensity, changeType);

  // Start particle animation loop if not already running
  if (activeParticleBursts.length === 1) {
    requestAnimationFrame(animateParticleBursts);
  }

  // Store original emissive colors and intensities for restoration
  const originalEmissives = materials.map(m => {
    if (m.emissive) {
      return { color: m.emissive.getHex(), intensity: m.emissiveIntensity || 0 };
    }
    return null;
  });

  // Store original scale for restoration
  const originalScale = threeObj.scale.clone();

  // Animation parameters - different patterns per change type
  const duration = flashDuration;
  let pulseCount;
  let pulsePattern; // Function to customize pulse intensity over time

  if (changeType === 'created') {
    // Created: 4 quick pulses with increasing intensity (celebration effect)
    pulseCount = 4;
    pulsePattern = (progress, basePulse) => {
      const intensityRamp = 0.5 + progress * 0.5; // Start at 50%, ramp to 100%
      return basePulse * intensityRamp;
    };
  } else if (changeType === 'deleted') {
    // Deleted: 2 slow pulses then fade (warning effect)
    pulseCount = 2;
    pulsePattern = (progress, basePulse) => {
      // Slower, more ominous pulses
      return basePulse * (1 - progress * 0.3);
    };
  } else if (changeType === 'read') {
    // Read: 2 quick pulses (acknowledgment effect - lighter than modify)
    pulseCount = 2;
    pulsePattern = (progress, basePulse) => basePulse * 0.8; // Slightly dimmer
  } else {
    // Modified: 3 steady pulses (attention-getting)
    pulseCount = 3;
    pulsePattern = (progress, basePulse) => basePulse;
  }

  const startTime = Date.now();

  // For deleted nodes, we'll fade out at the end
  const isDelete = changeType === 'deleted';
  const originalOpacities = materials.map(m => m.opacity || 1);

  // Track second burst for 'created' type
  let secondBurstTriggered = false;

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Trigger second particle burst for 'created' type at 50% progress
    if (changeType === 'created' && !secondBurstTriggered && progress >= 0.5) {
      createParticleBurst(nodePosition, flashColor, flashIntensity, changeType);
      secondBurstTriggered = true;
    }

    // Pulsing effect with smoother ease-in-out curve (sin squared)
    const pulsePhase = progress * pulseCount * Math.PI * 2;
    const rawPulse = Math.sin(pulsePhase);
    const pulse = rawPulse * rawPulse * Math.sign(rawPulse); // Squared for smoother peaks
    const basePulse = Math.max(0, pulse);
    const decay = 1 - progress;
    const patternedPulse = pulsePattern(progress, basePulse);
    const intensity = patternedPulse * decay;

    materials.forEach((material, i) => {
      // Color pulse - boosted for more dramatic effect (use squared intensity for snappier response)
      const colorIntensity = Math.min(1, intensity * 1.5);  // Boost color change by 50%
      material.color.setHex(lerpColor(originalColors[i], flashColor, colorIntensity));

      // Emissive glow effect (only works with MeshStandardMaterial)
      if (material.emissive) {
        const emissiveIntensity = intensity * flashIntensity * 3.5;
        material.emissive.setHex(flashColor);
        material.emissiveIntensity = emissiveIntensity;
      }

      // For delete: fade out opacity in last 50% of animation
      if (isDelete && progress > 0.5) {
        const fadeProgress = (progress - 0.5) * 2; // 0 to 1 over second half
        material.opacity = originalOpacities[i] * (1 - fadeProgress * 0.7);
      }
    });

    // Scale pulse effect - enhanced for visibility (1.5x base multiplier)
    const scaleMultiplier = 1 + (intensity * 1.5 * flashIntensity);
    threeObj.scale.set(
      originalScale.x * scaleMultiplier,
      originalScale.y * scaleMultiplier,
      originalScale.z * scaleMultiplier
    );

    if (progress < 1) {
      const rafId = requestAnimationFrame(animate);
      flashingNodes.set(nodeId, { rafId, startTime, changeType, originalScale, originalEmissives });
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

        // Restore original emissive
        if (material.emissive && originalEmissives[i]) {
          material.emissive.setHex(originalEmissives[i].color);
          material.emissiveIntensity = originalEmissives[i].intensity;
        } else if (material.emissive) {
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        }
      });

      // Restore original scale
      threeObj.scale.copy(originalScale);

      flashingNodes.delete(nodeId);

      // Process pending flashes now that a slot is free (with stagger delay)
      if (pendingFlashes.length > 0) {
        setTimeout(processPendingFlashes, 50);
      }
    }
  }

  const rafId = requestAnimationFrame(animate);
  flashingNodes.set(nodeId, { rafId, startTime, changeType, originalScale, originalEmissives });
  console.log('[Flash] Started', changeType, 'flash for:', nodeId);
}

// Process queued flash animations when slots become available
function processPendingFlashes() {
  if (pendingFlashes.length === 0) return;
  if (flashingNodes.size >= MAX_CONCURRENT_FLASHES) return;

  const { nodeId, changeType } = pendingFlashes.shift();
  console.log('[Flash] Processing from queue (remaining:', pendingFlashes.length, '):', nodeId);
  flashNodeWithType(nodeId, changeType);

  // Stagger next batch item by 50ms to prevent frame spike
  if (pendingFlashes.length > 0) {
    setTimeout(processPendingFlashes, 50);
  } else {
    console.log('[Flash] Queue drained, all animations complete');
  }
}

// Flash a node when its file changes (fallback for manual flashes like tree clicks)
function flashNode(nodeId) {
  flashNodeWithType(nodeId, 'modified');
}

// Highlight a node in the graph (for hover effect from activity entries)
function highlightNodeInGraph(nodeId) {
  // Skip if already highlighted
  if (state.highlightedNodeId === nodeId) return;

  // Clear previous highlight
  clearNodeHighlight();

  const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node || !node.__threeObj) return;

  state.highlightedNodeId = nodeId;

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
  if (!state.highlightedNodeId) return;

  const node = state.currentGraphData.nodes.find(n => n.id === state.highlightedNodeId);
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

  state.highlightedNodeId = null;
}

// Track pending deletions to prevent duplicate fade animations
const pendingDeletions = new Set();

// Fade out and remove a node from the graph
function fadeOutAndRemoveNode(nodeId) {
  // Prevent duplicate animations
  if (pendingDeletions.has(nodeId)) {
    console.log('[Fade] Already fading:', nodeId);
    return;
  }

  const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.log('[Fade] Node not found:', nodeId);
    return;
  }

  const threeObj = node.__threeObj;
  if (!threeObj) {
    console.log('[Fade] No THREE object for node:', nodeId);
    // Remove immediately if no visual object
    removeNodeFromGraph(nodeId);
    return;
  }

  // Mark as pending deletion
  pendingDeletions.add(nodeId);

  // Cancel any active flash animation for this node
  if (flashingNodes.has(nodeId)) {
    const existing = flashingNodes.get(nodeId);
    if (existing.rafId) cancelAnimationFrame(existing.rafId);
    flashingNodes.delete(nodeId);
  }

  // Remove from pending flashes queue if present
  const pendingIndex = pendingFlashes.findIndex(item => item.nodeId === nodeId);
  if (pendingIndex !== -1) {
    pendingFlashes.splice(pendingIndex, 1);
  }

  // Clear from heat tracking
  nodeHeatMap.delete(nodeId);

  // Clear highlight if this is the highlighted node
  if (state.highlightedNodeId === nodeId) {
    clearNodeHighlight();
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

  // Enable transparency for opacity animation
  materials.forEach(material => {
    material.transparent = true;
  });

  // Store original scale for animation
  const originalScale = threeObj.scale.clone();

  // Animation parameters
  const duration = 500; // 500ms fade
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Check if node still exists (may have been removed by parent directory deletion)
    const stillExists = state.currentGraphData.nodes.find(n => n.id === nodeId);
    if (!stillExists) {
      console.log('[Fade] Node removed during animation:', nodeId);
      pendingDeletions.delete(nodeId);
      return;
    }

    // Ease-out curve for smooth deceleration
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    // Fade opacity to 0
    materials.forEach(material => {
      material.opacity = 1 - easeProgress;
    });

    // Slight scale-down for better visual effect (to 0.7x)
    const scale = 1 - (easeProgress * 0.3);
    threeObj.scale.set(
      originalScale.x * scale,
      originalScale.y * scale,
      originalScale.z * scale
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete - remove from graph
      removeNodeFromGraph(nodeId);
      pendingDeletions.delete(nodeId);
    }
  }

  animate();
  console.log('[Fade] Started fade-out for:', nodeId);
}

// Remove a node from the graph data and refresh
function removeNodeFromGraph(nodeId) {
  // Find child nodes if this is a directory
  const childNodeIds = [];
  state.currentGraphData.links.forEach(link => {
    const sourceId = link.source.id || link.source;
    const targetId = link.target.id || link.target;
    if (sourceId === nodeId) {
      childNodeIds.push(targetId);
    }
  });

  // Remove child nodes from pending deletions (they'll be removed with parent)
  childNodeIds.forEach(childId => {
    pendingDeletions.delete(childId);
  });

  // Remove node from state.currentGraphData.nodes
  state.currentGraphData.nodes = state.currentGraphData.nodes.filter(n => n.id !== nodeId);

  // Remove links where this node is source or target
  state.currentGraphData.links = state.currentGraphData.links.filter(
    link => link.source.id !== nodeId && link.target.id !== nodeId &&
            link.source !== nodeId && link.target !== nodeId
  );

  // Update storedDirectoryData for tree panel
  if (storedDirectoryData && storedDirectoryData.nodes) {
    storedDirectoryData.nodes = storedDirectoryData.nodes.filter(n => n.id !== nodeId);
    storedDirectoryData.links = storedDirectoryData.links.filter(
      link => link.source !== nodeId && link.target !== nodeId
    );
  }

  // Update graph
  Graph.graphData(state.currentGraphData);

  console.log('[Fade] Removed node from graph:', nodeId);
}

// Smooth camera fly to node (used by follow-active mode)
function flyToNodeSmooth(nodeId, distance = 80) {
  if (!Graph || !state.currentGraphData) return;

  const node = state.currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node || node.x === undefined) return;

  if (state.is3D) {
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: (node.z || 0) * distRatio
      },
      node,
      800  // Slightly faster transition for follow mode
    );
  } else {
    Graph.cameraPosition(
      { x: node.x || 0, y: node.y || 0, z: distance + 100 },
      node,
      800
    );
  }
}

// ============================================================
// ORBIT MODE (Presentation Camera Rotation)
// ============================================================

// Start orbit mode around currently selected node
function startOrbitMode() {
  if (!state.selectedNode || !Graph) return;

  orbitModeEnabled = true;
  orbitCenterNode = state.selectedNode;

  // Calculate initial orbit radius based on current camera distance
  const cameraPos = Graph.cameraPosition();
  const nodePos = { x: orbitCenterNode.x || 0, y: orbitCenterNode.y || 0, z: orbitCenterNode.z || 0 };
  const currentDistance = Math.sqrt(
    Math.pow(cameraPos.x - nodePos.x, 2) +
    Math.pow(cameraPos.y - nodePos.y, 2) +
    Math.pow(cameraPos.z - nodePos.z, 2)
  );
  orbitRadius = currentDistance * ORBIT_RADIUS_MULTIPLIER; // Use module-level variable

  // Calculate initial angle from current camera position
  orbitAngle = Math.atan2(cameraPos.x - nodePos.x, cameraPos.z - nodePos.z);

  let lastTime = performance.now();

  function orbitLoop(currentTime) {
    if (!orbitModeEnabled) {
      orbitAnimationId = null;
      return;
    }

    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    // Increment angle based on speed
    orbitAngle += orbitSpeed * deltaTime;

    // Calculate new camera position (orbit in XZ plane for 3D, XY for 2D)
    const nodePos = {
      x: orbitCenterNode.x || 0,
      y: orbitCenterNode.y || 0,
      z: orbitCenterNode.z || 0
    };

    if (state.is3D) {
      // 3D orbit: camera moves in XZ plane, Y stays at node height + offset
      const camX = nodePos.x + orbitRadius * Math.sin(orbitAngle);
      const camY = nodePos.y + orbitRadius * 0.3; // Slight elevation
      const camZ = nodePos.z + orbitRadius * Math.cos(orbitAngle);

      Graph.cameraPosition(
        { x: camX, y: camY, z: camZ },
        nodePos,
        0 // Instant positioning for smooth orbit
      );
    } else {
      // 2D orbit: camera rotates around node's XY position at fixed Z
      const camX = nodePos.x + orbitRadius * Math.sin(orbitAngle);
      const camY = nodePos.y + orbitRadius * Math.cos(orbitAngle);
      const camZ = 200; // Fixed Z height for 2D

      Graph.cameraPosition(
        { x: camX, y: camY, z: camZ },
        { x: nodePos.x, y: nodePos.y, z: 0 },
        0
      );
    }

    animationFrameIds.orbit = requestAnimationFrame(orbitLoop);
    orbitAnimationId = animationFrameIds.orbit;
  }

  animationFrameIds.orbit = requestAnimationFrame(orbitLoop);
  orbitAnimationId = animationFrameIds.orbit;

  // Update UI
  const toggle = document.getElementById('orbit-toggle');
  if (toggle) toggle.classList.add('active');
}

function stopOrbitMode() {
  orbitModeEnabled = false;
  if (orbitAnimationId) {
    cancelAnimationFrame(orbitAnimationId);
    orbitAnimationId = null;
  }
  orbitCenterNode = null;

  // Update UI
  const toggle = document.getElementById('orbit-toggle');
  if (toggle) toggle.classList.remove('active');
}

function toggleOrbitMode() {
  if (orbitModeEnabled) {
    stopOrbitMode();
  } else {
    if (!state.selectedNode) {
      showToast('Select a node first to orbit around', 'warning');
      return;
    }
    startOrbitMode();
  }
}

// Update orbit speed from slider
function updateOrbitSpeed(value) {
  // Slider value 1-10 maps to 0.1 - 1.0 radians/sec
  orbitSpeed = value / 10;
  const label = document.getElementById('orbit-speed-value');
  if (label) label.textContent = value.toFixed(1);
}

// Handle zoom (mouse wheel) during orbit mode
function handleOrbitZoom(deltaY) {
  if (!orbitModeEnabled) return false;

  // Adjust orbit radius based on wheel delta
  const zoomAmount = deltaY * ORBIT_ZOOM_SENSITIVITY * orbitRadius;
  orbitRadius = Math.max(ORBIT_MIN_RADIUS, Math.min(ORBIT_MAX_RADIUS, orbitRadius + zoomAmount));

  return true; // Indicate event was handled
}

// Load orbit speed setting from store
async function loadOrbitSpeedSetting() {
  try {
    const saved = await window.electronAPI.store.get('orbitSpeed');
    if (typeof saved === 'number') {
      const slider = document.getElementById('orbit-speed-slider');
      const label = document.getElementById('orbit-speed-value');
      if (slider) {
        slider.value = saved;
        orbitSpeed = saved / 10;
        if (label) label.textContent = saved.toFixed(1);
      }
    }
  } catch (err) {
    console.log('[Orbit] Could not load speed setting:', err);
  }
}

// ============================================================
// BOOKMARK MANAGEMENT
// ============================================================

// Save bookmark at slot (0-8 for keys 1-9)
function saveBookmark(slot, name) {
  if (slot < 0 || slot > 8) return;

  // Get current camera position
  let cameraPos = null;
  if (Graph && Graph.cameraPosition) {
    const pos = Graph.cameraPosition();
    cameraPos = { x: pos.x, y: pos.y, z: pos.z };
  }

  // Create bookmark entry
  state.bookmarks[slot] = {
    name: name || `Bookmark ${slot + 1}`,
    nodeId: state.selectedNode ? state.selectedNode.id : null,
    cameraPosition: cameraPos,
    timestamp: Date.now()
  };

  // Persist to store
  persistBookmarks();

  console.log('[Bookmark] Saved slot', slot + 1, ':', state.bookmarks[slot].name);

  // Update UI
  updateBookmarkIndicator();
}

// Delete bookmark at slot
function deleteBookmark(slot) {
  if (slot < 0 || slot > 8) return;
  state.bookmarks[slot] = null;
  persistBookmarks();
  updateBookmarkIndicator();
  console.log('[Bookmark] Deleted slot', slot + 1);

  // Update dialog if open
  if (document.getElementById('bookmark-dialog')?.classList.contains('visible')) {
    updateBookmarkList();
    updateBookmarkDialogSlots();
  }
}

// Navigate to bookmark at slot
function goToBookmark(slot) {
  if (slot < 0 || slot > 8) return;

  const bookmark = state.bookmarks[slot];
  if (!bookmark) {
    showToast(`Bookmark ${slot + 1} is empty`, false);
    return;
  }

  // Restore camera position
  if (bookmark.cameraPosition && Graph && Graph.cameraPosition) {
    Graph.cameraPosition(
      bookmark.cameraPosition,
      bookmark.nodeId ? state.currentGraphData?.nodes?.find(n => n.id === bookmark.nodeId) : null,
      800
    );
  }

  // Select and show node if it exists
  if (bookmark.nodeId) {
    const node = state.currentGraphData?.nodes?.find(n => n.id === bookmark.nodeId);
    if (node) {
      showDetailsPanel(node);
    } else {
      showToast(`Node no longer exists`, false);
    }
  }

  showToast(`Jumped to: ${bookmark.name}`, false);
  console.log('[Bookmark] Go to slot', slot + 1, ':', bookmark.name);
}

// Persist state.bookmarks to electron-store
async function persistBookmarks() {
  try {
    await window.electronAPI.store.set('state.bookmarks', state.bookmarks);
  } catch (err) {
    console.log('[Bookmark] Could not save:', err);
  }
}

// Load state.bookmarks from electron-store
async function loadBookmarks() {
  try {
    const saved = await window.electronAPI.store.get('state.bookmarks');
    if (saved && Array.isArray(saved)) {
      state.bookmarks = saved;
      // Ensure array is exactly 9 slots
      while (state.bookmarks.length < 9) state.bookmarks.push(null);
      if (state.bookmarks.length > 9) state.bookmarks.length = 9;
      updateBookmarkIndicator();
      console.log('[Bookmark] Loaded', state.bookmarks.filter(b => b !== null).length, 'state.bookmarks');
    }
  } catch (err) {
    console.log('[Bookmark] Could not load:', err);
  }
}

// Update bookmark button to show count of saved state.bookmarks
function updateBookmarkIndicator() {
  const btn = document.getElementById('bookmark-btn');
  if (!btn) return;

  const count = state.bookmarks.filter(b => b !== null).length;
  const badge = btn.querySelector('.bookmark-count');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// Show bookmark save dialog
function showBookmarkSaveDialog(slot = null) {
  currentBookmarkSlot = slot !== null ? slot : 0;

  // Show dialog
  const overlay = document.getElementById('bookmark-dialog-overlay');
  const dialog = document.getElementById('bookmark-dialog');
  overlay?.classList.remove('hidden');
  overlay?.classList.add('visible');
  dialog?.classList.remove('hidden');
  dialog?.classList.add('visible');

  // Populate slot buttons
  const slotsContainer = document.getElementById('bookmark-slots');
  if (slotsContainer) {
    let html = '';
    for (let i = 0; i < 9; i++) {
      const occupied = state.bookmarks[i] !== null;
      const selected = i === currentBookmarkSlot;
      html += `<div class="bookmark-slot ${occupied ? 'occupied' : ''} ${selected ? 'selected' : ''}" data-slot="${i}">
        <span class="slot-number">${i + 1}</span>
        <span class="slot-indicator"></span>
      </div>`;
    }
    slotsContainer.innerHTML = html;

    // Add click handlers for slots
    slotsContainer.querySelectorAll('.bookmark-slot').forEach(slotEl => {
      slotEl.addEventListener('click', () => {
        currentBookmarkSlot = parseInt(slotEl.dataset.slot, 10);
        slotsContainer.querySelectorAll('.bookmark-slot').forEach(s => s.classList.remove('selected'));
        slotEl.classList.add('selected');
        updateBookmarkDialogInfo();
      });
    });
  }

  // Set default name
  const nameInput = document.getElementById('bookmark-name');
  if (nameInput) {
    const existingName = state.bookmarks[currentBookmarkSlot]?.name;
    const nodeName = state.selectedNode?.name || state.selectedNode?.id?.split('/').pop() || '';
    nameInput.value = existingName || nodeName || `Bookmark ${currentBookmarkSlot + 1}`;
    nameInput.select();
    nameInput.focus();
  }

  updateBookmarkDialogInfo();
  updateBookmarkList();
}

// Update dialog info text
function updateBookmarkDialogInfo() {
  const info = document.getElementById('bookmark-current-info');
  if (!info) return;

  const existing = state.bookmarks[currentBookmarkSlot];
  if (existing) {
    info.textContent = `Slot ${currentBookmarkSlot + 1} contains: "${existing.name}" (will be replaced)`;
  } else {
    info.textContent = `Slot ${currentBookmarkSlot + 1} is empty. Press ${currentBookmarkSlot + 1} key to jump here.`;
  }
}

// Hide bookmark dialog
function hideBookmarkDialog() {
  const overlay = document.getElementById('bookmark-dialog-overlay');
  const dialog = document.getElementById('bookmark-dialog');
  overlay?.classList.remove('visible');
  overlay?.classList.add('hidden');
  dialog?.classList.remove('visible');
  dialog?.classList.add('hidden');
}

// Handle save button
function handleBookmarkSave() {
  const nameInput = document.getElementById('bookmark-name');
  const name = nameInput?.value?.trim() || `Bookmark ${currentBookmarkSlot + 1}`;
  saveBookmark(currentBookmarkSlot, name);
  hideBookmarkDialog();
  showToast(`Saved bookmark ${currentBookmarkSlot + 1}: ${name}`, false);
}

// Update bookmark list in dialog
function updateBookmarkList() {
  const listContainer = document.getElementById('bookmark-list');
  if (!listContainer) return;

  const savedBookmarks = state.bookmarks
    .map((b, i) => b ? { ...b, slot: i } : null)
    .filter(b => b !== null);

  if (savedBookmarks.length === 0) {
    listContainer.innerHTML = '<div class="bookmark-empty">No state.bookmarks saved. Press Ctrl+1-9 to save.</div>';
    return;
  }

  let html = '';
  savedBookmarks.forEach(b => {
    html += `<div class="bookmark-list-item" data-slot="${b.slot}">
      <span class="bm-slot">${b.slot + 1}</span>
      <span class="bm-name">${b.name}</span>
      <button class="bm-go" data-slot="${b.slot}">Go</button>
      <button class="bm-delete" data-slot="${b.slot}">Delete</button>
    </div>`;
  });

  listContainer.innerHTML = html;

  // Add event listeners
  listContainer.querySelectorAll('.bm-go').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = parseInt(btn.dataset.slot, 10);
      hideBookmarkDialog();
      goToBookmark(slot);
    });
  });

  listContainer.querySelectorAll('.bm-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = parseInt(btn.dataset.slot, 10);
      deleteBookmark(slot);
    });
  });
}

// Update slot indicators after delete
function updateBookmarkDialogSlots() {
  const slotsContainer = document.getElementById('bookmark-slots');
  if (!slotsContainer) return;

  slotsContainer.querySelectorAll('.bookmark-slot').forEach(slotEl => {
    const slot = parseInt(slotEl.dataset.slot, 10);
    if (state.bookmarks[slot]) {
      slotEl.classList.add('occupied');
    } else {
      slotEl.classList.remove('occupied');
    }
  });
}

// ============================================================
// PATH PLAYBACK (CAMERA TOUR THROUGH BOOKMARKS)
// ============================================================

// Start path playback through all saved state.bookmarks
function startPathPlayback() {
  // Get all non-empty state.bookmarks as waypoints
  pathWaypoints = state.bookmarks
    .map((bm, index) => bm ? { ...bm, slot: index + 1 } : null)
    .filter(bm => bm !== null && bm.nodeId !== null);

  if (pathWaypoints.length < 2) {
    showToast('Save at least 2 state.bookmarks to create a path (Ctrl+1-9)', 'warning');
    return;
  }

  pathPlaybackEnabled = true;
  currentWaypointIndex = 0;

  // Update UI
  const playBtn = document.getElementById('path-play');
  if (playBtn) {
    playBtn.classList.add('active');
    playBtn.innerHTML = '<span class="path-icon">&#9632;</span> Stop';
  }
  updatePathProgress();

  // Start the journey
  flyToWaypoint(0);
}

function stopPathPlayback() {
  pathPlaybackEnabled = false;
  if (pathPlaybackTimeoutId) {
    clearTimeout(pathPlaybackTimeoutId);
    pathPlaybackTimeoutId = null;
  }
  pathWaypoints = [];
  currentWaypointIndex = 0;

  // Update UI
  const playBtn = document.getElementById('path-play');
  if (playBtn) {
    playBtn.classList.remove('active');
    playBtn.innerHTML = '<span class="path-icon">&#9654;</span> Path';
  }
  updatePathProgress();
}

function flyToWaypoint(index) {
  if (!pathPlaybackEnabled || index >= pathWaypoints.length) {
    // Path complete - loop back to start
    if (pathPlaybackEnabled && pathWaypoints.length > 0) {
      // Loop the path
      currentWaypointIndex = 0;
      flyToWaypoint(0);
    } else {
      stopPathPlayback();
    }
    return;
  }

  currentWaypointIndex = index;
  updatePathProgress();

  const waypoint = pathWaypoints[index];

  // Find the node in graph data
  const node = state.currentGraphData?.nodes?.find(n => n.id === waypoint.nodeId);

  if (node && Graph) {
    // Fly to node position with smooth transition
    if (state.is3D) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      Graph.cameraPosition(
        {
          x: (node.x || 0) * distRatio,
          y: (node.y || 0) * distRatio,
          z: (node.z || 0) * distRatio
        },
        node,
        PATH_TRANSITION_TIME
      );
    } else {
      Graph.cameraPosition(
        { x: node.x || 0, y: node.y || 0, z: 180 },
        node,
        PATH_TRANSITION_TIME
      );
    }

    // Select the node
    state.selectedNode = node;
    showDetailsPanel(node);
    updateBreadcrumb(node);

    // Show toast with waypoint info
    showToast(`${index + 1}/${pathWaypoints.length}: ${waypoint.name || 'Bookmark ' + waypoint.slot}`, 'info');
  }

  // Schedule next waypoint after transition + dwell time
  pathPlaybackTimeoutId = setTimeout(() => {
    if (pathPlaybackEnabled) {
      flyToWaypoint(index + 1);
    }
  }, PATH_TRANSITION_TIME + PATH_DWELL_TIME);
}

function togglePathPlayback() {
  if (pathPlaybackEnabled) {
    stopPathPlayback();
  } else {
    startPathPlayback();
  }
}

// Update path progress indicator
function updatePathProgress() {
  const indicator = document.getElementById('path-progress');
  if (!indicator) return;

  if (!pathPlaybackEnabled || pathWaypoints.length === 0) {
    indicator.textContent = '';
    indicator.style.display = 'none';
  } else {
    indicator.textContent = `${currentWaypointIndex + 1}/${pathWaypoints.length}`;
    indicator.style.display = 'inline-block';
  }
}

// Flash a tree item with change-type-specific color
function flashTreeItem(nodeId, changeType = 'modified') {
  // Expand parent directories to reveal the flashing file
  expandParentsOf(nodeId);
  updateTreePanel();

  // Use setTimeout to ensure DOM is updated before querying
  setTimeout(() => {
    const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
    if (!treeItem) return;

    // Remove existing animation classes
    treeItem.classList.remove('tree-flash', 'tree-flash-created', 'tree-flash-modified', 'tree-flash-deleted', 'tree-flash-read');

    // Force reflow to restart animation
    void treeItem.offsetWidth;

    // Add type-specific animation class
    const className = `tree-flash-${changeType}`;
    treeItem.classList.add(className);

    // Scroll into view if not visible
    treeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Remove class after animation completes
    setTimeout(() => {
      treeItem.classList.remove(className);
    }, 2000);
  }, 50);
}

// Fade out a tree item when deleted
function fadeTreeItem(nodeId) {
  const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
  if (!treeItem) return;

  // Add fade-out class
  treeItem.style.transition = 'opacity 500ms ease-out, transform 500ms ease-out';
  treeItem.style.opacity = '0';
  treeItem.style.transform = 'scale(0.7)';

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (treeItem.parentNode) {
      treeItem.parentNode.removeChild(treeItem);
    }
  }, 500);
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
    if (node.type === 'phase' && state.currentState && state.currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === state.currentState.currentPhase && node.status !== 'complete') {
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
    return baseColor; // Full color for better visibility
  }
  return 'rgba(255,255,255,0.2)';
}

// Get link width based on hierarchy level and type
function getLinkWidth(link, graphData) {
  // Blocked links are thicker for visibility
  if (link.type === 'blocked') {
    return 4;
  }

  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
  if (sourceNode) {
    if (sourceNode.type === 'root') return 4;
    if (sourceNode.type === 'phase') return 3;
    if (sourceNode.type === 'plan') return 2.5;
    if (sourceNode.type === 'directory') return 2;
    return 1.5;
  }
  return 1.5;
}

// Initialize 3D force graph
const container = document.getElementById('graph-container');
let connectionCounts = calculateConnectionCounts(state.currentGraphData);

const Graph = ForceGraph3D()(container)
  .graphData(state.currentGraphData)
  .nodeLabel(() => null) // Disable built-in tooltip, use custom #tooltip instead
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
    if (node.type === 'phase' && state.currentState && state.currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === state.currentState.currentPhase && node.status !== 'complete') {
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
  .linkColor(link => getLinkColor(link, state.currentGraphData))
  .linkWidth(link => getLinkWidth(link, state.currentGraphData))
  .linkOpacity(0.85)
  .linkCurvature(0.1)
  .linkDirectionalArrowLength(3.5)
  .linkDirectionalArrowRelPos(1)
  .backgroundColor('#1a1a2e')
  .showNavInfo(false)
  // Click-to-fly navigation
  .onNodeClick(node => {
    // Stop path playback when user clicks on graph
    if (pathPlaybackEnabled) {
      stopPathPlayback();
    }

    // Stop orbit mode when user clicks on graph
    if (orbitModeEnabled) {
      stopOrbitMode();
    }

    // Double-click detection for file nodes
    const now = Date.now();
    if (node.type === 'file' && lastClickNode === node && (now - lastClickTime) < DOUBLE_CLICK_THRESHOLD) {
      // Double-click detected - open file inspector
      openFileInspector(node);
      lastClickTime = 0;
      lastClickNode = null;
      return; // Don't proceed with single-click behavior
    }
    lastClickTime = now;
    lastClickNode = node;

    // Calculate distance based on node size for optimal viewing
    const distance = 50 + getNodeSize(node, connectionCounts) * 4;

    // Animate camera to node position
    if (state.is3D) {
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
  // Hover tooltips - show all essential info for each node type
  .onNodeHover(node => {
    const tooltip = document.getElementById('tooltip');
    if (node) {
      const lines = [];

      // Line 1: Name with type indicator
      if (node.type === 'directory') {
        lines.push(`📁 ${node.name}/`);
      } else if (node.type === 'commit') {
        const msg = node.name.length > 50 ? node.name.slice(0, 47) + '...' : node.name;
        lines.push(`📝 ${msg}`);
      } else if (node.type === 'phase') {
        lines.push(`🎯 ${node.name}`);
      } else if (node.type === 'plan') {
        lines.push(`📋 ${node.name}`);
      } else {
        lines.push(`📄 ${node.name}`);
      }

      // Line 2: Path (if available and different from name)
      if (node.path && node.path !== node.name) {
        lines.push(`${node.path}`);
      }

      // Line 3: Source type (planning vs src)
      if (node.sourceType) {
        lines.push(`[${node.sourceType}]`);
      }

      // Line 4: Status (if available)
      if (node.status) {
        lines.push(`Status: ${node.status}`);
      }

      tooltip.innerHTML = lines.join('<br>');
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
    state.currentState = projectData.state;
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

    // Link directory root to project (contains both .planning and src)
    if (nodeMap.has('dir-root')) {
      addLink(projectNode.id, 'dir-root', 'contains');
    } else {
      // Fallback for backward compatibility
      if (nodeMap.has('planning-dir-root')) {
        addLink(projectNode.id, 'planning-dir-root', 'contains');
      }
      if (nodeMap.has('src-dir-root')) {
        addLink(projectNode.id, 'src-dir-root', 'contains');
      }
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
  const { state: projectState } = projectData;
  if (projectState && projectState.blockers && projectState.blockers.length > 0) {
    for (const blocker of projectState.blockers) {
      // Add blocker as a node
      const blockerNode = addNode({
        id: blocker.id,
        name: `Blocker: ${blocker.description.substring(0, 30)}...`,
        type: 'blocker',
        status: 'blocked',
        description: blocker.description
      });

      // Link blocker to current phase
      if (projectState.currentPhase) {
        const currentPhaseId = `phase-${projectState.currentPhase}`;
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
  state.currentGraphData = graphData;
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
    state.treeData = buildTreeStructure(storedDirectoryData);
    // Auto-expand root and both top-level directories (.planning and src)
    if (state.treeData && state.treeData.length > 0) {
      state.treeExpanded.add(state.treeData[0].id);  // Project root
      // Expand children (should be .planning and src)
      if (state.treeData[0].children) {
        state.treeData[0].children.forEach(child => {
          state.treeExpanded.add(child.id);
        });
      }
    }
    updateTreePanel();
  }
}

// =====================================================
// INCREMENTAL GRAPH UPDATE FUNCTIONS
// =====================================================

// Helper function to update selected node reference after graph changes
function updateSelectedNodeReference() {
  if (state.selectedNode) {
    const updatedNode = state.currentGraphData.nodes.find(n => n.id === state.selectedNode.id);
    if (updatedNode) {
      state.selectedNode = updatedNode;
    } else {
      // Node no longer exists, close details panel
      hideDetailsPanel();
      state.selectedNode = null;
    }
  }
}

// Apply incremental updates to graph without full rebuild
function applyIncrementalUpdate(changeEvent) {
  const { event, path, sourceType } = changeEvent;

  console.log('Applying incremental update:', event, path, sourceType);

  // Determine if this is a directory or file based on event type
  const isDirectory = event === 'addDir' || event === 'unlinkDir';
  const nodeId = `${sourceType}-${isDirectory ? 'dir' : 'file'}-${path}`;

  // Save camera position before any graph data changes
  let camPos = null;
  if (Graph && Graph.cameraPosition) {
    camPos = Graph.cameraPosition();
  }

  // Handle different event types
  if (event === 'add' || event === 'addDir') {
    // CREATE: Add new node to graph
    const { node: newNode, parentId } = buildFileNode(path, sourceType);

    // Add to state.currentGraphData.nodes
    state.currentGraphData.nodes.push(newNode);

    // Add link from parent to new node
    state.currentGraphData.links.push({
      source: parentId,
      target: newNode.id,
      type: 'contains'
    });

    // Update storedDirectoryData for tree panel
    if (storedDirectoryData && storedDirectoryData.nodes) {
      storedDirectoryData.nodes.push(newNode);
      storedDirectoryData.links.push({
        source: parentId,
        target: newNode.id,
        type: 'contains'
      });
    }

    // Update graph
    Graph.graphData(state.currentGraphData);

  } else if (event === 'change') {
    // MODIFY: Node already exists, no structural change needed
    // The node object is already in the array, flash animation handles visual feedback
    // No graphData() call needed

  } else if (event === 'unlink' || event === 'unlinkDir') {
    // DELETE: Fade out and remove node from graph

    // Check if selected node is being deleted
    if (state.selectedNode && state.selectedNode.id === nodeId) {
      hideDetailsPanel();
      state.selectedNode = null;
    }

    // Trigger fade-out animation (removes from graph when complete)
    fadeOutAndRemoveNode(nodeId);

    // Fade tree item too
    fadeTreeItem(nodeId);
  }

  // Restore camera position (instant, no animation)
  if (camPos && Graph && Graph.cameraPosition) {
    Graph.cameraPosition(camPos.x, camPos.y, camPos.z, 0);
  }

  // Update selected node reference if it exists
  updateSelectedNodeReference();
}

// Load project and update graph
async function loadProject(projectPath) {
  if (!window.electronAPI || !window.electronAPI.parseProject) {
    console.error('electronAPI.parseProject not available');
    return;
  }

  console.log('Loading project:', projectPath);
  const selectedPathEl = document.getElementById('selected-path');
  if (selectedPathEl) selectedPathEl.textContent = 'Loading...';

  try {
    // Initialize state FIRST - sets selectedProjectPath and resets all state
    initializeState(projectPath);
    console.log('State initialized for:', projectPath);

    const projectData = await window.electronAPI.parseProject(projectPath);

    if (projectData.error) {
      console.error('Error loading project:', projectData.error);
      if (selectedPathEl) selectedPathEl.textContent = `Error: ${projectData.error}`;
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

    if (selectedPathEl) selectedPathEl.textContent = projectPath;

    // Start file watching
    if (window.electronAPI && window.electronAPI.startWatching) {
      await window.electronAPI.startWatching(projectPath);
    }

    // Add to recent projects
    if (window.electronAPI && window.electronAPI.addRecentProject) {
      await window.electronAPI.addRecentProject(projectPath);
      updateRecentProjects();
    }

    // Start hook status detection (30s timeout for notification)
    startHookStatusDetection();

  } catch (error) {
    console.error('Error loading project:', error);
    if (selectedPathEl) selectedPathEl.textContent = `Error: ${error.message}`;
  }
}

// Folder selection handler
document.getElementById('select-folder-btn')?.addEventListener('click', async () => {
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

  // Node Shapes section
  const shapesTitle = document.createElement('div');
  shapesTitle.className = 'legend-title';
  shapesTitle.textContent = 'Node Shapes';
  legendContent.appendChild(shapesTitle);

  const shapes = [
    { shape: 'diamond', color: '#DDA0DD', label: 'Planning files (octahedron)' },
    { shape: 'sphere', color: '#7EC8E3', label: 'Source files (icosahedron)' },
    { shape: 'hexagon', color: '#9B59B6', label: 'Commits (hexagonal cylinder)' }
  ];

  shapes.forEach(({ shape, color, label }) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const shapeIcon = document.createElement('div');
    shapeIcon.className = `legend-shape ${shape}`;
    shapeIcon.style.color = color;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(shapeIcon);
    item.appendChild(labelSpan);
    legendContent.appendChild(item);
  });

  // Node types section
  const typeTitle = document.createElement('div');
  typeTitle.className = 'legend-title';
  typeTitle.style.marginTop = '12px';
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

  // Source Types section
  const sourceTitle = document.createElement('div');
  sourceTitle.className = 'legend-title';
  sourceTitle.style.marginTop = '12px';
  sourceTitle.textContent = 'Source Types';
  legendContent.appendChild(sourceTitle);

  const sourceTypes = [
    { color: '#DDA0DD', label: 'Planning (.planning/) - plum, diamond' },
    { color: '#7EC8E3', label: 'Source (src/) - blue, sphere' }
  ];

  sourceTypes.forEach(({ color, label }) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = color;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(colorCircle);
    item.appendChild(labelSpan);
    legendContent.appendChild(item);
  });

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

  // Flash Animations section
  const flashTitle = document.createElement('div');
  flashTitle.className = 'legend-title';
  flashTitle.style.marginTop = '12px';
  flashTitle.textContent = 'Flash Animations';
  legendContent.appendChild(flashTitle);

  const flashTypes = [
    { color: '#00FF88', label: 'File Created (4 quick pulses)' },
    { color: '#FFAA00', label: 'File Modified (3 steady pulses)' },
    { color: '#FF3333', label: 'File Deleted (2 slow pulses)' },
    { color: '#4488FF', label: 'Claude Read (2 quick pulses)' }
  ];

  flashTypes.forEach(({ color, label }) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const flashIcon = document.createElement('div');
    flashIcon.className = 'legend-flash';
    flashIcon.style.backgroundColor = color;
    flashIcon.style.color = color;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(flashIcon);
    item.appendChild(labelSpan);
    legendContent.appendChild(item);
  });
}

populateColorLegend();

// Legend toggle handler
document.getElementById('legend-header')?.addEventListener('click', () => {
  const legend = document.getElementById('color-legend');
  legend?.classList.toggle('collapsed');
});

// Track mouse for tooltip positioning
container.addEventListener('mousemove', (e) => {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.left = e.clientX + 15 + 'px';
  tooltip.style.top = e.clientY + 15 + 'px';
});

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

// Apply basic syntax highlighting based on file extension
function applySyntaxHighlighting(escapedLine, filename) {
  if (!filename) return escapedLine;

  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  // Skip highlighting for diff metadata lines
  if (escapedLine.startsWith('@@ ') || escapedLine.startsWith('diff ') ||
      escapedLine.startsWith('index ') || escapedLine.startsWith('--- ') ||
      escapedLine.startsWith('+++ ')) {
    return escapedLine;
  }

  // Remove diff prefix for syntax processing
  let prefix = '';
  let content = escapedLine;
  if (escapedLine.startsWith('+') || escapedLine.startsWith('-') || escapedLine.startsWith(' ')) {
    prefix = escapedLine[0];
    content = escapedLine.substring(1);
  }

  let highlighted = content;

  // JavaScript/TypeScript highlighting
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    // Keywords
    highlighted = highlighted.replace(
      /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|new|this|try|catch|throw|typeof|instanceof|null|undefined|true|false)\b/g,
      '<span class="syntax-keyword">$1</span>'
    );
    // Strings (single and double quotes)
    highlighted = highlighted.replace(
      /(&apos;[^&]*&apos;|&quot;[^&]*&quot;|'[^']*'|"[^"]*")/g,
      '<span class="syntax-string">$1</span>'
    );
    // Comments (// style)
    highlighted = highlighted.replace(
      /(\/\/.*$)/g,
      '<span class="syntax-comment">$1</span>'
    );
    // Numbers
    highlighted = highlighted.replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="syntax-number">$1</span>'
    );
    // Function calls
    highlighted = highlighted.replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      '<span class="syntax-function">$1</span>('
    );
  }
  // Markdown highlighting
  else if (['.md', '.markdown'].includes(ext)) {
    // Headers
    highlighted = highlighted.replace(
      /^(#{1,6}\s.*)$/g,
      '<span class="syntax-keyword">$1</span>'
    );
    // Bold
    highlighted = highlighted.replace(
      /(\*\*[^*]+\*\*)/g,
      '<span class="syntax-string">$1</span>'
    );
    // Links [text](url)
    highlighted = highlighted.replace(
      /(\[[^\]]+\]\([^)]+\))/g,
      '<span class="syntax-function">$1</span>'
    );
  }
  // JSON highlighting
  else if (['.json'].includes(ext)) {
    // Keys (quoted strings followed by colon)
    highlighted = highlighted.replace(
      /(&quot;[^&]+&quot;|"[^"]+")(\s*:)/g,
      '<span class="syntax-keyword">$1</span>$2'
    );
    // String values
    highlighted = highlighted.replace(
      /:(\s*)(&quot;[^&]*&quot;|"[^"]*")/g,
      ':$1<span class="syntax-string">$2</span>'
    );
    // Numbers
    highlighted = highlighted.replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span class="syntax-number">$1</span>'
    );
    // Booleans
    highlighted = highlighted.replace(
      /\b(true|false|null)\b/g,
      '<span class="syntax-keyword">$1</span>'
    );
  }

  return prefix + highlighted;
}

// Parse file structure for navigation - returns array of structure items
function parseFileStructure(content, filename) {
  if (!content || !filename) return [];

  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  // Route to appropriate parser based on file extension
  if (['.md', '.markdown'].includes(ext)) {
    return parseMarkdownStructure(content);
  }

  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    return parseCodeStructure(content);
  }

  if (['.json'].includes(ext)) {
    return parseConfigStructure(content, 'json');
  }

  if (['.yaml', '.yml'].includes(ext)) {
    return parseConfigStructure(content, 'yaml');
  }

  // Unknown file type - return empty array
  return [];
}

// Parse markdown files for headers, lists, and code blocks
function parseMarkdownStructure(content) {
  if (!content) return [];

  const items = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match headers (# to ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const depth = headerMatch[1].length;
      const name = headerMatch[2].trim();
      items.push({
        type: 'header',
        name: name,
        line: lineNum,
        depth: depth
      });
      continue;
    }

    // Match list items (-, *, or numbered 1.)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const depth = Math.floor(indent / 2) + 1;
      const name = listMatch[3].trim();
      items.push({
        type: 'list',
        name: name.substring(0, 50) + (name.length > 50 ? '...' : ''),
        line: lineNum,
        depth: depth
      });
      continue;
    }

    // Match code block boundaries (``` with optional language)
    const codeBlockMatch = line.match(/^```(\w*)$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'code';
      items.push({
        type: 'codeblock',
        name: language,
        line: lineNum,
        depth: 0
      });
      continue;
    }
  }

  return items;
}

// Parse JavaScript/TypeScript files for functions, classes, imports, exports
function parseCodeStructure(content) {
  if (!content) return [];

  const items = [];
  const lines = content.split('\n');
  let insideClass = false;
  let braceDepth = 0;
  let classStartBraces = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmedLine = line.trim();

    // Track brace depth for class scope detection
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceDepth += openBraces - closeBraces;

    // Check if we've exited the class
    if (insideClass && braceDepth < classStartBraces) {
      insideClass = false;
    }

    // Match import statements
    const importMatch = trimmedLine.match(/^import\s+(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+)).*from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const imported = importMatch[1] || importMatch[2] || importMatch[3];
      const source = importMatch[4];
      items.push({
        type: 'import',
        name: `${imported} from '${source}'`,
        line: lineNum,
        depth: 0
      });
      continue;
    }

    // Simple import match (import 'module')
    const simpleImportMatch = trimmedLine.match(/^import\s+['"]([^'"]+)['"]/);
    if (simpleImportMatch) {
      items.push({
        type: 'import',
        name: simpleImportMatch[1],
        line: lineNum,
        depth: 0
      });
      continue;
    }

    // Match class declarations
    const classMatch = trimmedLine.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
    if (classMatch) {
      items.push({
        type: 'class',
        name: classMatch[1],
        line: lineNum,
        depth: 0
      });
      insideClass = true;
      classStartBraces = braceDepth;
      continue;
    }

    // Match function declarations
    const funcMatch = trimmedLine.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
    if (funcMatch) {
      items.push({
        type: 'function',
        name: funcMatch[1],
        line: lineNum,
        depth: insideClass ? 1 : 0
      });
      continue;
    }

    // Match arrow functions with const/let/var
    const arrowMatch = trimmedLine.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    if (arrowMatch) {
      items.push({
        type: 'function',
        name: arrowMatch[1],
        line: lineNum,
        depth: insideClass ? 1 : 0
      });
      continue;
    }

    // Match arrow functions with => after parameters
    const arrowFuncMatch = trimmedLine.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\w*\s*=>/);
    if (arrowFuncMatch) {
      items.push({
        type: 'function',
        name: arrowFuncMatch[1],
        line: lineNum,
        depth: insideClass ? 1 : 0
      });
      continue;
    }

    // Match export default (standalone)
    const exportDefaultMatch = trimmedLine.match(/^export\s+default\s+(\w+)/);
    if (exportDefaultMatch && !classMatch && !funcMatch) {
      items.push({
        type: 'export',
        name: `default ${exportDefaultMatch[1]}`,
        line: lineNum,
        depth: 0
      });
      continue;
    }

    // Match export const/let/var (but not already captured as function)
    const exportVarMatch = trimmedLine.match(/^export\s+(?:const|let|var)\s+(\w+)\s*=/);
    if (exportVarMatch && !arrowMatch && !arrowFuncMatch) {
      // Check if it's not a function (no parentheses following)
      if (!trimmedLine.match(/=\s*(?:async\s*)?\(/)) {
        items.push({
          type: 'export',
          name: exportVarMatch[1],
          line: lineNum,
          depth: 0
        });
        continue;
      }
    }

    // Match class methods (inside class body)
    if (insideClass) {
      const methodMatch = trimmedLine.match(/^(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/);
      if (methodMatch && methodMatch[1] !== 'if' && methodMatch[1] !== 'for' && methodMatch[1] !== 'while') {
        items.push({
          type: 'function',
          name: methodMatch[1],
          line: lineNum,
          depth: 1
        });
        continue;
      }
    }
  }

  return items;
}

// Parse config files (JSON/YAML) for nested key structure
function parseConfigStructure(content, format) {
  if (!content) return [];

  if (format === 'json') {
    return parseJSONStructure(content);
  }

  if (format === 'yaml') {
    return parseYAMLStructure(content);
  }

  return [];
}

// Parse JSON structure with key paths and estimated line numbers
function parseJSONStructure(content) {
  const items = [];

  try {
    const parsed = JSON.parse(content);
    const lines = content.split('\n');

    // Build a map of key positions for line number lookup
    function findKeyLine(key, startLine = 0) {
      const keyPattern = new RegExp(`"${key}"\\s*:`);
      for (let i = startLine; i < lines.length; i++) {
        if (keyPattern.test(lines[i])) {
          return i + 1; // 1-indexed
        }
      }
      return startLine + 1;
    }

    // Recursively extract keys with their paths
    function extractKeys(obj, path = '', depth = 0, lastLine = 0) {
      if (typeof obj !== 'object' || obj === null) return;

      const keys = Array.isArray(obj) ? [] : Object.keys(obj);

      for (const key of keys) {
        const lineNum = findKeyLine(key, lastLine);
        const fullPath = path ? `${path}.${key}` : key;

        items.push({
          type: 'key',
          name: key,
          line: lineNum,
          depth: depth
        });

        // Recurse into nested objects (limit depth to 5 for performance)
        if (typeof obj[key] === 'object' && obj[key] !== null && depth < 5) {
          extractKeys(obj[key], fullPath, depth + 1, lineNum);
        }
      }
    }

    extractKeys(parsed);
  } catch (e) {
    // Invalid JSON - return empty array
    return [];
  }

  return items;
}

// Parse YAML structure by detecting key: patterns and indentation
function parseYAMLStructure(content) {
  const items = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Match key: pattern (key followed by colon)
    const keyMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*):\s*/);
    if (keyMatch) {
      const indent = keyMatch[1].length;
      const depth = Math.floor(indent / 2);
      const name = keyMatch[2];

      items.push({
        type: 'key',
        name: name,
        line: lineNum,
        depth: depth
      });
    }

    // Match array items with key (- key:)
    const arrayKeyMatch = line.match(/^(\s*)-\s+([a-zA-Z_][a-zA-Z0-9_-]*):\s*/);
    if (arrayKeyMatch) {
      const indent = arrayKeyMatch[1].length;
      const depth = Math.floor(indent / 2) + 1;
      const name = arrayKeyMatch[2];

      items.push({
        type: 'key',
        name: name,
        line: lineNum,
        depth: depth
      });
    }
  }

  return items;
}

// Render diff view with line numbers and syntax highlighting for diff lines
function renderDiffView(diffResult, filename) {
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

  // Track line numbers from hunk headers
  let oldLine = 0, newLine = 0;

  const htmlLines = displayLines.map((line, idx) => {
    let className = 'diff-line context';
    let lineNum = idx + 1;
    let displayLineNum = '';

    // Parse @@ header for line numbers
    const hunkMatch = line.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      className = 'diff-line header';
      displayLineNum = '...';
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      className = 'diff-line added';
      displayLineNum = newLine;
      newLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      className = 'diff-line removed';
      displayLineNum = oldLine;
      oldLine++;
    } else if (line.startsWith('diff ') || line.startsWith('index ') ||
               line.startsWith('---') || line.startsWith('+++')) {
      className = 'diff-line header';
      displayLineNum = '';
    } else if (oldLine > 0 || newLine > 0) {
      // Context line
      displayLineNum = newLine || oldLine;
      oldLine++;
      newLine++;
    }

    const escaped = escapeHtml(line);
    const highlighted = filename ? applySyntaxHighlighting(escaped, filename) : escaped;

    return `<div class="diff-line-container">
      <span class="diff-line-number" data-line="${lineNum}">${displayLineNum}</span>
      <span class="diff-line-content ${className}">${highlighted}</span>
    </div>`;
  }).join('');

  let truncateMsg = '';
  if (truncated) {
    truncateMsg = `<div class="diff-status">... (diff truncated, showing first ${MAX_DIFF_LINES} of ${lines.length} lines)</div>`;
  }

  return `<div class="diff-content">${htmlLines}${truncateMsg}</div>`;
}

// Breadcrumb trail functions
function buildBreadcrumbPath(node) {
  // Only build breadcrumb for file/directory nodes
  if (!node || (node.type !== 'file' && node.type !== 'directory')) {
    return [];
  }

  const breadcrumbs = [];
  const sourceType = node.sourceType;

  // Determine root
  const rootName = sourceType === 'planning' ? '.planning' : 'src';
  const rootId = sourceType === 'planning' ? 'dir-planning' : 'dir-src';

  // If node IS the root, return just that
  if (node.id === rootId) {
    return [{ id: rootId, name: rootName, isRoot: true }];
  }

  // Start with root
  breadcrumbs.push({ id: rootId, name: rootName, isRoot: true });

  // Parse path to build intermediate segments
  const path = node.path || '';
  const pathParts = path.split('/');

  // Build breadcrumb for each directory in the path
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (!part) continue; // Skip empty parts

    // Build path up to this point
    const partialPath = pathParts.slice(0, i + 1).join('/');

    // Determine if this part is a file or directory
    // Files have extensions, directories don't (unless it's the last part and it's a file)
    const isFile = i === pathParts.length - 1 && node.type === 'file';
    const nodeId = `${sourceType}-${isFile ? 'file' : 'dir'}-${partialPath}`;

    breadcrumbs.push({
      id: nodeId,
      name: part,
      isRoot: false
    });
  }

  return breadcrumbs;
}

function updateBreadcrumb(node) {
  const breadcrumbContainer = document.getElementById('breadcrumb-trail');
  if (!breadcrumbContainer) return;

  // Only show breadcrumb for file/directory nodes
  if (!node || (node.type !== 'file' && node.type !== 'directory')) {
    breadcrumbContainer.innerHTML = '<span class="breadcrumb-segment root">Project</span>';
    return;
  }

  const breadcrumbs = buildBreadcrumbPath(node);

  if (breadcrumbs.length === 0) {
    breadcrumbContainer.innerHTML = '<span class="breadcrumb-segment root">Project</span>';
    return;
  }

  // Build HTML for breadcrumb trail
  const html = breadcrumbs.map((crumb, index) => {
    const isCurrent = index === breadcrumbs.length - 1;
    const className = isCurrent ? 'breadcrumb-segment current' : 'breadcrumb-segment';
    const dataAttr = isCurrent ? '' : `data-node-id="${crumb.id}"`;

    // Add separator before all segments except the first
    const separator = index > 0 ? '<span class="breadcrumb-separator">/</span>' : '';

    return `${separator}<span class="${className}" ${dataAttr}>${crumb.name}</span>`;
  }).join('');

  breadcrumbContainer.innerHTML = html;
}

// Details panel functions
async function showDetailsPanel(node) {
  state.selectedNode = node;
  updateZoomButtonStates(); // Enable focus/detail zoom buttons

  // Add to navigation history
  pushNavigationHistory(node.id);

  // Update breadcrumb trail
  updateBreadcrumb(node);

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

  if (filePath && state.selectedProjectPath) {
    // Build full path based on sourceType
    if (node.sourceType === 'src') {
      fullPath = `${state.selectedProjectPath}/src/${node.path}`;
    } else if (node.sourceType === 'planning') {
      fullPath = `${state.selectedProjectPath}/.planning/${node.path}`;
    } else if (node.path) {
      fullPath = `${state.selectedProjectPath}/.planning/${node.path}`;
    } else if (node.file) {
      fullPath = `${state.selectedProjectPath}/.planning/phases/${node.file}`;
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
  if (node.type === 'file' && state.selectedProjectPath && window.electronAPI && window.electronAPI.getGitDiff) {
    html += `<div class="diff-container">
      <div class="diff-header">Recent Changes</div>
      <div id="diff-view-content"><div class="diff-status">Loading diff...</div></div>
    </div>`;
  }

  // For directories, show children count info
  if (node.type === 'directory') {
    const childLinks = state.currentGraphData.links.filter(l => {
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
  if (node.type === 'file' && state.selectedProjectPath && window.electronAPI && window.electronAPI.getGitDiff) {
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
      const diffResult = await window.electronAPI.getGitDiff(state.selectedProjectPath, relativePath);
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
  state.selectedNode = null;
  updateZoomButtonStates(); // Disable focus/detail zoom buttons
}

// Refresh details panel content (re-renders with current state.selectedNode)
function refreshDetailsPanel() {
  if (state.selectedNode) {
    showDetailsPanel(state.selectedNode);
  }
}

// Open file inspector modal for a file node
export async function openFileInspector(node) {
  if (node.type !== 'file') return;

  state.inspectorNode = node;

  const overlay = document.getElementById('file-inspector-overlay');
  const modal = document.getElementById('file-inspector-modal');
  const title = document.getElementById('inspector-title');

  // Set title to file name
  title.textContent = node.name;

  // Show modal
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  modal.classList.remove('hidden');

  // Reset sections to expanded state
  document.querySelectorAll('.collapsible-section').forEach(section => {
    section.classList.remove('collapsed');
  });

  // Reset diff mode toggle to Git Diff active
  inspectorDiffMode = 'git';
  document.querySelectorAll('.diff-mode-toggle .mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === 'git');
  });

  // Initialize session snapshot if not present
  const fullPath = getInspectorFilePath(node);
  if (fullPath && !sessionFileSnapshots.has(fullPath)) {
    try {
      const result = await window.electronAPI.readFileContent(fullPath);
      sessionFileSnapshots.set(fullPath, {
        content: result.content || '',
        timestamp: Date.now()
      });
      console.log('[Inspector] Initial snapshot stored for:', fullPath);
    } catch (err) {
      console.log('[Inspector] Could not store initial snapshot:', err.message);
    }
  }

  // Populate diff section
  await populateInspectorDiff();

  // Populate structure tree section
  await populateInspectorStructure();

  // Populate context section
  await populateInspectorContext();

  console.log('[Inspector] Opened for:', node.name, node.path);
}

// Get full file path for inspector node
function getInspectorFilePath(node) {
  if (!state.selectedProjectPath || !node) return null;

  if (node.sourceType === 'src') {
    return `${state.selectedProjectPath}/src/${node.path}`;
  } else if (node.sourceType === 'planning') {
    return `${state.selectedProjectPath}/.planning/${node.path}`;
  } else if (node.path) {
    return `${state.selectedProjectPath}/.planning/${node.path}`;
  }
  return null;
}

// Close file inspector modal
function closeFileInspector() {
  const overlay = document.getElementById('file-inspector-overlay');
  const modal = document.getElementById('file-inspector-modal');

  overlay.classList.remove('visible');
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 200); // Match CSS transition
  modal.classList.add('hidden');

  // Clear search state
  closeModalSearch();

  state.inspectorNode = null;
  console.log('[Inspector] Closed');
}

// Open modal search
function openModalSearch() {
  const searchContainer = document.getElementById('modal-search-container');
  const searchInput = document.getElementById('modal-search-input');

  if (!searchContainer || !searchInput) return;

  searchContainer.classList.remove('hidden');
  searchInput.focus();
  searchInput.select(); // Select existing text if any

  // If there's already a query, re-run search
  if (searchInput.value) {
    performSearch(searchInput.value);
  }

  console.log('[Search] Opened');
}

// Close modal search
function closeModalSearch() {
  const searchContainer = document.getElementById('modal-search-container');
  const searchInput = document.getElementById('modal-search-input');

  if (!searchContainer || !searchInput) return;

  searchContainer.classList.add('hidden');
  searchInput.value = '';
  currentSearchQuery = '';
  searchMatches = [];
  currentMatchIndex = -1;

  // Remove all highlights
  clearSearchHighlights();

  console.log('[Search] Closed');
}

// Perform search in diff content
function performSearch(query) {
  if (!query || query.trim().length === 0) {
    clearSearchHighlights();
    updateSearchInfo(0, 0);
    return;
  }

  currentSearchQuery = query.trim();
  const diffSection = document.querySelector('#section-diff .section-content');

  if (!diffSection) {
    console.log('[Search] No diff content to search');
    return;
  }

  // Clear previous highlights
  clearSearchHighlights();

  // Get all diff lines
  const diffLines = diffSection.querySelectorAll('.diff-line-content');
  searchMatches = [];

  // Case-insensitive search
  const lowerQuery = currentSearchQuery.toLowerCase();

  diffLines.forEach((line, lineIndex) => {
    const textContent = line.textContent;
    const lowerText = textContent.toLowerCase();
    let startIndex = 0;

    while (true) {
      const foundIndex = lowerText.indexOf(lowerQuery, startIndex);
      if (foundIndex === -1) break;

      searchMatches.push({
        lineElement: line,
        lineIndex,
        startIndex: foundIndex,
        length: currentSearchQuery.length
      });

      startIndex = foundIndex + 1;
    }
  });

  const matchCount = searchMatches.length;

  // Highlight all matches
  if (matchCount > 0) {
    highlightSearchMatches();
    currentMatchIndex = 0;
    scrollToMatch(0);
  }

  updateSearchInfo(currentMatchIndex + 1, matchCount);
  console.log(`[Search] Found ${matchCount} matches for "${currentSearchQuery}"`);
}

// Highlight all search matches
function highlightSearchMatches() {
  searchMatches.forEach((match, index) => {
    const line = match.lineElement;
    const textContent = line.textContent;

    // Extract text before, match, and after
    const before = textContent.substring(0, match.startIndex);
    const matchText = textContent.substring(match.startIndex, match.startIndex + match.length);
    const after = textContent.substring(match.startIndex + match.length);

    // Build highlighted HTML
    const isCurrent = index === currentMatchIndex;
    const markClass = isCurrent ? 'search-match current' : 'search-match';
    const newHTML = `${escapeHtml(before)}<mark class="${markClass}" data-match-index="${index}">${escapeHtml(matchText)}</mark>${escapeHtml(after)}`;

    line.innerHTML = newHTML;
  });
}

// Clear all search highlights
function clearSearchHighlights() {
  const diffSection = document.querySelector('#section-diff .section-content');
  if (!diffSection) return;

  const marks = diffSection.querySelectorAll('mark.search-match');
  marks.forEach(mark => {
    const parent = mark.parentElement;
    if (parent) {
      parent.textContent = parent.textContent; // Strip HTML, restore plain text
    }
  });
}

// Update search info display
function updateSearchInfo(current, total) {
  const infoSpan = document.getElementById('modal-search-info');
  const prevBtn = document.getElementById('search-prev');
  const nextBtn = document.getElementById('search-next');

  if (!infoSpan) return;

  if (total === 0) {
    infoSpan.textContent = 'No matches';
  } else {
    infoSpan.textContent = `${current} of ${total}`;
  }

  // Enable/disable navigation buttons
  if (prevBtn) prevBtn.disabled = total === 0;
  if (nextBtn) nextBtn.disabled = total === 0;
}

// Navigate to specific match
function scrollToMatch(index) {
  if (index < 0 || index >= searchMatches.length) return;

  currentMatchIndex = index;

  // Update highlights (remove 'current' from old, add to new)
  const allMarks = document.querySelectorAll('mark.search-match');
  allMarks.forEach((mark, i) => {
    mark.classList.toggle('current', i === currentMatchIndex);
  });

  // Scroll to match
  const match = searchMatches[currentMatchIndex];
  if (match && match.lineElement) {
    match.lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateSearchInfo(currentMatchIndex + 1, searchMatches.length);
}

// Navigate to next match
function nextMatch() {
  if (searchMatches.length === 0) return;
  const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
  scrollToMatch(nextIndex);
}

// Navigate to previous match
function prevMatch() {
  if (searchMatches.length === 0) return;
  const prevIndex = currentMatchIndex === 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
  scrollToMatch(prevIndex);
}

// Populate the inspector diff section based on current mode
async function populateInspectorDiff() {
  if (!state.inspectorNode || state.inspectorNode.type !== 'file') return;

  const diffSection = document.querySelector('#section-diff .section-content');
  if (!diffSection) return;

  diffSection.innerHTML = '<div class="diff-status">Loading...</div>';

  const fullPath = getInspectorFilePath(state.inspectorNode);
  if (!fullPath) {
    diffSection.innerHTML = '<div class="diff-status">Unable to determine file path</div>';
    return;
  }

  // Build relative path for git
  let relativePath;
  if (state.inspectorNode.sourceType === 'planning') {
    relativePath = '.planning/' + state.inspectorNode.path;
  } else if (state.inspectorNode.sourceType === 'src') {
    relativePath = 'src/' + state.inspectorNode.path;
  } else {
    relativePath = state.inspectorNode.path;
  }

  if (inspectorDiffMode === 'git') {
    // Git diff mode - compare against HEAD
    if (!state.selectedProjectPath || !window.electronAPI || !window.electronAPI.getGitDiff) {
      diffSection.innerHTML = '<div class="diff-status">Git diff not available</div>';
      return;
    }

    try {
      const diffResult = await window.electronAPI.getGitDiff(state.selectedProjectPath, relativePath);
      diffSection.innerHTML = renderDiffView(diffResult, state.inspectorNode.name);
    } catch (err) {
      console.error('[Inspector] Error loading git diff:', err);
      diffSection.innerHTML = '<div class="diff-status">Error loading git diff</div>';
    }
  } else {
    // Session diff mode - compare against last viewed
    try {
      const result = await window.electronAPI.readFileContent(fullPath);
      const currentContent = result.content || '';
      const snapshot = sessionFileSnapshots.get(fullPath);

      if (!snapshot) {
        diffSection.innerHTML = '<div class="diff-status">No previous session snapshot available</div>';
        return;
      }

      if (currentContent === snapshot.content) {
        diffSection.innerHTML = '<div class="diff-status">No changes since last viewed</div>';
      } else {
        const sessionDiff = computeSessionDiff(snapshot.content, currentContent);
        diffSection.innerHTML = renderSessionDiffView(sessionDiff, state.inspectorNode.name);
      }

      // Update snapshot to current content after viewing
      sessionFileSnapshots.set(fullPath, {
        content: currentContent || '',
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[Inspector] Error computing session diff:', err);
      diffSection.innerHTML = '<div class="diff-status">Error loading session diff</div>';
    }
  }
}

// Populate the structure tree section
async function populateInspectorStructure() {
  if (!state.inspectorNode || state.inspectorNode.type !== 'file') return;

  const structureSection = document.querySelector('#section-structure .section-content');
  if (!structureSection) return;

  const filePath = getInspectorFilePath(state.inspectorNode);
  if (!filePath) {
    structureSection.innerHTML = '<p class="structure-empty">Could not determine file path</p>';
    return;
  }

  try {
    const result = await window.electronAPI.readFileContent(filePath);
    if (result.error) {
      structureSection.innerHTML = `<p class="structure-empty">${result.error}</p>`;
      return;
    }

    const content = result.content || '';
    const items = parseFileStructure(content, state.inspectorNode.name);

    if (items.length === 0) {
      structureSection.innerHTML = '<p class="structure-empty">No structure found in this file</p>';
      return;
    }

    structureSection.innerHTML = `<div class="structure-tree">${renderStructureTree(items)}</div>`;
  } catch (err) {
    console.error('[Structure] Error loading:', err);
    structureSection.innerHTML = `<p class="structure-empty">Error loading file structure</p>`;
  }
}

// Render structure items as nested tree HTML
function renderStructureTree(items, parentDepth = -1) {
  const iconMap = {
    header: 'H',
    function: 'f',
    class: 'C',
    import: 'i',
    export: 'e',
    key: 'k',
    list: '-',
    codeblock: '<>'
  };

  let html = '';
  let i = 0;

  while (i < items.length) {
    const item = items[i];
    const hasChildren = i + 1 < items.length && items[i + 1].depth > item.depth;

    // Collect children (items with greater depth until we hit same or lower depth)
    const children = [];
    if (hasChildren) {
      let j = i + 1;
      while (j < items.length && items[j].depth > item.depth) {
        children.push(items[j]);
        j++;
      }
    }

    const icon = iconMap[item.type] || '?';
    const toggleClass = hasChildren ? '' : 'no-children';
    const indentStyle = `padding-left: ${item.depth * 12}px`;

    html += `<div class="structure-item" data-line="${item.line}" style="${indentStyle}">
      <span class="structure-toggle ${toggleClass}">&#9654;</span>
      <span class="structure-icon ${item.type}">${icon}</span>
      <span class="structure-name">${escapeHtml(item.name)}</span>
      <span class="structure-line">:${item.line}</span>
    </div>`;

    if (children.length > 0) {
      html += `<div class="structure-children">${renderStructureTree(children, item.depth)}</div>`;
    }

    // Skip children we've already processed
    i += 1 + children.length;
  }

  return html;
}

// Populate the context section with metadata, quick actions, activity, and related files
async function populateInspectorContext() {
  if (!state.inspectorNode || state.inspectorNode.type !== 'file') return;

  const contextSection = document.querySelector('#section-context .section-content');
  if (!contextSection) return;

  contextSection.innerHTML = '<div class="context-loading">Loading file metadata...</div>';

  const fullPath = getInspectorFilePath(state.inspectorNode);
  if (!fullPath) {
    contextSection.innerHTML = '<div class="context-error">Unable to determine file path</div>';
    return;
  }

  try {
    // Fetch file stats
    let fileStats = null;
    if (window.electronAPI && window.electronAPI.getFileStats) {
      fileStats = await window.electronAPI.getFileStats(fullPath);
    }

    // Determine git status for this file
    let gitStatus = 'clean';
    if (gitStatusData && state.inspectorNode.path) {
      const normalizedPath = state.inspectorNode.path.replace(/\\/g, '/');
      let fullRelativePath;
      if (state.inspectorNode.sourceType === 'planning') {
        fullRelativePath = '.planning/' + normalizedPath;
      } else if (state.inspectorNode.sourceType === 'src') {
        fullRelativePath = 'src/' + normalizedPath;
      } else {
        fullRelativePath = normalizedPath;
      }

      if (gitStatusData.staged && gitStatusData.staged.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
        gitStatus = 'staged';
      } else if (gitStatusData.modified && gitStatusData.modified.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
        gitStatus = 'modified';
      } else if (gitStatusData.untracked && gitStatusData.untracked.some(p => p.endsWith(normalizedPath) || p === fullRelativePath)) {
        gitStatus = 'untracked';
      }
    }

    // Build metadata header HTML
    let html = `
      <div class="metadata-header">
        <span class="metadata-label">File Path</span>
        <span class="metadata-value">${escapeHtml(fullPath)}</span>

        <span class="metadata-label">File Size</span>
        <span class="metadata-value">${fileStats ? formatFileSize(fileStats.size) : 'Unknown'}</span>

        <span class="metadata-label">Last Modified</span>
        <span class="metadata-value">${fileStats ? new Date(fileStats.mtime).toLocaleString() : 'Unknown'}</span>

        <span class="metadata-label">Git Status</span>
        <span class="metadata-value">
          <span class="git-status-badge ${gitStatus}">${gitStatus.charAt(0).toUpperCase() + gitStatus.slice(1)}</span>
        </span>
      </div>
    `;

    // Build quick actions bar HTML
    html += `
      <div class="quick-actions">
        <button class="quick-action-btn primary" id="action-open-editor">
          <span class="icon">▶</span>
          <span>Open in Editor</span>
        </button>
        <button class="quick-action-btn secondary" id="action-copy-path">
          <span class="icon">📋</span>
          <span>Copy Path</span>
        </button>
        <button class="quick-action-btn secondary" id="action-copy-content">
          <span class="icon">📄</span>
          <span>Copy Content</span>
        </button>
      </div>
    `;

    // Add Recent Activity section
    html += `
      <div class="context-subsection">
        <h4 class="context-subsection-title">Recent Activity</h4>
        <div class="activity-list">
          ${renderRecentActivity(fullPath)}
        </div>
      </div>
    `;

    // Add Related Files section
    const relatedFilesHtml = await renderRelatedFiles(fullPath, state.inspectorNode.name);
    html += `
      <div class="context-subsection">
        <h4 class="context-subsection-title">Related Files</h4>
        <div class="related-files-list">
          ${relatedFilesHtml}
        </div>
      </div>
    `;

    contextSection.innerHTML = html;

    // Attach event listeners for quick actions
    const openEditorBtn = document.getElementById('action-open-editor');
    const copyPathBtn = document.getElementById('action-copy-path');
    const copyContentBtn = document.getElementById('action-copy-content');

    if (openEditorBtn) {
      openEditorBtn.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.openFile) {
          const result = await window.electronAPI.openFile(fullPath);
          if (result.error) {
            showToast('Error opening file', true);
            console.error('Error opening file:', result.error);
          } else {
            showToast('File opened in editor');
          }
        } else {
          showToast('Open file not available', true);
        }
      });
    }

    if (copyPathBtn) {
      copyPathBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(fullPath);
          showToast('Path copied to clipboard');
        } catch (err) {
          showToast('Failed to copy path', true);
          console.error('Clipboard error:', err);
        }
      });
    }

    if (copyContentBtn) {
      copyContentBtn.addEventListener('click', async () => {
        try {
          if (window.electronAPI && window.electronAPI.readFileContent) {
            const result = await window.electronAPI.readFileContent(fullPath);
            await navigator.clipboard.writeText(result.content || '');
            showToast('Content copied to clipboard');
          } else {
            showToast('Read file not available', true);
          }
        } catch (err) {
          showToast('Failed to copy content', true);
          console.error('Error copying content:', err);
        }
      });
    }

    // Add event delegation for related file item clicks
    contextSection.addEventListener('click', (e) => {
      const item = e.target.closest('.related-file-item');
      if (item) {
        const nodePath = item.dataset.nodePath;
        const sourceType = item.dataset.sourceType;
        if (nodePath && state.currentGraphData) {
          // Find the node in the graph
          const node = state.currentGraphData.nodes.find(n =>
            n.path === nodePath && n.sourceType === sourceType
          );
          if (node) {
            // Focus camera on the node
            focusOnNode(node);
            console.log('[Context] Navigating to related file:', nodePath);
          }
        }
      }
    });

  } catch (err) {
    console.error('[Context] Error loading metadata:', err);
    contextSection.innerHTML = '<div class="context-error">Error loading file metadata</div>';
  }
}

// Render recent activity for current file
function renderRecentActivity(filePath) {
  if (!filePath || !state.activityEntries || state.activityEntries.length === 0) {
    return '<div class="context-empty">No recent activity for this file</div>';
  }

  // Filter activity entries by current file path
  const fileActivity = state.activityEntries.filter(entry => {
    const entryPath = entry.sourceType === 'src'
      ? `src/${entry.relativePath}`
      : `.planning/${entry.relativePath}`;
    return entryPath === filePath || entry.relativePath === filePath;
  });

  if (fileActivity.length === 0) {
    return '<div class="context-empty">No recent activity for this file</div>';
  }

  // Sort by timestamp (newest first) and limit to 10
  const sortedActivity = fileActivity
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  // Generate HTML for each entry
  const html = sortedActivity.map(entry => {
    const changeType = entry.event || 'modified';
    const timestamp = formatRelativeTime(entry.timestamp);

    return `
      <div class="activity-item ${changeType}">
        <span class="activity-type-badge">${changeType}</span>
        <span class="activity-timestamp">${timestamp}</span>
      </div>
    `;
  }).join('');

  return html;
}

// Render related files that import or reference current file
async function renderRelatedFiles(filePath, fileName) {
  if (!filePath || !fileName || !state.currentGraphData) {
    return '<div class="context-empty">No files reference this file</div>';
  }

  // Check if this is a code file (by extension)
  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.cpp', '.c', '.h'];
  const isCodeFile = codeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

  if (!isCodeFile) {
    return '<div class="context-empty">Related files detection available for code files only</div>';
  }

  // Get file name without extension for matching
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

  // Build list of candidate files (exclude directories and current file)
  const candidateFiles = state.currentGraphData.nodes.filter(node =>
    node.type === 'file' &&
    node.path !== state.inspectorNode.path &&
    node.sourceType === state.inspectorNode.sourceType
  );

  // Limit scan to first 50 files for performance
  const filesToScan = candidateFiles.slice(0, 50);

  const relatedFiles = [];

  // Scan each candidate file for imports/references
  for (const candidateNode of filesToScan) {
    try {
      const candidatePath = getInspectorFilePath(candidateNode);
      if (!candidatePath) continue;

      const result = await window.electronAPI.readFileContent(candidatePath);
      const content = result.content || '';
      if (!content) continue;

      // Check for import/require statements that reference current file
      const hasReference = content.split('\n').some(line => {
        const lowerLine = line.toLowerCase();
        const lowerFileName = fileNameWithoutExt.toLowerCase();

        // JavaScript/TypeScript patterns
        if (lowerLine.includes('import') && lowerLine.includes(lowerFileName)) return true;
        if (lowerLine.includes('require') && lowerLine.includes(lowerFileName)) return true;

        // Python patterns
        if (lowerLine.includes('from') && lowerLine.includes(lowerFileName)) return true;

        return false;
      });

      if (hasReference) {
        relatedFiles.push(candidateNode);
      }
    } catch (err) {
      // Skip files that can't be read
      continue;
    }
  }

  if (relatedFiles.length === 0) {
    return '<div class="context-empty">No files reference this file</div>';
  }

  // Generate HTML for related files
  const html = relatedFiles.map(node => {
    const displayPath = node.sourceType === 'src'
      ? `src/${node.path}`
      : `.planning/${node.path}`;

    return `
      <div class="related-file-item" data-node-path="${escapeHtml(node.path)}" data-source-type="${node.sourceType}">
        <span class="related-file-icon">📄</span>
        <span class="related-file-path">${escapeHtml(displayPath)}</span>
      </div>
    `;
  }).join('');

  return html;
}

// Show toast notification
function showToast(message, isError = false) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create and show new toast
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Compute a simple line-by-line session diff
function computeSessionDiff(oldContent, newContent) {
  const oldLines = (oldContent || '').split('\n');
  const newLines = (newContent || '').split('\n');
  const result = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      result.push({ type: 'added', line: newLines[j], lineNum: j + 1 });
      j++;
    } else if (j >= newLines.length) {
      result.push({ type: 'removed', line: oldLines[i], lineNum: i + 1 });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      result.push({ type: 'context', line: oldLines[i], lineNum: j + 1 });
      i++; j++;
    } else {
      // Changed line - show as removed then added
      result.push({ type: 'removed', line: oldLines[i], lineNum: i + 1 });
      result.push({ type: 'added', line: newLines[j], lineNum: j + 1 });
      i++; j++;
    }
  }
  return result;
}

// Render session diff view
function renderSessionDiffView(diffLines, filename) {
  if (!diffLines || diffLines.length === 0) {
    return '<div class="diff-status">No changes</div>';
  }

  const htmlLines = diffLines.map(item => {
    const lineClass = item.type === 'added' ? 'added' :
                      item.type === 'removed' ? 'removed' : 'context';
    const lineContent = applySyntaxHighlighting(escapeHtml(item.line), filename);
    return `<div class="diff-line-container">
      <span class="diff-line-number" data-line="${item.lineNum}">${item.lineNum}</span>
      <span class="diff-line-content diff-line ${lineClass}">${lineContent}</span>
    </div>`;
  }).join('');

  return `<div class="diff-content">${htmlLines}</div>`;
}

// Refresh only the diff section in details panel (more efficient than full refresh)
async function refreshDiffSection() {
  if (!state.selectedNode || state.selectedNode.type !== 'file') return;
  if (!state.selectedProjectPath || !window.electronAPI || !window.electronAPI.getGitDiff) return;

  const diffContent = document.getElementById('diff-view-content');
  if (!diffContent) return;

  // Build relative path for git (relative to project root)
  let relativePath;
  if (state.selectedNode.sourceType === 'planning') {
    relativePath = '.planning/' + state.selectedNode.path;
  } else if (state.selectedNode.sourceType === 'src') {
    relativePath = 'src/' + state.selectedNode.path;
  } else {
    relativePath = state.selectedNode.path;
  }

  try {
    diffContent.innerHTML = '<div class="diff-status">Loading diff...</div>';
    const diffResult = await window.electronAPI.getGitDiff(state.selectedProjectPath, relativePath);
    diffContent.innerHTML = renderDiffView(diffResult);
  } catch (err) {
    console.error('Error refreshing diff:', err);
    diffContent.innerHTML = '<div class="diff-status">Error loading diff</div>';
  }
}

// Close panel button handler
document.getElementById('close-panel')?.addEventListener('click', hideDetailsPanel);

// File inspector modal event listeners
document.getElementById('inspector-close')?.addEventListener('click', closeFileInspector);
document.getElementById('file-inspector-overlay')?.addEventListener('click', closeFileInspector);

// Collapsible section toggle
document.querySelectorAll('.collapsible-section .section-header').forEach(header => {
  header.addEventListener('click', (e) => {
    // Don't toggle when clicking mode buttons
    if (e.target.classList.contains('mode-btn')) return;
    const section = header.closest('.collapsible-section');
    section.classList.toggle('collapsed');
  });
});

// Diff mode toggle handler
document.querySelectorAll('.diff-mode-toggle .mode-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent section collapse
    const mode = btn.dataset.mode;
    if (mode === inspectorDiffMode) return; // Already active

    // Update active state
    document.querySelectorAll('.diff-mode-toggle .mode-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
    });

    inspectorDiffMode = mode;
    await populateInspectorDiff();
  });
});

// Line number click-to-jump handler (event delegation)
document.querySelector('#section-diff .section-content')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('diff-line-number')) {
    const container = e.target.closest('.diff-line-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

// Structure tree event delegation for clicks and collapse/expand
document.querySelector('#section-structure .section-content')?.addEventListener('click', (e) => {
  const structureItem = e.target.closest('.structure-item');
  if (!structureItem) return;

  const lineNum = parseInt(structureItem.dataset.line, 10);

  // Check if clicking on toggle icon
  if (e.target.classList.contains('structure-toggle')) {
    const toggle = e.target;
    const childrenContainer = structureItem.nextElementSibling;

    if (childrenContainer && childrenContainer.classList.contains('structure-children')) {
      toggle.classList.toggle('expanded');
      childrenContainer.classList.toggle('expanded');
    }
    return;
  }

  // Click on structure item - scroll diff to that line
  const diffContent = document.querySelector('#section-diff .section-content .diff-content');
  if (diffContent && lineNum) {
    // Find the line number element with matching line
    const lineNumEl = diffContent.querySelector(`.diff-line-number[data-line="${lineNum}"]`);
    if (lineNumEl) {
      // Remove active state from all items
      document.querySelectorAll('.structure-item.active').forEach(item => {
        item.classList.remove('active');
      });

      // Add active state to clicked item
      structureItem.classList.add('active');

      // Scroll into view with highlight
      const container = lineNumEl.closest('.diff-line-container');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Brief highlight effect
        container.style.transition = 'background 0.15s';
        container.style.background = 'rgba(78, 205, 196, 0.3)';
        setTimeout(() => {
          container.style.background = '';
        }, 1500);
      }
    }
  }
});

// Close modal on Escape key (also closes details panel)
document.addEventListener('keydown', (e) => {
  // Only handle in graph view
  if (state.activeView !== 'graph') return;

  if (e.key === 'Escape') {
    const modal = document.getElementById('file-inspector-modal');
    const searchContainer = document.getElementById('modal-search-container');

    // If search is open, close search first
    if (searchContainer && !searchContainer.classList.contains('hidden')) {
      closeModalSearch();
      return;
    }

    // If modal is open, close modal
    if (modal && !modal.classList.contains('hidden')) {
      closeFileInspector();
    } else {
      hideDetailsPanel();
    }
  }
});

// Ctrl+F opens search within modal
document.addEventListener('keydown', (e) => {
  // Only handle in graph view
  if (state.activeView !== 'graph') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    const modal = document.getElementById('file-inspector-modal');
    if (modal && !modal.classList.contains('hidden')) {
      e.preventDefault(); // Prevent browser search
      openModalSearch();
    }
  }
});

// Keyboard shortcuts for navigation (Alt+Left/Right)
document.addEventListener('keydown', (e) => {
  // Only handle in graph view
  if (state.activeView !== 'graph') return;

  // Alt+Left = Back
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateBack();
  }
  // Alt+Right = Forward
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    navigateForward();
  }
});

// Bookmark keyboard shortcuts (1-9 keys)
document.addEventListener('keydown', (e) => {
  // Only handle in graph view
  if (state.activeView !== 'graph') return;

  // Ignore if typing in input or if modal is open
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (document.getElementById('file-inspector-modal')?.classList.contains('visible')) return;
  if (document.getElementById('bookmark-dialog')?.classList.contains('visible')) return;

  // Number keys 1-9 for state.bookmarks
  const digit = parseInt(e.key, 10);
  if (digit >= 1 && digit <= 9) {
    const slot = digit - 1;  // Convert to 0-indexed

    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + 1-9 = Save bookmark
      e.preventDefault();
      showBookmarkSaveDialog(slot);
    } else {
      // Just 1-9 = Go to bookmark
      e.preventDefault();
      goToBookmark(slot);
    }
  }
});

// P key to toggle path playback
document.addEventListener('keydown', (e) => {
  // Only handle in graph view
  if (state.activeView !== 'graph') return;

  // Ignore if typing in input or if modal is open
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (document.getElementById('file-inspector-modal')?.classList.contains('visible')) return;
  if (document.getElementById('bookmark-dialog')?.classList.contains('visible')) return;

  if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    togglePathPlayback();
  }
});

// Path playback toggle button
document.getElementById('path-play')?.addEventListener('click', togglePathPlayback);

// Refresh button handler
document.getElementById('refresh-btn')?.addEventListener('click', async () => {
  if (state.selectedProjectPath) {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    showRefreshIndicator();
    await loadProject(state.selectedProjectPath);
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
document.getElementById('recent-projects')?.addEventListener('change', async (e) => {
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
    if (state.selectedProjectPath) {
      // Add to activity feed and get entry with mapped event type (always update state)
      const entry = addActivityEntry(data.event, data.path, data.sourceType);

      // Always flash tree item regardless of active view
      if (entry.nodeId) {
        flashTreeItem(entry.nodeId, entry.event);
      }

      // Trigger view-specific visual effects
      if (state.activeView === 'graph') {
        // Flash the 3D node with type-appropriate animation
        if (entry.nodeId) {
          flashNodeWithType(entry.nodeId, entry.event);

          // Follow camera to changed file if follow-active is enabled
          if (followActiveEnabled && entry.event !== 'deleted') {
            flyToNodeSmooth(entry.nodeId);
          }
        }

        // Check if the changed file is currently shown in details panel
        // and auto-refresh the diff section if so
        if (state.selectedNode && state.selectedNode.type === 'file' && entry.nodeId === state.selectedNode.id) {
          // Refresh diff section for the currently displayed file
          refreshDiffSection();
        }

        // Update timeline UI (range may have expanded with new entry)
        // If in live mode, timeline stays at live; if historical, don't auto-advance
        if (timelinePosition === null) {
          // In live mode - just update UI to reflect new range
          updateTimelineUI();
        }
      }

      // Always route file changes to diagram renderer (regardless of active view)
      // This ensures diagram gets real-time updates and flash animations work when switching views
      callDiagramFilesChangedHandler(data);

      // Dispatch to activity intelligence renderers (dashboard, heatmap, timeline)
      dispatchFileChange(data);

      // Always apply incremental graph update (update data regardless of view)
      applyIncrementalUpdate({
        event: data.event,
        path: data.path,
        sourceType: data.sourceType
      });

      // Update tree panel for new/deleted files (always update data)
      if (data.event === 'add' || data.event === 'addDir' || data.event === 'unlink' || data.event === 'unlinkDir') {
        // Rebuild tree data from storedDirectoryData (updated by applyIncrementalUpdate)
        state.treeData = buildTreeStructure(storedDirectoryData);
        if (state.activeView === 'graph') {
          updateTreePanel();
        }
      }

      // Refresh git status after file changes (always update data)
      await fetchGitStatus(state.selectedProjectPath);
    }
  });
}

// Listen for Claude Code operations (read/write/edit via hooks)
if (window.electronAPI && window.electronAPI.onClaudeOperation) {
  window.electronAPI.onClaudeOperation((event) => {
    // Clear hook status timeout on first event (hooks are working)
    if (hookStatusTimeout) {
      clearTimeout(hookStatusTimeout);
      hookStatusTimeout = null;
      console.log('[HookStatus] Claude events detected, hooks working');
    }

    // Log to debug panel if enabled
    logDebugOperation(event);

    console.log('[Claude Operation]', event.operation, event.file_path, 'nodeId:', event.nodeId);

    // Map Claude operations to change types for visual animation
    // - read: unique to Claude (file watchers can't detect reads)
    // - write: maps to 'modified' (file was written)
    // - edit: maps to 'modified' (file was edited)
    let changeType;
    if (event.operation === 'read') {
      changeType = 'read';
    } else if (event.operation === 'write' || event.operation === 'edit') {
      changeType = 'modified';
    } else {
      changeType = 'modified'; // Fallback for unknown operations
    }

    // Always flash tree item regardless of active view
    if (event.nodeId) {
      flashTreeItem(event.nodeId, changeType);
    }

    // Trigger view-specific visual effects
    if (state.activeView === 'graph' && event.nodeId) {
      // Flash the 3D node if we have a valid nodeId
      flashNodeWithType(event.nodeId, changeType);

      // Follow camera to file if follow-active is enabled (but not for reads)
      if (followActiveEnabled && changeType !== 'read') {
        flyToNodeSmooth(event.nodeId);
      }
    }

    // Always route Claude operations to diagram renderer (regardless of active view)
    // This ensures diagram flash animations work when switching views
    if (event.nodeId) {
      // Map changeType values to chokidar event names that diagram expects
      let diagramEvent;
      if (changeType === 'created') {
        diagramEvent = 'add';
      } else if (changeType === 'deleted') {
        diagramEvent = 'unlink';
      } else {
        diagramEvent = 'change'; // 'modified' and 'read' both map to 'change'
      }

      callDiagramFilesChangedHandler({
        event: diagramEvent,
        path: event.file_path,
        sourceType: event.file_path.includes('.planning') ? 'planning' : 'src'
      });
    }

    // Dispatch to activity intelligence renderers (dashboard, heatmap, timeline)
    dispatchClaudeOperation(event);
  });
}

// Load recent projects on startup
updateRecentProjects();

// Listen for menu Open Folder command
if (window.electronAPI && window.electronAPI.onMenuOpenFolder) {
  window.electronAPI.onMenuOpenFolder(async (folderPath) => {
    console.log('[Menu] Open folder:', folderPath);
    if (folderPath) {
      await loadProject(folderPath);
    }
  });
}

// Listen for menu Close Folder command
if (window.electronAPI && window.electronAPI.onMenuCloseFolder) {
  window.electronAPI.onMenuCloseFolder(() => {
    console.log('[Menu] Close folder');

    // Stop watching
    if (window.electronAPI && window.electronAPI.stopWatching) {
      window.electronAPI.stopWatching();
    }

    // Clear graph
    if (Graph) {
      Graph.graphData({ nodes: [], links: [] });
    }

    // Reset state
    state.selectedProjectPath = null;
    state.currentGraphData = { nodes: [], links: [] };
    connectionCounts = new Map();
    storedDirectoryData = null;
    storedRoadmapData = null;
    storedRequirementsData = null;
    state.treeData = null;
    activityFeed = [];

    // Clear UI elements
    const selectedPathEl = document.getElementById('selected-path');
    if (selectedPathEl) selectedPathEl.textContent = 'No project selected';

    // Clear tree panel
    updateTreePanel();

    // Clear activity feed
    const activityList = document.getElementById('activity-list');
    if (activityList) activityList.innerHTML = '';

    // Clear details panel
    const detailsContent = document.getElementById('details-content');
    if (detailsContent) {
      detailsContent.innerHTML = '<p class="no-selection">Select a node to view details</p>';
    }

    // Dismiss hook notification if visible
    dismissHookNotification();

    console.log('[Menu] Folder closed, view reset');
  });
}

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
    return state.treeExpanded.has(node.id) ? '📂' : '📁';
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
    const isExpanded = state.treeExpanded.has(node.id);
    const isSelected = state.selectedNode && state.selectedNode.id === node.id;

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
  if (!content || !state.treeData) return;

  content.innerHTML = renderTree(state.treeData);

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
  return state.currentGraphData.nodes.find(n => n.id === nodeId);
}

// Toggle expand/collapse for a directory
function toggleTreeExpand(nodeId) {
  if (state.treeExpanded.has(nodeId)) {
    state.treeExpanded.delete(nodeId);
  } else {
    state.treeExpanded.add(nodeId);
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

  if (!state.treeData) return;
  const path = findPath(state.treeData, nodeId);
  if (path) {
    // Expand all nodes in path except the target itself
    path.slice(0, -1).forEach(id => state.treeExpanded.add(id));
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

    if (state.is3D) {
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
document.getElementById('tree-toggle')?.addEventListener('click', () => {
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

// Apply default tree panel width on startup (tree opens by default)
applyTreePanelWidth(treePanelWidth);

// =====================================================
// ACTIVITY FEED FUNCTIONALITY
// =====================================================

// Update activity badge
function updateActivityBadge() {
  const badge = document.getElementById('activity-badge');
  if (!badge) return;

  if (state.activityUnreadCount > 0) {
    badge.textContent = state.activityUnreadCount > 99 ? '99+' : state.activityUnreadCount;
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

  if (state.activityEntries.length === 0) {
    content.innerHTML = '<div class="activity-empty">No recent activity</div>';
    return;
  }

  // Render entries (newest first, already sorted)
  content.innerHTML = state.activityEntries.map(entry => {
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
document.getElementById('activity-toggle')?.addEventListener('click', () => {
  const panel = document.getElementById('activity-panel');
  const toggle = document.getElementById('activity-toggle');
  const graphContainer = document.getElementById('graph-container');

  panel.classList.toggle('visible');
  toggle.classList.toggle('panel-open');
  graphContainer.classList.toggle('activity-open');

  // Clear unread count when opening
  if (panel.classList.contains('visible')) {
    state.activityUnreadCount = 0;
    updateActivityBadge();
  }

  // Resize graph
  setTimeout(() => handleResize(), 300);
});

// Clear button handler
document.getElementById('activity-clear')?.addEventListener('click', () => {
  state.activityEntries = [];
  state.activityUnreadCount = 0;
  updateActivityBadge();
  updateActivityPanel();
});

// Statistics panel toggle button handler
document.getElementById('statistics-toggle')?.addEventListener('click', () => {
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
  if (state.activityEntries.length > 0) {
    updateActivityPanel();
  }
}, 30000);

// Dimension toggle button handler
document.getElementById('dimension-toggle')?.addEventListener('click', () => {
  const toggle = document.getElementById('dimension-toggle');

  // Toggle dimension state
  state.is3D = !state.is3D;

  // Update graph dimensions
  Graph.numDimensions(state.is3D ? 3 : 2);

  // Update button text to reflect current mode
  toggle.textContent = state.is3D ? '3D' : '2D';

  // For 2D mode, adjust camera to top-down view for better visualization
  if (!state.is3D) {
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
// ZOOM PRESET FUNCTIONS
// =====================================================

// Zoom preset: Overview - show entire graph
function zoomToOverview() {
  if (!Graph || !state.currentGraphData || state.currentGraphData.nodes.length === 0) return;

  // Calculate bounding box of all nodes
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  state.currentGraphData.nodes.forEach(node => {
    if (node.x !== undefined) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
      minZ = Math.min(minZ, node.z || 0);
      maxZ = Math.max(maxZ, node.z || 0);
    }
  });

  // Calculate center and required distance
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanY, spanZ, 100);

  // Distance based on graph size (with padding)
  const distance = maxSpan * 1.5;

  if (state.is3D) {
    Graph.cameraPosition(
      { x: centerX + distance * 0.5, y: centerY + distance * 0.5, z: centerZ + distance },
      { x: centerX, y: centerY, z: centerZ },
      1000
    );
  } else {
    Graph.cameraPosition(
      { x: centerX, y: centerY, z: distance + 200 },
      { x: centerX, y: centerY, z: 0 },
      1000
    );
  }

  console.log('[Camera] Zoom to overview');
}

// Zoom preset: Focus - selected node at medium distance
function zoomToFocus() {
  if (!Graph || !state.selectedNode) {
    console.log('[Camera] No node selected for focus zoom');
    return;
  }

  const node = state.currentGraphData.nodes.find(n => n.id === state.selectedNode.id);
  if (!node || node.x === undefined) return;

  const distance = 120; // Medium distance for context

  if (state.is3D) {
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: (node.z || 0) * distRatio
      },
      node,
      1000
    );
  } else {
    Graph.cameraPosition(
      { x: node.x || 0, y: node.y || 0, z: distance + 100 },
      node,
      1000
    );
  }

  console.log('[Camera] Zoom to focus on:', state.selectedNode.id);
}

// Zoom preset: Detail - close-up on selected node
function zoomToDetail() {
  if (!Graph || !state.selectedNode) {
    console.log('[Camera] No node selected for detail zoom');
    return;
  }

  const node = state.currentGraphData.nodes.find(n => n.id === state.selectedNode.id);
  if (!node || node.x === undefined) return;

  const distance = 40; // Close distance for inspection

  if (state.is3D) {
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    Graph.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: (node.z || 0) * distRatio
      },
      node,
      1000
    );
  } else {
    Graph.cameraPosition(
      { x: node.x || 0, y: node.y || 0, z: distance + 50 },
      node,
      1000
    );
  }

  console.log('[Camera] Zoom to detail on:', state.selectedNode.id);
}

// Update zoom button states based on selection
function updateZoomButtonStates() {
  const focusBtn = document.getElementById('zoom-focus');
  const detailBtn = document.getElementById('zoom-detail');

  if (state.selectedNode) {
    focusBtn?.classList.remove('disabled');
    detailBtn?.classList.remove('disabled');
  } else {
    focusBtn?.classList.add('disabled');
    detailBtn?.classList.add('disabled');
  }
}

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

    if (state.is3D) {
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
    if (timelinePosition === null && state.activityEntries.length > 0) {
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
  if (!isTimelinePlaying || state.activityEntries.length === 0) {
    // Stop if not playing or no entries
    clearInterval(playbackInterval);
    playbackInterval = null;
    isTimelinePlaying = false;
    updateTimelineUI();
    return;
  }

  // Find next activity entry after current timelinePosition
  // state.activityEntries is sorted newest first, so we search from end to find next
  const sortedByTime = [...state.activityEntries].sort((a, b) => a.timestamp - b.timestamp);

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
  state.activityEntries.forEach(entry => {
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

  return { ranked, total: state.activityEntries.length };
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

  if (state.activityEntries.length === 0) {
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

    if (state.is3D) {
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
  if (state.activityEntries.length === 0) {
    return { buckets: [], oldest: 0, newest: 0 };
  }

  // Find time range
  const timestamps = state.activityEntries.map(e => e.timestamp);
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
  state.activityEntries.forEach(entry => {
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

  if (state.activityEntries.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity data</div>';
    return;
  }

  const { buckets, oldest, newest } = calculateTimeBuckets();

  if (buckets.length === 0) {
    container.innerHTML = '<div class="stats-empty">No activity data</div>';
    return;
  }

  // Handle single activity
  if (state.activityEntries.length === 1) {
    container.innerHTML = `<div class="activity-chart">
      <div class="chart-bars">
        <div class="chart-bar" style="height: 100%" title="1 change at ${formatChartTooltip(state.activityEntries[0].timestamp)}">
          <span class="bar-value">1</span>
        </div>
      </div>
      <div class="chart-axis">
        <span class="axis-start">${formatChartTime(state.activityEntries[0].timestamp)}</span>
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

// Flash duration slider handler
document.getElementById('flash-duration-slider')?.addEventListener('input', async (e) => {
  const ms = parseInt(e.target.value, 10);
  flashDuration = ms;

  // Update display
  const valueDisplay = document.getElementById('flash-duration-value');
  if (valueDisplay) valueDisplay.textContent = formatFlashDuration(ms);

  // Update CSS custom property for tree flash animations
  document.documentElement.style.setProperty('--flash-duration', `${ms}ms`);

  // Save to store
  try {
    await window.electronAPI.store.set('flashDuration', ms);
  } catch (err) {
    console.log('[Flash] Could not save duration setting:', err);
  }
});

// Flash intensity slider handler
document.getElementById('flash-intensity-slider')?.addEventListener('input', async (e) => {
  const value = parseInt(e.target.value, 10);
  // Allow up to 3x intensity (slider still 50-200 range, but multiply by 1.5)
  flashIntensity = (value / 100) * 1.5; // Convert and boost: 50->0.75x, 100->1.5x, 200->3x

  // Update display
  const valueDisplay = document.getElementById('flash-intensity-value');
  if (valueDisplay) valueDisplay.textContent = formatFlashIntensity(value);

  // Save to store
  try {
    await window.electronAPI.store.set('flashIntensity', value);
  } catch (err) {
    console.log('[Flash] Could not save intensity setting:', err);
  }
});

// Particle effects toggle handler
document.getElementById('particle-effects-toggle')?.addEventListener('change', async (e) => {
  particleEffectsEnabled = e.target.checked;

  // Save to store
  try {
    await window.electronAPI.store.set('particleEffectsEnabled', particleEffectsEnabled);
  } catch (err) {
    console.log('[Particles] Could not save particle effects setting:', err);
  }
});

// Load flash settings on startup
loadFlashSettings();

// Activity trails toggle handler
document.getElementById('trails-toggle')?.addEventListener('click', async () => {
  activityTrailsEnabled = !activityTrailsEnabled;

  const toggle = document.getElementById('trails-toggle');
  if (toggle) {
    if (activityTrailsEnabled) {
      toggle.classList.add('active');
      console.log('[Trail] Activity trails enabled');
    } else {
      toggle.classList.remove('active');
      // Clear existing trails when disabled
      clearAllTrails();
      console.log('[Trail] Activity trails disabled');
    }
  }

  // Save to store
  try {
    await window.electronAPI.store.set('activityTrailsEnabled', activityTrailsEnabled);
  } catch (err) {
    console.log('[Trail] Could not save setting:', err);
  }
});

// Follow-active toggle
document.getElementById('follow-toggle')?.addEventListener('click', async () => {
  followActiveEnabled = !followActiveEnabled;

  const toggle = document.getElementById('follow-toggle');
  if (toggle) {
    if (followActiveEnabled) {
      toggle.classList.add('active');
      console.log('[Camera] Follow-active mode enabled');
    } else {
      toggle.classList.remove('active');
      console.log('[Camera] Follow-active mode disabled');
    }
  }

  // Persist setting
  try {
    await window.electronAPI.store.set('followActiveEnabled', followActiveEnabled);
  } catch (err) {
    console.log('[Camera] Could not save follow-active setting:', err);
  }
});

// Trail duration slider handler
document.getElementById('trail-duration-slider')?.addEventListener('input', async (e) => {
  const seconds = parseInt(e.target.value, 10);
  trailFadeDuration = seconds * 1000; // Convert to ms

  // Update display
  const valueDisplay = document.getElementById('trail-duration-value');
  if (valueDisplay) valueDisplay.textContent = formatTrailDuration(trailFadeDuration);

  // Save to store
  try {
    await window.electronAPI.store.set('trailFadeDuration', trailFadeDuration);
  } catch (err) {
    console.log('[Trail] Could not save duration setting:', err);
  }
});

// Load trail settings on startup
loadTrailSettings();

// Load follow-active setting on startup
loadFollowActiveSetting();

// Load state.bookmarks on startup
loadBookmarks();

// Update bookmark indicator on startup
updateBookmarkIndicator();

// Load navigation history on startup
loadNavigationHistory();

// Zoom preset buttons
document.getElementById('zoom-overview')?.addEventListener('click', () => {
  zoomToOverview();
});

document.getElementById('zoom-focus')?.addEventListener('click', () => {
  zoomToFocus();
});

document.getElementById('zoom-detail')?.addEventListener('click', () => {
  zoomToDetail();
});

// Initialize zoom button states (disabled on startup)
updateZoomButtonStates();

// Orbit mode toggle
document.getElementById('orbit-toggle')?.addEventListener('click', toggleOrbitMode);

// Orbit speed slider
document.getElementById('orbit-speed-slider')?.addEventListener('input', (e) => {
  updateOrbitSpeed(parseFloat(e.target.value));
});

// Persist orbit speed
document.getElementById('orbit-speed-slider')?.addEventListener('change', async (e) => {
  try {
    await window.electronAPI.store.set('orbitSpeed', parseFloat(e.target.value));
  } catch (err) {
    console.log('[Orbit] Could not save speed setting:', err);
  }
});

// Load orbit speed setting on startup
loadOrbitSpeedSetting();

// Orbit zoom (mouse wheel during orbit mode)
document.getElementById('graph-container')?.addEventListener('wheel', (e) => {
  if (orbitModeEnabled) {
    e.preventDefault();
    e.stopPropagation();
    handleOrbitZoom(e.deltaY);
  }
}, { passive: false });

// Navigation history controls
document.getElementById('nav-back')?.addEventListener('click', () => {
  navigateBack();
});

document.getElementById('nav-forward')?.addEventListener('click', () => {
  navigateForward();
});

// Recent nodes dropdown selection
document.getElementById('recent-nodes')?.addEventListener('change', (e) => {
  const nodeId = e.target.value;
  if (!nodeId) return;

  // Reset dropdown display
  e.target.value = '';

  // Find and navigate to selected node
  const node = state.currentGraphData?.nodes?.find(n => n.id === nodeId);
  if (node) {
    flyToNodeSmooth(nodeId, 80);
    showDetailsPanel(node);
  }
});

// Initialize navigation controls
updateNavigationButtonStates();

// Breadcrumb trail click handler (event delegation)
document.getElementById('breadcrumb-trail')?.addEventListener('click', (e) => {
  const segment = e.target.closest('.breadcrumb-segment');
  if (!segment || segment.classList.contains('current')) return;

  const nodeId = segment.getAttribute('data-node-id');
  if (!nodeId) return;

  // Find node in graph data
  const node = state.currentGraphData?.nodes?.find(n => n.id === nodeId);
  if (node) {
    flyToNodeSmooth(nodeId, 80);
    showDetailsPanel(node);
  }
});

// Bookmark button click - show dialog
document.getElementById('bookmark-btn')?.addEventListener('click', () => {
  showBookmarkSaveDialog();
});

// Bookmark dialog close button
document.getElementById('bookmark-dialog-close')?.addEventListener('click', hideBookmarkDialog);

// Bookmark cancel button
document.getElementById('bookmark-cancel-btn')?.addEventListener('click', hideBookmarkDialog);

// Bookmark save button
document.getElementById('bookmark-save-btn')?.addEventListener('click', handleBookmarkSave);

// Close dialog on overlay click
document.getElementById('bookmark-dialog-overlay')?.addEventListener('click', hideBookmarkDialog);

// Enter key in name input saves bookmark
document.getElementById('bookmark-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleBookmarkSave();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    hideBookmarkDialog();
  }
});

// Modal search event listeners
document.getElementById('modal-search-input')?.addEventListener('input', (e) => {
  performSearch(e.target.value);
});

document.getElementById('search-prev')?.addEventListener('click', prevMatch);
document.getElementById('search-next')?.addEventListener('click', nextMatch);
document.getElementById('search-close')?.addEventListener('click', closeModalSearch);

// Enter key navigates to next match
document.getElementById('modal-search-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      prevMatch();
    } else {
      nextMatch();
    }
  }
});

// =====================================================
// MINIMAP FUNCTIONALITY
// =====================================================

/**
 * Calculate the bounding box of all nodes in the graph (world coordinates)
 */
function calculateMinimapBounds() {
  if (!state.currentGraphData?.nodes || state.currentGraphData.nodes.length === 0) {
    return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  state.currentGraphData.nodes.forEach(node => {
    if (node.x !== undefined && node.y !== undefined) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
  });

  // If no positioned nodes, return default bounds
  if (!isFinite(minX)) {
    return { minX: -100, maxX: 100, minY: -100, maxY: 100 };
  }

  // Add 10% padding around bounds
  const xPadding = (maxX - minX) * 0.1 || 10;
  const yPadding = (maxY - minY) * 0.1 || 10;

  return {
    minX: minX - xPadding,
    maxX: maxX + xPadding,
    minY: minY - yPadding,
    maxY: maxY + yPadding
  };
}

/**
 * Convert world coordinates to minimap canvas coordinates
 */
function worldToMinimap(worldX, worldY) {
  if (!minimapCanvas) return { x: 0, y: 0 };

  const canvasWidth = minimapCanvas.width - MINIMAP_PADDING * 2;
  const canvasHeight = minimapCanvas.height - MINIMAP_PADDING * 2;
  const worldWidth = minimapBounds.maxX - minimapBounds.minX;
  const worldHeight = minimapBounds.maxY - minimapBounds.minY;

  const x = ((worldX - minimapBounds.minX) / worldWidth) * canvasWidth + MINIMAP_PADDING;
  const y = ((worldY - minimapBounds.minY) / worldHeight) * canvasHeight + MINIMAP_PADDING;

  return { x, y };
}

/**
 * Convert minimap canvas coordinates to world coordinates
 */
function minimapToWorld(canvasX, canvasY) {
  if (!minimapCanvas) return { x: 0, y: 0 };

  const canvasWidth = minimapCanvas.width - MINIMAP_PADDING * 2;
  const canvasHeight = minimapCanvas.height - MINIMAP_PADDING * 2;
  const worldWidth = minimapBounds.maxX - minimapBounds.minX;
  const worldHeight = minimapBounds.maxY - minimapBounds.minY;

  const x = ((canvasX - MINIMAP_PADDING) / canvasWidth) * worldWidth + minimapBounds.minX;
  const y = ((canvasY - MINIMAP_PADDING) / canvasHeight) * worldHeight + minimapBounds.minY;

  return { x, y };
}

/**
 * Draw camera viewport rectangle on minimap
 */
function drawMinimapViewport(ctx) {
  if (!Graph || !Graph.cameraPosition) return;

  // Get camera position - this is the center of the viewport
  const cameraPos = Graph.cameraPosition();
  if (!cameraPos || !cameraPos.x || !cameraPos.y) return;

  // Estimate viewport size based on camera distance
  // The viewport size in world coordinates depends on camera distance
  // Rough approximation: viewport size is proportional to distance from origin
  const distance = Math.sqrt(cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y + (cameraPos.z || 0) * (cameraPos.z || 0));
  const viewportWorldWidth = Math.max(distance * 0.5, 50); // Minimum 50 units
  const viewportWorldHeight = Math.max(distance * 0.375, 37.5); // Maintain aspect ratio

  // Calculate viewport bounds in world coordinates
  const viewportMinX = cameraPos.x - viewportWorldWidth / 2;
  const viewportMaxX = cameraPos.x + viewportWorldWidth / 2;
  const viewportMinY = cameraPos.y - viewportWorldHeight / 2;
  const viewportMaxY = cameraPos.y + viewportWorldHeight / 2;

  // Convert to minimap coordinates
  const topLeft = worldToMinimap(viewportMinX, viewportMinY);
  const bottomRight = worldToMinimap(viewportMaxX, viewportMaxY);

  const rectWidth = bottomRight.x - topLeft.x;
  const rectHeight = bottomRight.y - topLeft.y;

  // Draw viewport rectangle
  ctx.strokeStyle = '#4ECDC4'; // Teal accent color
  ctx.lineWidth = 2;
  ctx.strokeRect(topLeft.x, topLeft.y, rectWidth, rectHeight);

  // Draw semi-transparent fill
  ctx.fillStyle = 'rgba(78, 205, 196, 0.15)';
  ctx.fillRect(topLeft.x, topLeft.y, rectWidth, rectHeight);
}

/**
 * Render the minimap - draw all nodes as dots and viewport rectangle
 */
function renderMinimap() {
  if (!minimapCtx || !minimapCanvas || minimapCollapsed) return;

  // Clear canvas
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  // Recalculate bounds (nodes may have moved)
  minimapBounds = calculateMinimapBounds();

  // Draw nodes as dots
  if (state.currentGraphData?.nodes) {
    state.currentGraphData.nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const pos = worldToMinimap(node.x, node.y);

        minimapCtx.fillStyle = '#4ECDC4'; // Teal dots
        minimapCtx.beginPath();
        minimapCtx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });
  }

  // Draw viewport rectangle
  drawMinimapViewport(minimapCtx);
}

/**
 * Start minimap continuous update loop (RAF)
 */
function startMinimapUpdateLoop() {
  function updateLoop() {
    renderMinimap();
    animationFrameIds.minimap = requestAnimationFrame(updateLoop);
    minimapRafId = animationFrameIds.minimap;
  }
  updateLoop();
}

/**
 * Stop minimap update loop
 */
function stopMinimapUpdateLoop() {
  if (minimapRafId) {
    cancelAnimationFrame(minimapRafId);
    minimapRafId = null;
  }
}

/**
 * Navigate camera to a position on the minimap (with animation)
 */
function navigateToMinimapPosition(canvasX, canvasY) {
  if (!Graph || !Graph.cameraPosition) return;

  const worldPos = minimapToWorld(canvasX, canvasY);

  // Calculate camera distance to maintain current zoom level
  const currentPos = Graph.cameraPosition();
  const currentDistance = Math.sqrt(
    currentPos.x * currentPos.x +
    currentPos.y * currentPos.y +
    (currentPos.z || 0) * (currentPos.z || 0)
  );

  // Navigate to the clicked position with smooth animation
  if (state.is3D) {
    // In 3D, position camera at same distance but looking at clicked point
    const distRatio = currentDistance / Math.hypot(worldPos.x, worldPos.y, 0) || 1;
    Graph.cameraPosition(
      {
        x: worldPos.x * distRatio,
        y: worldPos.y * distRatio,
        z: currentDistance * 0.5
      },
      { x: worldPos.x, y: worldPos.y, z: 0 },
      800  // Smooth animation
    );
  } else {
    // In 2D, position camera above the clicked point
    Graph.cameraPosition(
      { x: worldPos.x, y: worldPos.y, z: currentDistance },
      { x: worldPos.x, y: worldPos.y, z: 0 },
      800
    );
  }

  console.log('[Minimap] Navigated to:', worldPos);
}

/**
 * Handle minimap click - navigate camera to clicked position
 */
function handleMinimapClick(event) {
  // Don't trigger click navigation if user was dragging
  if (minimapDragging) return;

  const rect = minimapCanvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  navigateToMinimapPosition(canvasX, canvasY);
}

/**
 * Navigate camera to a position on the minimap instantly (for drag)
 */
function navigateToMinimapPositionInstant(canvasX, canvasY) {
  if (!Graph || !Graph.cameraPosition) return;

  const worldPos = minimapToWorld(canvasX, canvasY);

  // Calculate camera distance to maintain current zoom level
  const currentPos = Graph.cameraPosition();
  const currentDistance = Math.sqrt(
    currentPos.x * currentPos.x +
    currentPos.y * currentPos.y +
    (currentPos.z || 0) * (currentPos.z || 0)
  );

  // Navigate instantly (0ms duration) for smooth dragging
  if (state.is3D) {
    const distRatio = currentDistance / Math.hypot(worldPos.x, worldPos.y, 0) || 1;
    Graph.cameraPosition(
      {
        x: worldPos.x * distRatio,
        y: worldPos.y * distRatio,
        z: currentDistance * 0.5
      },
      { x: worldPos.x, y: worldPos.y, z: 0 },
      0  // Instant, no animation
    );
  } else {
    Graph.cameraPosition(
      { x: worldPos.x, y: worldPos.y, z: currentDistance },
      { x: worldPos.x, y: worldPos.y, z: 0 },
      0
    );
  }
}

/**
 * Handle minimap mouse down - start drag
 */
function handleMinimapMouseDown(event) {
  minimapDragging = true;

  const rect = minimapCanvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  navigateToMinimapPositionInstant(canvasX, canvasY);
}

/**
 * Handle minimap mouse move - continue drag
 */
function handleMinimapMouseMove(event) {
  if (!minimapDragging) return;

  const rect = minimapCanvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  navigateToMinimapPositionInstant(canvasX, canvasY);
}

/**
 * Handle minimap mouse up - end drag
 */
function handleMinimapMouseUp(event) {
  minimapDragging = false;
}

/**
 * Handle minimap mouse leave - end drag if active
 */
function handleMinimapMouseLeave(event) {
  minimapDragging = false;
}

/**
 * Initialize minimap - set up canvas and start updates
 */
function initMinimap() {
  minimapCanvas = document.getElementById('minimap-canvas');
  if (!minimapCanvas) return;

  minimapCtx = minimapCanvas.getContext('2d');
  if (!minimapCtx) return;

  // Set up collapse toggle
  const minimapHeader = document.getElementById('minimap-header');
  const minimapPanel = document.getElementById('minimap-panel');

  if (minimapHeader && minimapPanel) {
    minimapHeader.addEventListener('click', () => {
      minimapCollapsed = !minimapCollapsed;
      minimapPanel.classList.toggle('collapsed', minimapCollapsed);

      if (!minimapCollapsed) {
        startMinimapUpdateLoop();
      } else {
        stopMinimapUpdateLoop();
      }
    });
  }

  // Add click listener for navigation
  minimapCanvas.addEventListener('click', handleMinimapClick);

  // Add drag listeners for continuous positioning
  minimapCanvas.addEventListener('mousedown', handleMinimapMouseDown);
  minimapCanvas.addEventListener('mousemove', handleMinimapMouseMove);
  minimapCanvas.addEventListener('mouseup', handleMinimapMouseUp);
  minimapCanvas.addEventListener('mouseleave', handleMinimapMouseLeave);

  // Add global mouseup listener to end drag even if released outside canvas
  document.addEventListener('mouseup', () => {
    if (minimapDragging) {
      minimapDragging = false;
    }
  });

  // Start update loop
  startMinimapUpdateLoop();
}

// Initialize minimap on load
initMinimap();

// =====================================================
// HOOK STATUS DETECTION & DEBUG MODE
// =====================================================

// Start hook status detection (called after project loads)
function startHookStatusDetection() {
  hookStatusTimeout = setTimeout(() => {
    if (!hookNotificationDismissed) {
      document.getElementById('hook-status-notification')?.classList.remove('hidden');
      console.log('[HookStatus] No Claude events received in 30s, showing notification');
    }
  }, HOOK_DETECTION_DELAY);
}

// Dismiss hook notification
function dismissHookNotification() {
  document.getElementById('hook-status-notification')?.classList.add('hidden');
  hookNotificationDismissed = true;
}

// Open setup guide in browser
async function showHookHelp() {
  console.log('[HookHelp] Opening setup guide...');
  try {
    await window.electronAPI.openExternal('https://github.com/anthropics/claude-code/blob/main/HOOKS.md');
    console.log('[HookHelp] Setup guide opened successfully');
  } catch (err) {
    console.error('[HookHelp] Failed to open setup guide:', err);
  }
  dismissHookNotification();
}

// Hook notification button event listeners
console.log('[HookNotification] Setting up click listener on document');

document.addEventListener('click', (e) => {
  // Log every click for debugging
  console.log('[HookNotification] Click on:', e.target.tagName, e.target.id || e.target.className);

  const dismissBtn = e.target.closest('#hook-dismiss-btn');
  const helpBtn = e.target.closest('#hook-help-btn');

  if (dismissBtn) {
    console.log('[HookNotification] Dismiss button matched!');
    e.preventDefault();
    e.stopPropagation();
    dismissHookNotification();
  } else if (helpBtn) {
    console.log('[HookNotification] Help button matched!');
    e.preventDefault();
    e.stopPropagation();
    showHookHelp();
  }
});

console.log('[HookNotification] Click listener setup complete');

// Debug mode toggle handler
document.getElementById('debug-toggle')?.addEventListener('click', (e) => {
  debugModeEnabled = !debugModeEnabled;
  e.target.closest('#debug-toggle').classList.toggle('active', debugModeEnabled);
  document.getElementById('debug-panel')?.classList.toggle('hidden', !debugModeEnabled);
  console.log('[Debug] Mode', debugModeEnabled ? 'enabled' : 'disabled');
});

// Debug clear button
document.getElementById('debug-clear')?.addEventListener('click', () => {
  const content = document.getElementById('debug-content');
  if (content) content.innerHTML = '';
});

// Log Claude operation to debug panel
function logDebugOperation(event) {
  if (!debugModeEnabled) return;

  const content = document.getElementById('debug-content');
  if (!content) return;

  const entry = document.createElement('div');
  entry.className = 'debug-entry';

  const time = new Date(event.timestamp).toLocaleTimeString();
  const op = event.operation;
  const path = event.file_path.split('/').pop(); // Just filename

  entry.innerHTML = `
    <span class="debug-time">${time}</span>
    <span class="debug-op ${op}">${op.toUpperCase()}</span>
    <span class="debug-path">${path}</span>
    ${event.nodeId ? '' : '<span style="color:#FF6B6B">(no node)</span>'}
  `;

  content.insertBefore(entry, content.firstChild);

  // Limit entries
  while (content.children.length > MAX_DEBUG_ENTRIES) {
    content.removeChild(content.lastChild);
  }
}

// ============================================================================
// LIFECYCLE METHODS (for view switching and cleanup)
// ============================================================================

/**
 * Mount the graph renderer
 * Starts animation loops and initializes the graph
 *
 * @param {HTMLElement} containerEl - Optional container element (defaults to current)
 */
export function mount(containerEl) {
  console.log('[Lifecycle] Mounting graph renderer');

  // Start animation loops that were stopped during unmount
  if (nodeHeatMap.size > 0 && !heatLoopRunning) {
    startHeatDecayLoop();
  }

  if (activityTrails.length > 0 && !trailLoopRunning) {
    startTrailAnimationLoop();
  }

  if (!minimapRafId) {
    startMinimapUpdateLoop();
  }

  // Restore selection state if a node was selected before unmount
  const selectedNodeId = state.selectedNode?.id || state.selectedNode;
  if (selectedNodeId && Graph) {
    console.log('[Lifecycle] Restoring selection:', selectedNodeId);

    // Find the node in current graph data
    const node = state.currentGraphData.nodes.find(n => n.id === selectedNodeId);
    if (node) {
      // Re-highlight the node visually
      // The details panel should already be visible via state
      highlightNodeInGraph(selectedNodeId);
    }
  }

  console.log('[Lifecycle] Graph renderer mounted');
}

/**
 * Unmount the graph renderer
 * Cancels all animation frames, clears intervals, and resets view state
 * Call this before switching to diagram view to prevent memory leaks
 */
export function unmount() {
  console.log('[Lifecycle] Unmounting graph renderer');

  // Cancel all registered animation frames
  Object.keys(animationFrameIds).forEach(key => {
    if (animationFrameIds[key]) {
      cancelAnimationFrame(animationFrameIds[key]);
      animationFrameIds[key] = null;
    }
  });

  // Cancel flash animations
  flashingNodes.forEach((anim, nodeId) => {
    if (anim.rafId) {
      cancelAnimationFrame(anim.rafId);
    }
  });
  flashingNodes.clear();

  // Clear intervals and timeouts
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
  }

  if (pathPlaybackTimeoutId) {
    clearTimeout(pathPlaybackTimeoutId);
    pathPlaybackTimeoutId = null;
  }

  if (hookStatusTimeout) {
    clearTimeout(hookStatusTimeout);
    hookStatusTimeout = null;
  }

  // Stop specific animation loops
  if (heatLoopRafId) {
    cancelAnimationFrame(heatLoopRafId);
    heatLoopRafId = null;
    heatLoopRunning = false;
  }

  if (trailLoopRafId) {
    cancelAnimationFrame(trailLoopRafId);
    trailLoopRafId = null;
    trailLoopRunning = false;
  }

  if (minimapRafId) {
    cancelAnimationFrame(minimapRafId);
    minimapRafId = null;
  }

  if (orbitAnimationId) {
    cancelAnimationFrame(orbitAnimationId);
    orbitAnimationId = null;
  }

  // Reset view state (clears selection, inspection, etc.)
  resetViewState();

  console.log('[Lifecycle] Graph renderer unmounted');
}

/**
 * Get reference to the ForceGraph3D instance
 * Useful for external integrations or diagram view to access camera, scene, etc.
 *
 * @returns {Object} ForceGraph3D instance
 */
export function getGraph() {
  return Graph;
}

/**
 * Highlight a node in the graph view
 * Used for cross-view synchronization (diagram->graph)
 *
 * @param {string} nodeId - Node ID to highlight
 */
export { highlightNodeInGraph };

// Register handlers with state-manager to break circular dependencies
// This allows diagram-renderer to call these functions without importing from graph-renderer
registerHighlightNodeHandler(highlightNodeInGraph);
registerOpenFileInspectorHandler(openFileInspector);

console.log('GSD Viewer initialized - select a project folder to visualize');
