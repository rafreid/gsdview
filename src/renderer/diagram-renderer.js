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

// Layout constants
const STAGE_WIDTH = 250;
const STAGE_HEIGHT = 300;
const STAGE_SPACING = 80;
const ARTIFACT_HEIGHT = 50;
const ARTIFACT_SPACING = 10;
const STAGE_HEADER_HEIGHT = 40;

// Color constants
const STATUS_COLORS = {
  done: '#2ECC71',      // Green
  'in-progress': '#F39C12',  // Yellow/Orange
  missing: '#95A5A6'    // Gray
};

const STAGE_COLORS = {
  initialize: '#3498DB',  // Blue
  discuss: '#9B59B6',     // Purple
  plan: '#E74C3C',        // Red
  execute: '#F39C12',     // Orange
  verify: '#2ECC71',      // Green
  complete: '#1ABC9C'     // Teal
};

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
 * Create dagre layout graph
 */
function createLayout(data) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: STAGE_SPACING, ranksep: STAGE_SPACING });
  g.setDefaultEdgeLabel(() => ({}));

  // Add stage nodes
  data.stages.forEach(stage => {
    g.setNode(stage.id, {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      stage: stage
    });
  });

  // Add edges between sequential stages
  for (let i = 0; i < data.stages.length - 1; i++) {
    g.setEdge(data.stages[i].id, data.stages[i + 1].id);
  }

  dagre.layout(g);
  return g;
}

/**
 * Render stage containers with headers and status indicators
 */
function renderStages(g, layout) {
  const stages = layout.nodes().map(id => layout.node(id));

  const stageGroups = g.selectAll('.stage')
    .data(stages)
    .enter()
    .append('g')
    .attr('class', 'stage')
    .attr('transform', d => `translate(${d.x - d.width/2}, ${d.y - d.height/2})`);

  // Stage background rectangle
  stageGroups.append('rect')
    .attr('width', d => d.width)
    .attr('height', d => d.height)
    .attr('fill', '#2C3E50')
    .attr('stroke', d => STAGE_COLORS[d.stage.id] || '#555')
    .attr('stroke-width', 2)
    .attr('rx', 8);

  // Stage header background
  stageGroups.append('rect')
    .attr('width', d => d.width)
    .attr('height', STAGE_HEADER_HEIGHT)
    .attr('fill', d => STAGE_COLORS[d.stage.id] || '#34495E')
    .attr('rx', 8);

  // Stage name text
  stageGroups.append('text')
    .attr('x', d => d.width / 2)
    .attr('y', STAGE_HEADER_HEIGHT / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '16px')
    .attr('font-weight', 'bold')
    .text(d => d.stage.name);

  // Status indicator dot
  stageGroups.append('circle')
    .attr('cx', 20)
    .attr('cy', STAGE_HEADER_HEIGHT / 2)
    .attr('r', 6)
    .attr('fill', d => STATUS_COLORS[d.stage.status] || STATUS_COLORS.missing)
    .attr('stroke', 'white')
    .attr('stroke-width', 2);

  // Add pulsing highlight for current stage
  stageGroups.filter(d => d.stage.isCurrent)
    .append('rect')
    .attr('width', d => d.width)
    .attr('height', d => d.height)
    .attr('fill', 'none')
    .attr('stroke', '#4ECDC4')
    .attr('stroke-width', 3)
    .attr('rx', 8)
    .attr('class', 'current-stage-pulse');

  return stageGroups;
}

/**
 * Render connection lines between stages
 */
function renderConnections(g, layout) {
  const edges = layout.edges().map(e => ({
    source: layout.node(e.v),
    target: layout.node(e.w),
    points: layout.edge(e).points
  }));

  g.selectAll('.connection')
    .data(edges)
    .enter()
    .append('path')
    .attr('class', 'connection')
    .attr('d', d => {
      const sourceX = d.source.x + d.source.width / 2;
      const sourceY = d.source.y;
      const targetX = d.target.x - d.target.width / 2;
      const targetY = d.target.y;
      return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    })
    .attr('fill', 'none')
    .attr('stroke', '#7F8C8D')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5')
    .attr('marker-end', 'url(#arrow)');
}

/**
 * Render pipeline stages
 */
function renderPipeline(g, data) {
  console.log('[DiagramRenderer] Rendering pipeline data:', data);

  // Create arrow marker for connections
  svg.append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#7F8C8D');

  // Create layout
  const layout = createLayout(data);

  // Render connections first (behind stages)
  renderConnections(g, layout);

  // Render stages
  const stageGroups = renderStages(g, layout);

  // Render artifacts (placeholder for Task 2)
  renderArtifacts(stageGroups);

  // Center the diagram
  const graphWidth = layout.graph().width;
  const graphHeight = layout.graph().height;
  const containerWidth = parseInt(svg.style('width'));
  const containerHeight = parseInt(svg.style('height'));

  const offsetX = Math.max((containerWidth - graphWidth) / 2, 50);
  const offsetY = Math.max((containerHeight - graphHeight) / 2, 50);

  g.attr('transform', `translate(${offsetX}, ${offsetY})`);
}

/**
 * Render artifact blocks (stub for Task 2)
 */
function renderArtifacts(stageGroups) {
  // Placeholder - will be implemented in Task 2
}
