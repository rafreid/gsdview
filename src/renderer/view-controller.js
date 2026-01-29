/**
 * View Controller
 *
 * Orchestrates switching between all views: Graph, Diagram, Dashboard, Heatmap, Timeline.
 * Manages lifecycle (mount/unmount) to prevent memory leaks.
 */

import { mount as mountGraph, unmount as unmountGraph } from './graph-renderer.js';
import { mount as mountDiagram, unmount as unmountDiagram } from './diagram-renderer.js';
import { mount as mountDashboard, unmount as unmountDashboard } from './dashboard-renderer.js';
import { mount as mountHeatmap, unmount as unmountHeatmap } from './heatmap-renderer.js';
import { mount as mountTimeline, unmount as unmountTimeline } from './timeline-renderer.js';
import { state, setState } from './state-manager.js';

// All available views
const VIEWS = ['graph', 'diagram', 'dashboard', 'heatmap', 'timeline'];

// View mount/unmount functions
const viewLifecycle = {
  graph: { mount: mountGraph, unmount: unmountGraph },
  diagram: { mount: mountDiagram, unmount: unmountDiagram },
  dashboard: { mount: mountDashboard, unmount: unmountDashboard },
  heatmap: { mount: mountHeatmap, unmount: unmountHeatmap },
  timeline: { mount: mountTimeline, unmount: unmountTimeline }
};

/**
 * Get the currently active view
 * @returns {'graph' | 'diagram' | 'dashboard' | 'heatmap' | 'timeline'}
 */
export function getActiveView() {
  return state.activeView;
}

/**
 * Switch to the specified view
 * @param {'graph' | 'diagram' | 'dashboard' | 'heatmap' | 'timeline'} viewName
 */
export function switchToView(viewName) {
  if (viewName === state.activeView) {
    console.log(`[ViewCtrl] Already on ${viewName} view`);
    return;
  }

  if (!VIEWS.includes(viewName)) {
    console.error(`[ViewCtrl] Unknown view: ${viewName}`);
    return;
  }

  console.log(`[ViewCtrl] Switching from ${state.activeView} to ${viewName}`);

  const previousView = state.activeView;

  // Unmount previous view
  if (previousView && viewLifecycle[previousView]) {
    viewLifecycle[previousView].unmount();
  }

  // Hide all containers and deactivate all tabs
  VIEWS.forEach(view => {
    const container = document.getElementById(`${view}-container`);
    const tab = document.getElementById(`tab-${view}`);

    if (container) container.classList.add('hidden');
    if (tab) tab.classList.remove('active');
  });

  // Show new container and activate tab
  const newContainer = document.getElementById(`${viewName}-container`);
  const newTab = document.getElementById(`tab-${viewName}`);

  if (newContainer) newContainer.classList.remove('hidden');
  if (newTab) newTab.classList.add('active');

  // Mount new view
  if (viewLifecycle[viewName]) {
    viewLifecycle[viewName].mount();
  }

  state.activeView = viewName;
  console.log(`[ViewCtrl] ${viewName} view mounted`);
}

/**
 * Initialize view switching
 * Sets up initial state and tab click handlers
 */
export function initViewSwitching() {
  // Ensure graph is the default active view
  state.activeView = 'graph';

  // Make switchToView available globally for onclick handlers
  window.switchToView = switchToView;

  console.log('[ViewCtrl] View switching initialized, active view: graph');
}

// Auto-initialize when module loads
initViewSwitching();
