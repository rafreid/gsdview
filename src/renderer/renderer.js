import ForceGraph3D from '3d-force-graph';

// Placeholder graph data representing a GSD project structure
const placeholderData = {
  nodes: [
    { id: 'project', name: 'Project', type: 'root' },
    { id: 'phase1', name: 'Phase 1: Foundation', type: 'phase' },
    { id: 'phase2', name: 'Phase 2: Rendering', type: 'phase' },
    { id: 'phase3', name: 'Phase 3: Parsing', type: 'phase' },
    { id: 'plan1-1', name: 'Plan 01-01', type: 'plan' },
    { id: 'plan1-2', name: 'Plan 01-02', type: 'plan' },
    { id: 'plan1-3', name: 'Plan 01-03', type: 'plan' },
    { id: 'plan2-1', name: 'Plan 02-01', type: 'plan' },
    { id: 'req1', name: 'APP-01', type: 'requirement' },
    { id: 'req2', name: 'GRF-01', type: 'requirement' },
    { id: 'req3', name: 'NAV-01', type: 'requirement' }
  ],
  links: [
    { source: 'project', target: 'phase1' },
    { source: 'project', target: 'phase2' },
    { source: 'project', target: 'phase3' },
    { source: 'phase1', target: 'plan1-1' },
    { source: 'phase1', target: 'plan1-2' },
    { source: 'phase1', target: 'plan1-3' },
    { source: 'phase2', target: 'plan2-1' },
    { source: 'req1', target: 'phase1' },
    { source: 'req2', target: 'phase1' },
    { source: 'req3', target: 'phase1' }
  ]
};

// Color palette by node type (WCAG AA compliant against #1a1a2e background)
const nodeColors = {
  root: '#FF6B6B',       // Coral red - focal point
  phase: '#4ECDC4',      // Teal - major structure
  plan: '#45B7D1',       // Sky blue - work units
  task: '#98D8C8',       // Mint green - granular items
  requirement: '#F7DC6F', // Gold - specifications
  file: '#DDA0DD'        // Plum - source references
};

// Default color for unknown types
const DEFAULT_NODE_COLOR = '#888888';

// Calculate connection count for each node
function calculateConnectionCounts(graphData) {
  const counts = {};

  // Initialize all nodes with 0 connections
  graphData.nodes.forEach(node => {
    counts[node.id] = 0;
  });

  // Count connections from links
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
  // Scale: 0 connections = minSize, 6+ connections = maxSize
  const scale = Math.min(connections / 6, 1);
  return minSize + (maxSize - minSize) * scale;
}

const connectionCounts = calculateConnectionCounts(placeholderData);

// Get link color based on source node type (for visual hierarchy)
function getLinkColor(link) {
  const sourceNode = placeholderData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
  if (sourceNode) {
    const baseColor = nodeColors[sourceNode.type] || DEFAULT_NODE_COLOR;
    // Return semi-transparent version of source color
    return baseColor + '66'; // 40% opacity
  }
  return 'rgba(255,255,255,0.2)';
}

// Get link width based on hierarchy level
function getLinkWidth(link) {
  const sourceNode = placeholderData.nodes.find(n => n.id === (typeof link.source === 'object' ? link.source.id : link.source));
  if (sourceNode) {
    // Root connections are thicker, leaf connections are thinner
    if (sourceNode.type === 'root') return 2.5;
    if (sourceNode.type === 'phase') return 2;
    if (sourceNode.type === 'plan') return 1.5;
    return 1;
  }
  return 1;
}

// Initialize 3D force graph
const container = document.getElementById('graph-container');
const Graph = ForceGraph3D()(container)
  .graphData(placeholderData)
  .nodeLabel('name')
  .nodeColor(node => nodeColors[node.type] || DEFAULT_NODE_COLOR)
  .nodeVal(node => getNodeSize(node, connectionCounts))
  .linkColor(link => getLinkColor(link))
  .linkWidth(link => getLinkWidth(link))
  .linkOpacity(0.6)
  .linkDirectionalArrowLength(3.5)
  .linkDirectionalArrowRelPos(1)
  .backgroundColor('#1a1a2e')
  .showNavInfo(false);

// Handle window resize
function handleResize() {
  const toolbar = document.getElementById('toolbar');
  const toolbarHeight = toolbar ? toolbar.offsetHeight : 50;
  Graph.width(window.innerWidth);
  Graph.height(window.innerHeight - toolbarHeight);
}

window.addEventListener('resize', handleResize);
handleResize();

// Store selected project path
let selectedProjectPath = null;

// Folder selection handler
document.getElementById('select-folder-btn').addEventListener('click', async () => {
  if (window.electronAPI && window.electronAPI.selectFolder) {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      selectedProjectPath = folderPath;
      document.getElementById('selected-path').textContent = folderPath;
      console.log('Selected folder:', folderPath);
      // TODO: In later phases, parse .planning/ from this path
    }
  } else {
    console.warn('electronAPI.selectFolder not available');
  }
});

// Populate color legend
function populateColorLegend() {
  const legend = document.getElementById('color-legend');
  if (!legend) return;

  const title = document.createElement('div');
  title.className = 'legend-title';
  title.textContent = 'Node Types';
  legend.appendChild(title);

  // Format type name (capitalize first letter)
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
    legend.appendChild(item);
  }
}

populateColorLegend();

console.log('GSD Viewer initialized with placeholder data');
