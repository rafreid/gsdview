/**
 * Diagram Renderer
 *
 * SVG-based workflow diagram using D3.js and dagre layout.
 * Visualizes GSD pipeline stages with nested artifact blocks.
 */

import * as d3 from 'd3';
import dagre from '@dagrejs/dagre';
import { state, subscribe, registerDiagramFilesChangedHandler, callHighlightNodeHandler, callOpenFileInspectorHandler } from './state-manager.js';
import { parsePipelineState, GSD_STAGES } from './gsd-pipeline-parser.js';
import { formatFileSize, formatRelativeTime } from './shared-utils.js';

const fs = window.require('fs');
const path = window.require('path');

// SVG container reference
let svg = null;
let pipelineData = null;
let diagramGroup = null;
let currentTransform = { x: 0, y: 0, scale: 1 };

// State subscription
let selectionUnsubscribe = null;

// Collapsed stages tracking
const collapsedStages = new Set();

// Debounce timer for file changes
let fileChangeDebounceTimer = null;
const FILE_CHANGE_DEBOUNCE_MS = 300;

// Track changed artifact for flash animation
let lastChangedArtifact = null;
let lastChangeType = null;

// Window resize handler
let resizeHandler = null;

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

    // Flash any artifacts that changed while diagram was unmounted
    if (lastChangedArtifact && lastChangeType) {
      setTimeout(() => {
        flashArtifact(lastChangedArtifact, lastChangeType);
        // Clear after flashing so we don't flash again on next mount
        lastChangedArtifact = null;
        lastChangeType = null;
      }, 100);
    }
  } else {
    renderPlaceholder(diagramGroup);
  }

  // Subscribe to selection changes from graph view
  selectionUnsubscribe = subscribe((property, newValue, oldValue) => {
    if (property === 'selectedNode') {
      highlightArtifactInDiagram(newValue);
    }
  });

  // Register keyboard handler for bookmark navigation
  document.addEventListener('keydown', handleDiagramKeydown);

  // Register window resize handler for responsive layout
  resizeHandler = () => {
    if (!diagramGroup || !pipelineData) return;

    // Re-center diagram on resize
    recenterDiagram();
  };
  window.addEventListener('resize', resizeHandler);

  console.log('[DiagramRenderer] Mounted');
}

/**
 * Unmount the diagram view
 * Called when switching away from diagram view
 */
