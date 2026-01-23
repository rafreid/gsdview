import ForceGraph3D from '3d-force-graph';

// Color palette by node type (WCAG AA compliant against #1a1a2e background)
const nodeColors = {
  root: '#FF6B6B',       // Coral red - focal point
  phase: '#4ECDC4',      // Teal - major structure
  plan: '#45B7D1',       // Sky blue - work units
  task: '#98D8C8',       // Mint green - granular items
  requirement: '#F7DC6F', // Gold - specifications
  file: '#DDA0DD',       // Plum - source references
  directory: '#BB8FCE'   // Purple - directories
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

// Store selected project path
let selectedProjectPath = null;

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

// Get link color based on source node type
function getLinkColor(link, graphData) {
  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
  if (sourceNode) {
    const baseColor = nodeColors[sourceNode.type] || DEFAULT_NODE_COLOR;
    return baseColor + '66'; // 40% opacity
  }
  return 'rgba(255,255,255,0.2)';
}

// Get link width based on hierarchy level
function getLinkWidth(link, graphData) {
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
    if (node.description) label += `\n${node.description}`;
    if (node.goal) label += `\n${node.goal}`;
    return label;
  })
  .nodeColor(node => nodeColors[node.type] || DEFAULT_NODE_COLOR)
  .nodeVal(node => getNodeSize(node, connectionCounts))
  .linkColor(link => getLinkColor(link, currentGraphData))
  .linkWidth(link => getLinkWidth(link, currentGraphData))
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

// Build graph from parsed project data
function buildGraphFromProject(projectData) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

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
    for (const dirNode of directory.nodes) {
      addNode({
        id: dirNode.id,
        name: dirNode.name,
        type: dirNode.type, // 'directory' or 'file'
        path: dirNode.path,
        extension: dirNode.extension
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

  return { nodes, links };
}

// Update graph with new data
function updateGraph(graphData) {
  currentGraphData = graphData;
  connectionCounts = calculateConnectionCounts(graphData);

  Graph
    .graphData(graphData)
    .nodeVal(node => getNodeSize(node, connectionCounts))
    .linkColor(link => getLinkColor(link, graphData))
    .linkWidth(link => getLinkWidth(link, graphData));

  // Zoom to fit after data update
  setTimeout(() => {
    Graph.zoomToFit(400);
  }, 500);
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

    const graphData = buildGraphFromProject(projectData);
    console.log('Graph built:', graphData.nodes.length, 'nodes,', graphData.links.length, 'links');

    updateGraph(graphData);

    document.getElementById('selected-path').textContent = projectPath;
    selectedProjectPath = projectPath;

  } catch (error) {
    console.error('Error loading project:', error);
    document.getElementById('selected-path').textContent = `Error: ${error.message}`;
  }
}

// Folder selection handler
document.getElementById('select-folder-btn').addEventListener('click', async () => {
  if (window.electronAPI && window.electronAPI.selectFolder) {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      await loadProject(folderPath);
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

console.log('GSD Viewer initialized - select a project folder to visualize');
