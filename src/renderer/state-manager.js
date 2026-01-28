/**
 * State Manager
 *
 * Centralized state management for GSD Viewer with Proxy-based reactivity.
 * All shared state variables live here, enabling clean separation between
 * graph view and diagram view without circular dependencies.
 */

// ============================================================================
// DEFAULT STATE VALUES
// ============================================================================

/**
 * Default state values used for initialization and reset
 */
const DEFAULT_STATE = {
  // Core project state
  currentGraphData: { nodes: [], links: [] },
  selectedProjectPath: null,
  currentState: null,
  selectedNode: null,

  // Tree panel state
  treeData: null,
  treeExpanded: new Set(),

  // View state
  is3D: true,
  activeView: 'graph',  // Current view: 'graph' or 'diagram'

  // Activity feed state
  activityEntries: [],
  activityUnreadCount: 0,

  // Navigation state
  navigationHistory: [],
  navigationIndex: -1,

  // Bookmarks (9 slots)
  bookmarks: new Array(9).fill(null),

  // File inspector state
  inspectorNode: null,

  // Hover/selection state
  highlightedNodeId: null
};

// ============================================================================
// REACTIVITY SYSTEM
// ============================================================================

/**
 * Set of listener functions called when state changes
 * Each listener receives: (property, newValue, oldValue)
 */
const listeners = new Set();

/**
 * Raw state object (wrapped by Proxy)
 */
const rawState = {
  // Core project state
  currentGraphData: { nodes: [], links: [] },
  selectedProjectPath: null,
  currentState: null,
  selectedNode: null,

  // Tree panel state
  treeData: null,
  treeExpanded: new Set(),

  // View state
  is3D: true,
  activeView: 'graph',  // Current view: 'graph' or 'diagram'

  // Activity feed state
  activityEntries: [],
  activityUnreadCount: 0,

  // Navigation state
  navigationHistory: [],
  navigationIndex: -1,

  // Bookmarks (9 slots)
  bookmarks: new Array(9).fill(null),

  // File inspector state
  inspectorNode: null,

  // Hover/selection state
  highlightedNodeId: null
};

/**
 * Proxy-wrapped state object that triggers listeners on changes
 */
const state = new Proxy(rawState, {
  set(target, property, value) {
    const oldValue = target[property];
    target[property] = value;

    // Notify listeners only if value actually changed
    if (oldValue !== value) {
      listeners.forEach(fn => {
        try {
          fn(property, value, oldValue);
        } catch (error) {
          console.error(`Error in state listener for "${property}":`, error);
        }
      });
    }

    return true;
  }
});

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Subscribe to state changes
 *
 * @param {Function} listener - Function called on state changes: (property, newValue, oldValue) => void
 * @returns {Function} Unsubscribe function
 *
 * @example
 * const unsubscribe = subscribe((prop, newVal, oldVal) => {
 *   console.log(`${prop} changed from`, oldVal, 'to', newVal);
 * });
 *
 * // Later...
 * unsubscribe();
 */
function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('Listener must be a function');
  }

  listeners.add(listener);

  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get state value by key (safe getter)
 *
 * @param {string} key - State property name
 * @returns {*} State value
 *
 * @example
 * const path = getState('selectedProjectPath');
 */
function getState(key) {
  return state[key];
}

/**
 * Set state value by key (safe setter with validation)
 *
 * @param {string} key - State property name
 * @param {*} value - New value
 *
 * @example
 * setState('selectedNode', 'planning:/01-foundation/PLAN.md');
 */
function setState(key, value) {
  if (!(key in state)) {
    console.warn(`Setting unknown state property: "${key}"`);
  }

  state[key] = value;
}

/**
 * Initialize state for a new project
 *
 * @param {string} projectPath - Path to the project folder
 *
 * @example
 * initializeState('/home/user/my-project');
 */
function initializeState(projectPath) {
  // Reset to defaults
  state.currentGraphData = { nodes: [], links: [] };
  state.selectedProjectPath = projectPath;
  state.currentState = null;
  state.selectedNode = null;
  state.treeData = null;
  state.treeExpanded = new Set();
  state.is3D = true;

  // Clear activity
  state.activityEntries = [];
  state.activityUnreadCount = 0;

  // Clear navigation
  state.navigationHistory = [];
  state.navigationIndex = -1;

  // Clear bookmarks
  state.bookmarks = new Array(9).fill(null);

  // Clear inspector
  state.inspectorNode = null;
  state.highlightedNodeId = null;
}

/**
 * Reset view-specific state (used when switching views)
 * Clears selection and inspection state without affecting project data
 *
 * @example
 * resetViewState(); // Clear selection before switching to diagram view
 */
function resetViewState() {
  state.selectedNode = null;
  state.highlightedNodeId = null;
  state.inspectorNode = null;
}

/**
 * Get default state object (useful for testing)
 *
 * @returns {Object} Copy of default state values
 */
function getDefaultState() {
  return {
    ...DEFAULT_STATE,
    // Deep copy for objects/arrays
    currentGraphData: { nodes: [], links: [] },
    treeExpanded: new Set(),
    activityEntries: [],
    navigationHistory: [],
    bookmarks: new Array(9).fill(null)
  };
}

// ============================================================================
// HANDLER REGISTRY (breaks circular dependencies between renderers)
// ============================================================================

/**
 * Registry for cross-view handlers to avoid circular imports
 */
const handlers = {
  onDiagramFilesChanged: null,
  highlightNodeInGraph: null,
  openFileInspector: null
};

/**
 * Register a handler for diagram file changes
 * Called by diagram-renderer.js during initialization
 */
function registerDiagramFilesChangedHandler(handler) {
  handlers.onDiagramFilesChanged = handler;
}

/**
 * Call the registered diagram files changed handler
 * Called by graph-renderer.js when routing file changes
 */
function callDiagramFilesChangedHandler(data) {
  if (handlers.onDiagramFilesChanged) {
    handlers.onDiagramFilesChanged(data);
  }
}

/**
 * Register a handler for highlighting nodes in the graph
 * Called by graph-renderer.js during initialization
 */
function registerHighlightNodeHandler(handler) {
  handlers.highlightNodeInGraph = handler;
}

/**
 * Call the registered highlight node handler
 * Called by diagram-renderer.js to highlight nodes in graph view
 */
function callHighlightNodeHandler(nodeId) {
  if (handlers.highlightNodeInGraph) {
    handlers.highlightNodeInGraph(nodeId);
  }
}

/**
 * Register a handler for opening the file inspector
 * Called by graph-renderer.js during initialization
 */
function registerOpenFileInspectorHandler(handler) {
  handlers.openFileInspector = handler;
}

/**
 * Call the registered open file inspector handler
 * Called by diagram-renderer.js to open file inspector
 */
function callOpenFileInspectorHandler(node) {
  if (handlers.openFileInspector) {
    handlers.openFileInspector(node);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  state,
  subscribe,
  getState,
  setState,
  initializeState,
  resetViewState,
  getDefaultState,
  registerDiagramFilesChangedHandler,
  callDiagramFilesChangedHandler,
  registerHighlightNodeHandler,
  callHighlightNodeHandler,
  registerOpenFileInspectorHandler,
  callOpenFileInspectorHandler
};