export function unmount() {
  console.log('[DiagramRenderer] Unmounting...');

  // Unsubscribe from selection changes
  if (selectionUnsubscribe) {
    selectionUnsubscribe();
    selectionUnsubscribe = null;
  }

  // Remove keyboard handler
  document.removeEventListener('keydown', handleDiagramKeydown);

  // Remove resize handler
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

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
 * Get color for context usage bar based on percentage
 */
function getContextBarColor(contextUsage) {
  if (contextUsage <= 30) {
    return '#2ECC71'; // Green - healthy
  } else if (contextUsage <= 50) {
    return '#F1C40F'; // Yellow - normal
  } else if (contextUsage <= 70) {
    return '#F39C12'; // Orange - warning
  } else {
    return '#E74C3C'; // Red - danger zone
  }
}

/**
 * Render context usage bar below stage header
 */
function renderContextBar(stageGroup, contextUsage) {
  const barY = STAGE_HEADER_HEIGHT + 5;
  const barHeight = 14;  // Taller bar for better visibility
  const barPadding = 10;
  const barWidth = STAGE_WIDTH - (barPadding * 2);

  // Create context bar group
  const contextBarGroup = stageGroup.append('g')
    .attr('class', 'context-bar')
    .attr('transform', `translate(${barPadding}, ${barY})`);

  // Background rect (full width)
  contextBarGroup.append('rect')
    .attr('width', barWidth)
    .attr('height', barHeight)
    .attr('fill', '#2a2a3e')
    .attr('rx', 3)
    .attr('stroke', '#444')
    .attr('stroke-width', 1);

  // Foreground rect (percentage filled)
  const fillWidth = Math.max((contextUsage / 100) * barWidth, 2);  // Min 2px for visibility
  const barColor = getContextBarColor(contextUsage);

  contextBarGroup.append('rect')
    .attr('width', fillWidth)
    .attr('height', barHeight)
    .attr('fill', barColor)
    .attr('rx', 3);

  // Percentage text label (centered in bar)
  contextBarGroup.append('text')
    .attr('x', barWidth / 2)
    .attr('y', barHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', '11px')
    .attr('font-weight', 'bold')
    .attr('text-shadow', '0 1px 2px rgba(0,0,0,0.8)')
    .text(`Context: ${contextUsage}%`);

  // Add tooltip on hover
  contextBarGroup.append('title')
    .text(`Context Usage: ${contextUsage}%`);
}

/**
 * Get color for agent type
 */
function getAgentColor(agentType) {
  const colors = {
    researcher: '#9B59B6',    // Purple
    executor: '#F39C12',      // Orange
    discusser: '#3498DB'      // Blue
  };
  return colors[agentType] || '#95A5A6';
}

/**
 * Render parallel agent lanes below context bar
 */
function renderAgentLanes(stageGroup, parallelAgents) {
  // Only render if there are multiple agents
  if (!parallelAgents || parallelAgents.length <= 1) return;

  const laneY = STAGE_HEADER_HEIGHT + 5 + 14 + 5; // After header + context bar (14px bar)
  const laneHeight = 24;
  const lanePadding = 10;
  const laneWidth = STAGE_WIDTH - (lanePadding * 2);

  // Create agent lanes group
  const agentLanesGroup = stageGroup.append('g')
    .attr('class', 'agent-lanes')
    .attr('transform', `translate(${lanePadding}, ${laneY})`);

  // Calculate width per agent
  const agentWidth = laneWidth / parallelAgents.length;

  // Render each agent lane
  parallelAgents.forEach((agent, index) => {
    const agentX = index * agentWidth;
    const agentColor = getAgentColor(agent.type);

    // Agent lane group
    const agentGroup = agentLanesGroup.append('g')
      .attr('class', 'agent-lane')
      .attr('transform', `translate(${agentX}, 0)`);

    // Background rect
    agentGroup.append('rect')
      .attr('width', agentWidth - 2)
      .attr('height', laneHeight)
      .attr('fill', agentColor + '22') // 13% opacity
      .attr('stroke', agentColor)
      .attr('stroke-width', 1)
      .attr('rx', 3);

    // Agent icon
    agentGroup.append('text')
      .attr('x', 8)
      .attr('y', laneHeight / 2)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .text(agent.icon || '👤');

    // Agent label
    agentGroup.append('text')
      .attr('x', 28)
      .attr('y', laneHeight / 2)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ccc')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(agent.label);

    // Tooltip
    agentGroup.append('title')
      .text(`${agent.label} (parallel work)`);
  });
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

  // Stage header background (clickable for collapse/expand)
  stageGroups.append('rect')
    .attr('width', d => d.width)
    .attr('height', STAGE_HEADER_HEIGHT)
    .attr('fill', d => STAGE_COLORS[d.stage.id] || '#34495E')
    .attr('rx', 8)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      toggleStageCollapse(d.stage.id);
    });

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

  // Collapse indicator (chevron)
  stageGroups.append('text')
    .attr('class', 'collapse-indicator')
    .attr('x', d => d.width - 20)
    .attr('y', STAGE_HEADER_HEIGHT / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '14px')
    .text(d => collapsedStages.has(d.stage.id) ? '+' : '-');

  // Render context usage bars
  stageGroups.each(function(d) {
    const group = d3.select(this);
    const contextUsage = d.stage.contextUsage || 0;
    renderContextBar(group, contextUsage);
  });

  // Render parallel agent lanes
  stageGroups.each(function(d) {
    const group = d3.select(this);
    const parallelAgents = d.stage.parallelAgents || [];
    renderAgentLanes(group, parallelAgents);
  });

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
 * Recenter diagram in viewport
 * Called on window resize or panel toggle
 */
function recenterDiagram() {
  if (!svg || !diagramGroup) return;

  const container = document.getElementById('diagram-container');
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Get current diagram bounds
  const bbox = diagramGroup.node().getBBox();
  const graphWidth = bbox.width;
  const graphHeight = bbox.height;

  const offsetX = Math.max((containerWidth - graphWidth) / 2, 50);
  const offsetY = Math.max((containerHeight - graphHeight) / 2, 50);

  // Update current transform for consistency with pan/zoom
  currentTransform.x = offsetX;
  currentTransform.y = offsetY;

  // Apply transform with smooth transition
  diagramGroup.transition()
    .duration(300)
    .ease(d3.easeCubicInOut)
    .attr('transform', `translate(${offsetX}, ${offsetY})`);
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

  // Render artifacts
  renderArtifacts(stageGroups);

  // Center the diagram
  const graphWidth = layout.graph().width;
  const graphHeight = layout.graph().height;
  const containerWidth = parseInt(svg.style('width'));
  const containerHeight = parseInt(svg.style('height'));

  const offsetX = Math.max((containerWidth - graphWidth) / 2, 50);
  const offsetY = Math.max((containerHeight - graphHeight) / 2, 50);

  // Update currentTransform
  currentTransform.x = offsetX;
  currentTransform.y = offsetY;

  g.attr('transform', `translate(${offsetX}, ${offsetY})`);
}

/**
 * Get icon for artifact based on file type
 */
function getArtifactIcon(filename) {
  // Planning file types
  if (filename.includes('CONTEXT')) return '📋';
  if (filename.includes('RESEARCH')) return '🔬';
  if (filename.includes('PLAN')) return '📝';
  if (filename.includes('SUMMARY')) return '✅';

  // Source code file types
  if (filename.endsWith('.js')) return '📜';
  if (filename.endsWith('.ts')) return '📘';
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return '⚛️';
  if (filename.endsWith('.html')) return '🌐';
  if (filename.endsWith('.css') || filename.endsWith('.scss')) return '🎨';
  if (filename.endsWith('.json')) return '📋';
  if (filename.endsWith('.md')) return '📝';
  if (filename.endsWith('.py')) return '🐍';
  if (filename.endsWith('.java')) return '☕';
  if (filename.endsWith('.cpp') || filename.endsWith('.c')) return '⚙️';

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
 * Render commit markers on SUMMARY artifacts
 */
function renderCommitMarkers(artifactGroup, commits) {
  if (!commits || commits.length === 0) return;

  // Position markers on the right side
  const markerX = STAGE_WIDTH - ARTIFACT_SPACING * 2 - 30;
  const markerY = ARTIFACT_HEIGHT / 2;

  // Commit marker group
  const markerGroup = artifactGroup.append('g')
    .attr('class', 'commit-markers')
    .attr('transform', `translate(${markerX}, ${markerY})`);

  // Green checkmark icon
  markerGroup.append('circle')
    .attr('r', 8)
    .attr('fill', '#2ECC71')
    .attr('stroke', '#27AE60')
    .attr('stroke-width', 1.5);

  markerGroup.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '10px')
    .attr('font-weight', 'bold')
    .text('✓');

  // Badge for commit count if multiple commits
  if (commits.length > 1) {
    markerGroup.append('circle')
      .attr('cx', 6)
      .attr('cy', -6)
      .attr('r', 6)
      .attr('fill', '#E74C3C')
      .attr('stroke', '#C0392B')
      .attr('stroke-width', 1);

    markerGroup.append('text')
      .attr('x', 6)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .text(commits.length);
  }

  // Add tooltip with commit details
  const tooltipText = commits.length === 1
    ? `Commit: ${commits[0].hash}\n${commits[0].description}`
    : `${commits.length} commits:\n${commits.map(c => `• ${c.hash}: ${c.description}`).join('\n')}`;

  markerGroup.append('title')
    .text(tooltipText);
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
    // Adjust contentY to account for context bar (STAGE_HEADER_HEIGHT + 5px margin + 14px bar + 5px margin)
    const contextBarHeight = 24; // 5 + 14 + 5

    // Account for agent lanes if present (24px height + 5px margin)
    const parallelAgents = stage.parallelAgents || [];
    const agentLanesHeight = (parallelAgents.length > 1) ? 24 + 5 : 0;

    const contentY = STAGE_HEADER_HEIGHT + contextBarHeight + agentLanesHeight + ARTIFACT_SPACING;
    const maxArtifacts = Math.floor((STAGE_HEIGHT - STAGE_HEADER_HEIGHT - contextBarHeight - agentLanesHeight - ARTIFACT_SPACING * 2) / (ARTIFACT_HEIGHT + ARTIFACT_SPACING));

    // Render artifacts (limit to fit in stage)
    const visibleArtifacts = artifacts.slice(0, maxArtifacts);
    const isCollapsed = collapsedStages.has(stage.id);

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

        // Determine sourceType and build appropriate node ID
        let nodeId, relativePath, sourceType;

        if (artifact.relativePath) {
          // New format with relativePath (from collectAllProjectFiles)
          relativePath = artifact.relativePath;
          sourceType = artifact.sourceType || 'planning';
          nodeId = `${sourceType}:${relativePath}`;
        } else {
          // Old format (from phase artifacts)
          sourceType = 'planning';
          relativePath = artifact.path.replace(/.*\.planning\//, '');
          nodeId = `planning:${relativePath}`;
        }

        // Build node object matching what openFileInspector expects
        const node = {
          id: nodeId,
          name: artifact.name,
          type: 'file',
          path: relativePath,
          sourceType: sourceType
        };

        // Set selection state (triggers cross-view sync)
        state.selectedNode = node;

        // Update visual selection in diagram
        updateArtifactSelection();

        // Highlight in graph view (for when user switches back)
        callHighlightNodeHandler(nodeId);

        // Open file inspector
        callOpenFileInspectorHandler(node);
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

    // Apply collapsed state if stage is collapsed
    if (isCollapsed) {
      artifactGroups.style('opacity', 0).style('pointer-events', 'none');
    }

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

    // Render commit markers for SUMMARY artifacts with commits
    artifactGroups.each(function(artifact) {
      if (artifact.commits && artifact.commits.length > 0) {
        const artifactGroup = d3.select(this);
        renderCommitMarkers(artifactGroup, artifact.commits);
      }
    });

    // Show artifact count if there are more than fit
    if (artifacts.length > maxArtifacts) {
      group.append('text')
        .attr('x', STAGE_WIDTH / 2)
        .attr('y', STAGE_HEIGHT - 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#95A5A6')
        .attr('font-size', '11px')
        .text(`+${artifacts.length - maxArtifacts} more`)
        .style('opacity', isCollapsed ? 0 : 1);
    }
  });
}

/**
 * Update artifact selection styling in diagram
 */
function updateArtifactSelection() {
  if (!diagramGroup) return;

  const selectedNodeId = state.selectedNode?.id;

  // Update all artifact groups with selection class
  diagramGroup.selectAll('.artifact').each(function(d) {
    let artifactNodeId;

    if (d.relativePath) {
      // New format with relativePath
      const sourceType = d.sourceType || 'planning';
      artifactNodeId = `${sourceType}:${d.relativePath}`;
    } else {
      // Old format (planning files only)
      const artifactPath = d.path.replace(/.*\.planning\//, '');
      artifactNodeId = 'planning:' + artifactPath;
    }

    const isSelected = selectedNodeId === artifactNodeId;

    const group = d3.select(this);
    group.classed('selected', isSelected);

    // Update stroke on the background rect
    const rect = group.select('rect:first-of-type');
    if (isSelected) {
      rect.attr('stroke', '#4ECDC4')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 0 4px rgba(78, 205, 196, 0.5))');
    } else {
      // Restore original stroke
      const originalStroke = STATUS_COLORS[d.status] || STATUS_COLORS.missing;
      rect.attr('stroke', originalStroke)
          .attr('stroke-width', 1)
          .style('filter', null);
    }
  });
}

/**
 * Highlight artifact in diagram based on selected node
 * Called when selection changes in graph view
 */
function highlightArtifactInDiagram(node) {
  if (!diagramGroup) return;

  // Clear previous selection highlight
  diagramGroup.selectAll('.artifact').classed('selected', false);
  diagramGroup.selectAll('.artifact rect:first-of-type').each(function(d) {
    const rect = d3.select(this);
    const originalStroke = STATUS_COLORS[d.status] || STATUS_COLORS.missing;
    rect.attr('stroke', originalStroke)
        .attr('stroke-width', 1)
        .style('filter', null);
  });

  if (!node) return;

  // Extract path from node ID (format: 'planning:/phases/XX-name/file.md' or 'src:/path/to/file.js')
  const nodeId = node?.id || node;
  if (!nodeId) return;

  // Handle both planning: and src: prefixes
  let relativePath, sourceType;
  if (nodeId.startsWith('planning:')) {
    relativePath = nodeId.replace('planning:', '');
    sourceType = 'planning';
  } else if (nodeId.startsWith('src:')) {
    relativePath = nodeId.replace('src:', '');
    sourceType = 'src';
  } else {
    return; // Unknown prefix
  }

  // Find matching artifact and highlight
  let foundArtifact = null;
  diagramGroup.selectAll('.artifact').each(function(d) {
    let matches = false;

    if (d.relativePath) {
      // New format - compare relativePath and sourceType
      matches = (d.relativePath === relativePath || d.relativePath.includes(relativePath)) &&
                (d.sourceType === sourceType);
    } else {
      // Old format - only planning files
      const artifactPath = d.path.replace(/.*\.planning\//, '');
      matches = (artifactPath === relativePath || d.path.includes(relativePath)) &&
                sourceType === 'planning';
    }

    if (matches) {
      const group = d3.select(this);
      group.classed('selected', true);

      // Update stroke
      const rect = group.select('rect:first-of-type');
      rect.attr('stroke', '#4ECDC4')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 0 4px rgba(78, 205, 196, 0.5))');

      foundArtifact = this;
    }
  });

  // Scroll to make artifact visible
  if (foundArtifact) {
    scrollArtifactIntoView(foundArtifact);
  }
}

/**
 * Scroll artifact into view with smooth pan
 */
function scrollArtifactIntoView(artifactElement) {
  if (!artifactElement) return;

  // Get artifact position
  const artifactGroup = d3.select(artifactElement);
  const transform = artifactGroup.attr('transform');

  // Parse transform to get position
  const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!match) return;

  const artifactX = parseFloat(match[1]);
  const artifactY = parseFloat(match[2]);

  // Get parent stage position
  const stageGroup = d3.select(artifactElement.parentNode);
  const stageTransform = stageGroup.attr('transform');
  const stageMatch = stageTransform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
  if (!stageMatch) return;

  const stageX = parseFloat(stageMatch[1]);
  const stageY = parseFloat(stageMatch[2]);

  // Calculate absolute position
  const targetX = stageX + artifactX;
  const targetY = stageY + artifactY;

  // Get container dimensions
  const container = document.getElementById('diagram-container');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Pan to center artifact (adjust currentTransform)
  currentTransform.x = containerWidth / 2 - targetX - STAGE_WIDTH / 2;
  currentTransform.y = containerHeight / 2 - targetY - ARTIFACT_HEIGHT / 2;

  updateTransform();
}

