/**
 * Diagram Renderer
 *
 * SVG-based workflow diagram using D3.js and dagre layout.
 * Visualizes GSD pipeline stages with nested artifact blocks.
 */

import * as d3 from 'd3';
import dagre from '@dagrejs/dagre';
import { state, subscribe } from './state-manager.js';
import { parsePipelineState, GSD_STAGES } from './gsd-pipeline-parser.js';

// SVG container reference
let svg = null;
let pipelineData = null;

/**
 * Mount the diagram view
 * Called when switching to diagram view
 */
export function mount() {
  console.log('[DiagramRenderer] Mounting...');

  const container = document.getElementById('diagram-container');
  if (!container) {
    console.error('[DiagramRenderer] diagram-container not found');
    return;
  }

  // Clear placeholder content
  container.innerHTML = '';

  // Create SVG element
  svg = d3.select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('class', 'diagram-svg');

  // Add pan/scroll group
  const g = svg.append('g').attr('class', 'diagram-content');

  // Load and render pipeline data
  if (state.selectedProjectPath) {
    pipelineData = parsePipelineState(state.selectedProjectPath);
    renderPipeline(g, pipelineData);
  } else {
    renderPlaceholder(g);
  }

  console.log('[DiagramRenderer] Mounted');
}

/**
 * Unmount the diagram view
 * Called when switching away from diagram view
 */
export function unmount() {
  console.log('[DiagramRenderer] Unmounting...');

  // Clear SVG reference
  svg = null;
  pipelineData = null;

  console.log('[DiagramRenderer] Unmounted');
}

/**
 * Render placeholder when no project loaded
 */
function renderPlaceholder(g) {
  g.append('text')
    .attr('x', 200)
    .attr('y', 100)
    .attr('fill', '#888')
    .attr('font-size', '18px')
    .text('Open a project to view the GSD workflow diagram');
}

/**
 * Render pipeline stages (stub for Phase 32-02)
 */
function renderPipeline(g, data) {
  console.log('[DiagramRenderer] Rendering pipeline data:', data);

  // Placeholder - will be implemented in 32-02
  g.append('text')
    .attr('x', 50)
    .attr('y', 50)
    .attr('fill', '#4ECDC4')
    .attr('font-size', '24px')
    .text('GSD Workflow Pipeline');

  g.append('text')
    .attr('x', 50)
    .attr('y', 80)
    .attr('fill', '#aaa')
    .attr('font-size', '14px')
    .text(`Current Phase: ${data.currentPhase?.number || 'N/A'} - ${data.currentPhase?.name || 'Unknown'}`);

  g.append('text')
    .attr('x', 50)
    .attr('y', 110)
    .attr('fill', '#aaa')
    .attr('font-size', '14px')
    .text(`Stages: ${data.stages?.length || 0} | Phases: ${data.phases?.length || 0}`);
}
