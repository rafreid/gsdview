/**
 * View Controller
 *
 * Orchestrates switching between Graph and Diagram views.
 * Manages lifecycle (mount/unmount) to prevent memory leaks.
 */

import { mount as mountGraph, unmount as unmountGraph } from './graph-renderer.js';
import { state, setState } from './state-manager.js';

/**
 * Get the currently active view
 * @returns {'graph' | 'diagram'}
 */
export function getActiveView() {
  return state.activeView;
}

/**
 * Switch to the specified view
 * @param {'graph' | 'diagram'} viewName
 */
export function switchToView(viewName) {
  if (viewName === state.activeView) {
    console.log(`[ViewCtrl] Already on ${viewName} view`);
    return;
  }

  console.log(`[ViewCtrl] Switching from ${state.activeView} to ${viewName}`);

  const graphContainer = document.getElementById('graph-container');
  const diagramContainer = document.getElementById('diagram-container');
  const graphTab = document.getElementById('tab-graph');
  const diagramTab = document.getElementById('tab-diagram');

  if (viewName === 'diagram') {
    // Unmount graph to stop animations and free resources
    unmountGraph();

    // Hide graph, show diagram
    graphContainer.classList.add('hidden');
    diagramContainer.classList.remove('hidden');

    // Update tab states
    graphTab.classList.remove('active');
    diagramTab.classList.add('active');

    // TODO: mountDiagram() in Phase 32
    console.log('[ViewCtrl] Diagram view mounted (placeholder)');

  } else if (viewName === 'graph') {
    // TODO: unmountDiagram() in Phase 32

    // Hide diagram, show graph
    diagramContainer.classList.add('hidden');
    graphContainer.classList.remove('hidden');

    // Update tab states
    diagramTab.classList.remove('active');
    graphTab.classList.add('active');

    // Mount graph to resume animations
    mountGraph();

    console.log('[ViewCtrl] Graph view mounted');
  }

  state.activeView = viewName;
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