/**
 * Handle keyboard events for diagram view
 */
function handleDiagramKeydown(e) {
  // Only handle in diagram view
  if (state.activeView !== 'diagram') return;

  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Handle 1-9 for bookmark navigation
  const key = parseInt(e.key);
  if (key >= 1 && key <= 9) {
    const slot = key - 1;
    const bookmark = state.bookmarks[slot];

    if (bookmark) {
      console.log('[Diagram] Jump to bookmark', slot + 1, bookmark);

      // If bookmark has a nodeId, find the phase and scroll to it
      if (bookmark.nodeId) {
        navigateToBookmarkedPhase(bookmark);
      } else if (bookmark.cameraPosition) {
        // For camera-only bookmarks, just show toast
        showToast(`Bookmark ${slot + 1}: No artifact selected`, 'info');
      }
    } else {
      showToast(`Bookmark ${slot + 1} is empty`, 'info');
    }
  }
}

/**
 * Navigate to bookmarked phase in diagram
 */
function navigateToBookmarkedPhase(bookmark) {
  const nodeId = bookmark.nodeId;

  // Parse phase number from node ID (format: 'planning:/phases/XX-name/...')
  const match = nodeId.match(/phases\/(\d+)-/);
  if (!match) {
    showToast('Bookmark not in a phase', 'warning');
    return;
  }

  const phaseNumber = parseInt(match[1], 10);

  // Find the stage containing this phase
  if (!pipelineData || !pipelineData.phases) {
    showToast('Pipeline data not loaded', 'warning');
    return;
  }

  const phase = pipelineData.phases.find(p => p.number === phaseNumber);
  if (!phase) {
    showToast(`Phase ${phaseNumber} not found in diagram`, 'warning');
    return;
  }

  // Find stage index for this phase
  const stageIndex = GSD_STAGES.findIndex(s => s.id === phase.stage);

  // Calculate target X position (stages are laid out horizontally)
  const targetX = stageIndex * (STAGE_WIDTH + STAGE_SPACING);

  // Get container width for centering
  const container = document.getElementById('diagram-container');
  const containerWidth = container.clientWidth;

  // Pan to center on stage
  const newX = containerWidth / 2 - targetX - STAGE_WIDTH / 2;

  // Animate the pan
  animatePanTo(newX, currentTransform.y);

  // Highlight the artifact
  highlightArtifactInDiagram({ id: nodeId });

  showToast(`Jumped to Phase ${phaseNumber}`, 'success');
}

