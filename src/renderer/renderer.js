import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';

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
let currentGraphData = {
  nodes: [
    { id: 'placeholder', name: 'Select a project folder', type: 'root' }
  ],
  links: []
};

// Store selected project path and state
let selectedProjectPath = null;
let currentState = null;
let selectedNode = null;

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

// Get node color based on type and status
function getNodeColor(node) {
  // For phases, plans, tasks, requirements - use status colors if available
  const statusTypes = ['phase', 'plan', 'task', 'requirement'];
  if (statusTypes.includes(node.type) && node.status) {
    // Check if this is the current active phase
    if (node.type === 'phase' && currentState && currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === currentState.currentPhase && node.status !== 'complete') {
        return statusColors['in-progress'];
      }
    }
    return statusColors[node.status] || nodeColors[node.type] || DEFAULT_NODE_COLOR;
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
    return baseColor + '66'; // 40% opacity
  }
  return 'rgba(255,255,255,0.2)';
}

// Get link width based on hierarchy level and type
function getLinkWidth(link, graphData) {
  // Blocked links are thicker for visibility
  if (link.type === 'blocked') {
    return 3;
  }

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
    if (node.status) label += ` [${node.status}]`;
    if (node.description) label += `\n${node.description}`;
    if (node.goal) label += `\n${node.goal}`;
    return label;
  })
  .nodeColor(node => getNodeColor(node))
  .nodeVal(node => getNodeSize(node, connectionCounts))
  .nodeThreeObject(node => {
    // Create custom geometry for current phase (glow effect)
    if (node.type === 'phase' && currentState && currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === currentState.currentPhase && node.status !== 'complete') {
        // Create glowing sphere for current phase
        const size = getNodeSize(node, connectionCounts);
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
    return false; // Use default sphere
  })
  .linkColor(link => getLinkColor(link, currentGraphData))
  .linkWidth(link => getLinkWidth(link, currentGraphData))
  .linkOpacity(0.6)
  .linkDirectionalArrowLength(3.5)
  .linkDirectionalArrowRelPos(1)
  .linkLineDash(link => link.type === 'blocked' ? [2, 2] : null)
  .backgroundColor('#1a1a2e')
  .showNavInfo(false)
  // Click-to-fly navigation
  .onNodeClick(node => {
    // Calculate distance based on node size for optimal viewing
    const distance = 50 + getNodeSize(node, connectionCounts) * 4;

    // Animate camera to node position
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

    // Show details panel
    showDetailsPanel(node);
  })
  // Hover tooltips
  .onNodeHover(node => {
    const tooltip = document.getElementById('tooltip');
    if (node) {
      let content = `<strong>${node.name}</strong><br>`;
      content += `<span style="color: ${getNodeColor(node)}; text-transform: capitalize;">Type: ${node.type}</span>`;
      if (node.status) {
        const statusColor = statusColors[node.status] || '#888';
        content += `<br><span style="color: ${statusColor}">Status: ${node.status}</span>`;
      }
      if (node.category) content += `<br>Category: ${node.category}`;
      tooltip.innerHTML = content;
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

  // Store state for coloring
  if (projectData.state) {
    currentState = projectData.state;
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

  // Add blocker links if any
  const { state } = projectData;
  if (state && state.blockers && state.blockers.length > 0) {
    for (const blocker of state.blockers) {
      // Add blocker as a node
      const blockerNode = addNode({
        id: blocker.id,
        name: `Blocker: ${blocker.description.substring(0, 30)}...`,
        type: 'blocker',
        status: 'blocked',
        description: blocker.description
      });

      // Link blocker to current phase
      if (state.currentPhase) {
        const currentPhaseId = `phase-${state.currentPhase}`;
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
  currentGraphData = graphData;
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

    // Start file watching
    if (window.electronAPI && window.electronAPI.startWatching) {
      await window.electronAPI.startWatching(projectPath);
    }

    // Add to recent projects
    if (window.electronAPI && window.electronAPI.addRecentProject) {
      await window.electronAPI.addRecentProject(projectPath);
      updateRecentProjects();
    }

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

// Populate color legend with both type and status colors
function populateColorLegend() {
  const legend = document.getElementById('color-legend');
  if (!legend) return;

  // Node types section
  const typeTitle = document.createElement('div');
  typeTitle.className = 'legend-title';
  typeTitle.textContent = 'Node Types';
  legend.appendChild(typeTitle);

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

  // Status section
  const statusTitle = document.createElement('div');
  statusTitle.className = 'legend-title';
  statusTitle.style.marginTop = '12px';
  statusTitle.textContent = 'Status';
  legend.appendChild(statusTitle);

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
    legend.appendChild(item);
  }
}

populateColorLegend();

// Track mouse for tooltip positioning
container.addEventListener('mousemove', (e) => {
  const tooltip = document.getElementById('tooltip');
  tooltip.style.left = e.clientX + 15 + 'px';
  tooltip.style.top = e.clientY + 15 + 'px';
});

// Details panel functions
function showDetailsPanel(node) {
  selectedNode = node;
  const panel = document.getElementById('details-panel');
  const title = document.getElementById('panel-title');
  const content = document.getElementById('panel-content');

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
    html += `<p><strong>Extension:</strong> ${node.extension}</p>`;
  }

  // Add open button for nodes with file paths
  const filePath = node.path || node.file;
  if (filePath && selectedProjectPath) {
    html += `<button id="open-file-btn" class="panel-btn">Open in Editor</button>`;
  }

  content.innerHTML = html;

  // Add click handler for open button
  const openBtn = document.getElementById('open-file-btn');
  if (openBtn) {
    openBtn.addEventListener('click', async () => {
      let fullPath;
      if (node.path) {
        // Directory/file node - path is relative to .planning
        fullPath = `${selectedProjectPath}/.planning/${node.path}`;
      } else if (node.file) {
        // Plan node - file is in phases directory
        const phaseMatch = node.id.match(/plan-phase-(\d+)/);
        if (phaseMatch) {
          const phaseNum = phaseMatch[1].padStart(2, '0');
          fullPath = `${selectedProjectPath}/.planning/phases/${phaseNum}-*/`;
          // For now, just try to open the plan file directly
          fullPath = `${selectedProjectPath}/.planning/phases/${node.file}`;
        } else {
          fullPath = `${selectedProjectPath}/.planning/${node.file}`;
        }
      }

      if (fullPath && window.electronAPI && window.electronAPI.openFile) {
        const result = await window.electronAPI.openFile(fullPath);
        if (result.error) {
          console.error('Error opening file:', result.error);
        }
      }
    });
  }

  panel.classList.remove('hidden');
  panel.classList.add('visible');
}

function hideDetailsPanel() {
  const panel = document.getElementById('details-panel');
  panel.classList.remove('visible');
  panel.classList.add('hidden');
  selectedNode = null;
}

// Close panel button handler
document.getElementById('close-panel').addEventListener('click', hideDetailsPanel);

// Close panel when clicking on background (optional - ESC key)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideDetailsPanel();
  }
});

// Refresh button handler
document.getElementById('refresh-btn').addEventListener('click', async () => {
  if (selectedProjectPath) {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    showRefreshIndicator();
    await loadProject(selectedProjectPath);
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
document.getElementById('recent-projects').addEventListener('change', async (e) => {
  const projectPath = e.target.value;
  if (projectPath) {
    await loadProject(projectPath);
    e.target.value = ''; // Reset dropdown
  }
});

// Listen for file changes (auto-refresh)
if (window.electronAPI && window.electronAPI.onFilesChanged) {
  window.electronAPI.onFilesChanged((data) => {
    console.log('Files changed:', data);
    if (selectedProjectPath) {
      showRefreshIndicator();
      loadProject(selectedProjectPath);
    }
  });
}

// Load recent projects on startup
updateRecentProjects();

console.log('GSD Viewer initialized - select a project folder to visualize');
