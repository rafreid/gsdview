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
import { openFileInspector, formatFileSize, formatRelativeTime } from './graph-renderer.js';

const fs = window.require('fs');
const path = window.require('path');

// SVG container reference
let svg = null;
let pipelineData = null;
let diagramGroup = null;
let currentTransform = { x: 0, y: 0, scale: 1 };

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
  diagramGroup = svg.append('g').attr('class', 'diagram-content');

  // Load and render pipeline data
  if (state.selectedProjectPath) {
    pipelineData = parsePipelineState(state.selectedProjectPath);
    renderPipeline(diagramGroup, pipelineData);
    setupPanZoom();
  } else {
    renderPlaceholder(diagramGroup);
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
  diagramGroup = null;
  currentTransform = { x: 0, y: 0, scale: 1 };

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
 * Get icon for artifact based on file type
 */
function getArtifactIcon(filename) {
  if (filename.includes('CONTEXT')) return '📋';
  if (filename.includes('RESEARCH')) return '🔬';
  if (filename.includes('PLAN')) return '📝';
  if (filename.includes('SUMMARY')) return '✅';
  return '📄';
}

/**
 * Get status symbol for artifact
 */
function getStatusSymbol(status) {
  if (status === 'done') return '✓';
  if (status === 'in-progress') return '◐';
  return '○';
}

/**
 * Truncate artifact name for display
 */
function truncateArtifactName(name, maxLength = 25) {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

/**
 * Render artifact blocks
 */
function renderArtifacts(stageGroups) {
  stageGroups.each(function(d) {
    const stage = d.stage;
    const artifacts = stage.artifacts || [];

    if (artifacts.length === 0) return;

    const group = d3.select(this);
    const contentY = STAGE_HEADER_HEIGHT + ARTIFACT_SPACING;
    const maxArtifacts = Math.floor((STAGE_HEIGHT - STAGE_HEADER_HEIGHT - ARTIFACT_SPACING * 2) / (ARTIFACT_HEIGHT + ARTIFACT_SPACING));

    // Render artifacts (limit to fit in stage)
    const visibleArtifacts = artifacts.slice(0, maxArtifacts);

    const artifactGroups = group.selectAll('.artifact')
      .data(visibleArtifacts)
      .enter()
      .append('g')
      .attr('class', 'artifact')
      .attr('transform', (artifact, i) =>
        `translate(${ARTIFACT_SPACING}, ${contentY + i * (ARTIFACT_HEIGHT + ARTIFACT_SPACING)})`
      )
      .style('cursor', 'pointer')
      .on('click', (event, artifact) => {
        event.stopPropagation();
        // Build node object matching what openFileInspector expects
        const node = {
          id: 'planning:' + artifact.path.replace(/.*\.planning\//, ''),
          name: artifact.name,
          type: 'file',
          path: artifact.path.replace(/.*\.planning\//, ''),
          sourceType: 'planning'
        };
        openFileInspector(node);
      })
      .on('mouseover', (event, artifact) => {
        const tooltip = document.getElementById('diagram-tooltip');
        if (!tooltip) return;

        // Get file stats
        const stats = fs.existsSync(artifact.path) ? fs.statSync(artifact.path) : null;

        const lines = [];
        lines.push(`<strong>${artifact.name}</strong>`);
        if (stats) {
          lines.push(`Size: ${formatFileSize(stats.size)}`);
          lines.push(`Modified: ${formatRelativeTime(stats.mtime.getTime())}`);
        }
        lines.push(`Status: ${artifact.status}`);

        tooltip.innerHTML = lines.join('<br>');
        tooltip.classList.remove('hidden');
        tooltip.classList.add('visible');
      })
      .on('mouseout', () => {
        const tooltip = document.getElementById('diagram-tooltip');
        if (tooltip) {
          tooltip.classList.remove('visible');
          tooltip.classList.add('hidden');
        }
      });

    // Artifact background
    artifactGroups.append('rect')
      .attr('width', STAGE_WIDTH - ARTIFACT_SPACING * 2)
      .attr('height', ARTIFACT_HEIGHT)
      .attr('fill', artifact => {
        const baseColor = STATUS_COLORS[artifact.status] || STATUS_COLORS.missing;
        // Slightly transparent for better visual hierarchy
        return baseColor + '33'; // 20% opacity
      })
      .attr('stroke', artifact => STATUS_COLORS[artifact.status] || STATUS_COLORS.missing)
      .attr('stroke-width', 1)
      .attr('rx', 4);

    // Status indicator bar (left edge)
    artifactGroups.append('rect')
      .attr('width', 4)
      .attr('height', ARTIFACT_HEIGHT)
      .attr('fill', artifact => STATUS_COLORS[artifact.status] || STATUS_COLORS.missing)
      .attr('rx', 4);

    // Artifact icon
    artifactGroups.append('text')
      .attr('x', 15)
      .attr('y', ARTIFACT_HEIGHT / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '18px')
      .text(artifact => getArtifactIcon(artifact.name));

    // Artifact name
    artifactGroups.append('text')
      .attr('x', 30)
      .attr('y', ARTIFACT_HEIGHT / 2 - 6)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text(artifact => truncateArtifactName(artifact.name));

    // Status symbol
    artifactGroups.append('text')
      .attr('x', STAGE_WIDTH - ARTIFACT_SPACING * 2 - 10)
      .attr('y', ARTIFACT_HEIGHT / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', artifact => STATUS_COLORS[artifact.status] || STATUS_COLORS.missing)
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text(artifact => getStatusSymbol(artifact.status));

    // Show artifact count if there are more than fit
    if (artifacts.length > maxArtifacts) {
      group.append('text')
        .attr('x', STAGE_WIDTH / 2)
        .attr('y', STAGE_HEIGHT - 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#95A5A6')
        .attr('font-size', '11px')
        .text(`+${artifacts.length - maxArtifacts} more`);
    }
  });
}

/**
 * Setup pan and zoom interactions
 */
function setupPanZoom() {
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  // Mouse wheel for horizontal scroll
  svg.on('wheel', (event) => {
    event.preventDefault();

    const delta = event.deltaY || event.deltaX;
    currentTransform.x -= delta * 0.5;

    updateTransform();
  });

  // Mouse drag for pan
  svg.on('mousedown', (event) => {
    if (event.button !== 0) return; // Left button only
    isDragging = true;
    dragStart = { x: event.clientX - currentTransform.x, y: event.clientY - currentTransform.y };
    svg.style('cursor', 'grabbing');
  });

  svg.on('mousemove', (event) => {
    // Position tooltip if visible
    const tooltip = document.getElementById('diagram-tooltip');
    if (tooltip && tooltip.classList.contains('visible')) {
      tooltip.style.left = event.clientX + 15 + 'px';
      tooltip.style.top = event.clientY + 15 + 'px';
    }

    // Handle panning
    if (!isDragging) return;
    currentTransform.x = event.clientX - dragStart.x;
    currentTransform.y = event.clientY - dragStart.y;
    updateTransform();
  });

  svg.on('mouseup', () => {
    isDragging = false;
    svg.style('cursor', 'grab');
  });

  svg.on('mouseleave', () => {
    isDragging = false;
    svg.style('cursor', 'default');
  });

  // Set initial cursor
  svg.style('cursor', 'grab');
}

/**
 * Update diagram transform
 */
function updateTransform() {
  diagramGroup.attr('transform', `translate(${currentTransform.x}, ${currentTransform.y})`);
}