/**
 * Animate smooth pan to target position
 */
function animatePanTo(targetX, targetY) {
  const startX = currentTransform.x;
  const startY = currentTransform.y;
  const duration = 500; // ms
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out curve
    const eased = 1 - Math.pow(1 - progress, 3);

    currentTransform.x = startX + (targetX - startX) * eased;
    currentTransform.y = startY + (targetY - startY) * eased;

    updateTransform();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create and show new toast
  const toast = document.createElement('div');
  toast.className = `toast ${type} visible`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
 * Toggle stage collapse/expand
 */
function toggleStageCollapse(stageId) {
  if (collapsedStages.has(stageId)) {
    collapsedStages.delete(stageId);
  } else {
    collapsedStages.add(stageId);
  }

  // Re-render to reflect collapsed state
  // Find stage group and update artifact visibility
  diagramGroup.selectAll('.stage').each(function(d) {
    if (d.stage.id === stageId) {
      const group = d3.select(this);
      const artifacts = group.selectAll('.artifact');
      const moreText = group.selectAll('text').filter(function() {
        return this.textContent.includes('+') && this.textContent.includes('more');
      });

      if (collapsedStages.has(stageId)) {
        artifacts.style('opacity', 0).style('pointer-events', 'none');
        moreText.style('opacity', 0);
      } else {
        artifacts.style('opacity', 1).style('pointer-events', 'auto');
        moreText.style('opacity', 1);
      }

      // Update indicator
      group.select('.collapse-indicator').text(collapsedStages.has(stageId) ? '+' : '-');
    }
  });
}

/**
 * Update diagram transform
 */
function updateTransform() {
  diagramGroup.attr('transform', `translate(${currentTransform.x}, ${currentTransform.y})`);
}

/**
 * Flash artifact with type-appropriate animation
 * @param {string} artifactPath - Path to the artifact file
 * @param {string} changeType - Type of change (add, change, unlink)
 */
function flashArtifact(artifactPath, changeType) {
  if (!diagramGroup) return;

  console.log('[DiagramRenderer] Flashing artifact:', artifactPath, changeType);

  // Map chokidar events to animation types
  let flashClass = 'flashing-modified';
  if (changeType === 'add') {
    flashClass = 'flashing-created';
  } else if (changeType === 'unlink') {
    flashClass = 'flashing-deleted';
  }

  // Extract relative path from full path - handle both .planning/ and src/
  let relativePath = artifactPath;
  if (artifactPath.includes('.planning/')) {
    relativePath = artifactPath.replace(/.*\.planning\//, '.planning/');
  } else if (artifactPath.includes('src/')) {
    relativePath = artifactPath.replace(/.*src\//, 'src/');
  }

  // Find matching artifact group(s) by path
  diagramGroup.selectAll('.artifact').each(function(d) {
    let artifactRelPath = d.path;

    // Handle both old format (path only) and new format (relativePath property)
    if (d.relativePath) {
      artifactRelPath = d.relativePath;
    } else if (d.path.includes('.planning/')) {
      artifactRelPath = d.path.replace(/.*\.planning\//, '.planning/');
    } else if (d.path.includes('src/')) {
      artifactRelPath = d.path.replace(/.*src\//, 'src/');
    }

    // Check if paths match (exact match or substring match)
    if (artifactRelPath === relativePath ||
        d.path === artifactPath ||
        d.path.includes(relativePath) ||
        relativePath.includes(artifactRelPath)) {
      const group = d3.select(this);

      // Remove any existing flash classes
      group.classed('flashing-created', false)
           .classed('flashing-modified', false)
           .classed('flashing-deleted', false);

      // Add new flash class
      group.classed(flashClass, true);

      // Get flash duration from CSS variable or use default
      const flashDuration = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--flash-duration') || '2000'
      );

      // Remove flash class after animation completes
      setTimeout(() => {
        group.classed(flashClass, false);
      }, flashDuration);

      console.log('[DiagramRenderer] Applied flash class:', flashClass, 'to artifact:', d.name);
    }
  });
}

/**
 * Handle file changes when diagram view is active
 * Called from graph-renderer.js file change listener
 */
export function onFilesChanged(data) {
  console.log('[DiagramRenderer] File changed:', data.event, data.path, 'sourceType:', data.sourceType);

  // Now we handle BOTH planning and src file changes (since diagram shows all files)
  // Store changed artifact info for flash animation
  lastChangedArtifact = data.path;
  lastChangeType = data.event;

  // Debounce re-render to prevent rapid updates during burst changes
  if (fileChangeDebounceTimer) {
    clearTimeout(fileChangeDebounceTimer);
  }

  fileChangeDebounceTimer = setTimeout(() => {
    console.log('[DiagramRenderer] Applying debounced update');

    // Re-parse pipeline data to get latest state
    if (state.selectedProjectPath) {
      pipelineData = parsePipelineState(state.selectedProjectPath);

      // Clear existing diagram
      if (diagramGroup) {
        diagramGroup.selectAll('*').remove();
      }

      // Re-render with fresh data
      renderPipeline(diagramGroup, pipelineData);

      // Apply transform to maintain current pan position
      updateTransform();

      // Flash the changed artifact after render completes
      if (lastChangedArtifact && lastChangeType) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          flashArtifact(lastChangedArtifact, lastChangeType);
          // Clear after flashing so we don't flash again on next mount
          lastChangedArtifact = null;
          lastChangeType = null;
        }, 50);
      }
    }

    fileChangeDebounceTimer = null;
  }, FILE_CHANGE_DEBOUNCE_MS);
}

// Register handler with state-manager to break circular dependency
registerDiagramFilesChangedHandler(onFilesChanged);
