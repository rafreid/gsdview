import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';

// Color palette by node type (WCAG AA compliant against #1a1a2e background)
const nodeColors = {
  root: '#FF6B6B',       // Coral red - focal point
  phase: '#4ECDC4',      // Teal - major structure
  plan: '#45B7D1',       // Sky blue - work units
  task: '#98D8C8',       // Mint green - granular items
  requirement: '#F7DC6F', // Gold - specifications
  file: '#DDA0DD',       // Plum - source references (default)
  directory: '#BB8FCE'   // Purple - directories
};

// File extension colors for better visual distinction
const extensionColors = {
  '.md': '#5DADE2',      // Blue - markdown
  '.js': '#F7DC6F',      // Yellow - javascript
  '.ts': '#3498DB',      // Dark blue - typescript
  '.json': '#27AE60',    // Green - json
  '.html': '#E74C3C',    // Red - html
  '.css': '#9B59B6',     // Purple - css
  '.py': '#2ECC71',      // Green - python
  '.yaml': '#F39C12',    // Orange - yaml
  '.yml': '#F39C12',     // Orange - yaml
  '.txt': '#BDC3C7',     // Gray - text
  '.sh': '#1ABC9C',      // Teal - shell
  '.gitignore': '#7F8C8D' // Dark gray - git files
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
let treeData = null; // Hierarchical tree structure
let treeExpanded = new Set(); // Track expanded directories
let is3D = true; // Track current dimension mode

// Track nodes currently flashing (nodeId -> animation state)
const flashingNodes = new Map();

// Color interpolation helper for flash animation
function lerpColor(color1, color2, t) {
  const r1 = (color1 >> 16) & 0xFF, g1 = (color1 >> 8) & 0xFF, b1 = color1 & 0xFF;
  const r2 = (color2 >> 16) & 0xFF, g2 = (color2 >> 8) & 0xFF, b2 = color2 & 0xFF;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

// Find node ID from file path
function findNodeIdFromPath(changedPath) {
  // changedPath is absolute: /path/to/project/.planning/some/file.md
  // node.path is relative: some/file.md (relative to .planning/)

  // Extract portion after .planning/
  const planningIndex = changedPath.indexOf('.planning/');
  if (planningIndex === -1) {
    console.log('[Flash] Path not in .planning:', changedPath);
    return null;
  }

  const relativePath = changedPath.substring(planningIndex + '.planning/'.length);
  console.log('[Flash] Looking for node with path:', relativePath);

  const node = currentGraphData.nodes.find(n => n.path === relativePath);
  if (node) {
    console.log('[Flash] Found node:', node.id);
  } else {
    console.log('[Flash] No node found for path:', relativePath);
  }

  return node ? node.id : null;
}

// Flash a node when its file changes
function flashNode(nodeId) {
  const node = currentGraphData.nodes.find(n => n.id === nodeId);
  if (!node) {
    console.log('[Flash] Node not found in graph:', nodeId);
    return;
  }

  const threeObj = node.__threeObj;
  if (!threeObj) {
    console.log('[Flash] No THREE object for node:', nodeId);
    return;
  }

  // Collect all materials to animate
  const materials = [];
  if (threeObj.material) {
    materials.push(threeObj.material);
  }
  if (threeObj.children) {
    threeObj.children.forEach(child => {
      if (child.material) materials.push(child.material);
    });
  }

  if (materials.length === 0) {
    console.log('[Flash] No materials found for node:', nodeId);
    return;
  }

  // Cancel existing animation
  if (flashingNodes.has(nodeId)) {
    const existing = flashingNodes.get(nodeId);
    if (existing.rafId) cancelAnimationFrame(existing.rafId);
  }

  // Store original colors
  const originalColors = materials.map(m => m.color.getHex());
  const flashColor = 0xFFFFFF; // Bright white for maximum visibility

  // Pulsing animation: 3 pulses over 2 seconds
  const duration = 2000;
  const pulseCount = 3;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Pulsing: use sine wave for multiple pulses, with decay
    const pulsePhase = progress * pulseCount * Math.PI * 2;
    const pulse = Math.max(0, Math.sin(pulsePhase));
    const decay = 1 - progress; // Fade out over time
    const intensity = pulse * decay;

    materials.forEach((material, i) => {
      material.color.setHex(lerpColor(originalColors[i], flashColor, intensity));
    });

    if (progress < 1) {
      const rafId = requestAnimationFrame(animate);
      flashingNodes.set(nodeId, { rafId, startTime });
    } else {
      // Restore original colors
      materials.forEach((material, i) => {
        material.color.setHex(originalColors[i]);
      });
      flashingNodes.delete(nodeId);
    }
  }

  // Start animation
  const rafId = requestAnimationFrame(animate);
  flashingNodes.set(nodeId, { rafId, startTime });
  console.log('[Flash] Started graph flash for:', nodeId);
}

// Flash a tree item
function flashTreeItem(nodeId) {
  const treeItem = document.querySelector(`.tree-item[data-node-id="${nodeId}"]`);
  if (!treeItem) return;

  // Remove existing animation
  treeItem.classList.remove('tree-flash');

  // Force reflow to restart animation
  void treeItem.offsetWidth;

  // Add animation class
  treeItem.classList.add('tree-flash');

  // Remove class after animation completes
  setTimeout(() => {
    treeItem.classList.remove('tree-flash');
  }, 2000);
}

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

  // For files, use extension-based colors
  if (node.type === 'file' && node.extension) {
    return extensionColors[node.extension] || nodeColors.file;
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
    const size = getNodeSize(node, connectionCounts);
    const color = getNodeColor(node);

    // Directories: Use box/cube geometry with folder-like appearance
    if (node.type === 'directory') {
      const group = new THREE.Group();
      group.name = node.id;

      // Main folder body (slightly flattened box)
      const bodyGeometry = new THREE.BoxGeometry(size * 1.5, size * 1.2, size * 0.8);
      const bodyMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.name = node.id + '-body';

      // Folder tab (small box on top)
      const tabGeometry = new THREE.BoxGeometry(size * 0.6, size * 0.3, size * 0.8);
      const tabMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.95
      });
      const tab = new THREE.Mesh(tabGeometry, tabMaterial);
      tab.position.set(-size * 0.4, size * 0.75, 0);

      // Wireframe outline for clarity
      const edges = new THREE.EdgesGeometry(bodyGeometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);

      group.add(body);
      group.add(tab);
      group.add(wireframe);

      return group;
    }

    // Files: Use octahedron (diamond-like) for visual distinction
    if (node.type === 'file') {
      const geometry = new THREE.OctahedronGeometry(size * 0.8);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = node.id;

      // Add wireframe for clarity
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
      const wireframe = new THREE.LineSegments(edges, lineMaterial);
      mesh.add(wireframe);

      return mesh;
    }

    // Current active phase: glow effect
    if (node.type === 'phase' && currentState && currentState.currentPhase) {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      if (phaseNum === currentState.currentPhase && node.status !== 'complete') {
        // Create glowing sphere for current phase
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

    // Root node: larger icosahedron
    if (node.type === 'root') {
      const geometry = new THREE.IcosahedronGeometry(size * 1.2);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
      return new THREE.Mesh(geometry, material);
    }

    return false; // Use default sphere for other types
  })
  .linkColor(link => getLinkColor(link, currentGraphData))
  .linkWidth(link => getLinkWidth(link, currentGraphData))
  .linkOpacity(0.6)
  .linkDirectionalArrowLength(3.5)
  .linkDirectionalArrowRelPos(1)
  .backgroundColor('#1a1a2e')
  .showNavInfo(false)
  // Click-to-fly navigation
  .onNodeClick(node => {
    // Calculate distance based on node size for optimal viewing
    const distance = 50 + getNodeSize(node, connectionCounts) * 4;

    // Animate camera to node position
    if (is3D) {
      // 3D mode: calculate position relative to node position
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
    } else {
      // 2D mode: position camera above the node looking down
      Graph.cameraPosition(
        { x: node.x || 0, y: node.y || 0, z: distance + 100 },
        node,
        1000
      );
    }

    // Show details panel
    showDetailsPanel(node);
  })
  // Hover tooltips
  .onNodeHover(node => {
    const tooltip = document.getElementById('tooltip');
    if (node) {
      let content = `<strong>${node.name}</strong><br>`;
      content += `<span style="color: ${getNodeColor(node)}; text-transform: capitalize;">`;

      // Show type with icon
      if (node.type === 'directory') {
        content += '📁 Directory';
      } else if (node.type === 'file') {
        content += '📄 File';
        if (node.extension) {
          content += ` (${node.extension})`;
        }
      } else {
        content += `Type: ${node.type}`;
      }
      content += '</span>';

      if (node.status) {
        const statusColor = statusColors[node.status] || '#888';
        content += `<br><span style="color: ${statusColor}">Status: ${node.status}</span>`;
      }
      if (node.category) content += `<br>Category: ${node.category}`;
      if (node.path) content += `<br><span style="color: #888; font-size: 10px;">${node.path}</span>`;

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
  const treePanel = document.getElementById('tree-panel');
  const treeWidth = treePanel && treePanel.classList.contains('visible') ? 280 : 0;
  Graph.width(window.innerWidth - treeWidth);
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
    // Store directory data for tree building
    storedDirectoryData = directory;

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

  // Build and update tree panel
  if (storedDirectoryData) {
    treeData = buildTreeStructure(storedDirectoryData);
    // Auto-expand root directory
    if (treeData && treeData.length > 0) {
      treeExpanded.add(treeData[0].id);
    }
    updateTreePanel();
  }
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
  console.log('Select folder button clicked');
  console.log('electronAPI:', window.electronAPI);

  if (window.electronAPI && window.electronAPI.selectFolder) {
    console.log('Calling selectFolder...');
    try {
      const folderPath = await window.electronAPI.selectFolder();
      console.log('Selected folder:', folderPath);
      if (folderPath) {
        await loadProject(folderPath);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
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

  // File extensions section
  const extTitle = document.createElement('div');
  extTitle.className = 'legend-title';
  extTitle.style.marginTop = '12px';
  extTitle.textContent = 'File Types';
  legend.appendChild(extTitle);

  const extLabels = {
    '.md': 'Markdown',
    '.js': 'JavaScript',
    '.json': 'JSON',
    '.html': 'HTML',
    '.css': 'CSS'
  };

  for (const [ext, label] of Object.entries(extLabels)) {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorCircle = document.createElement('div');
    colorCircle.className = 'legend-color';
    colorCircle.style.backgroundColor = extensionColors[ext];

    const labelSpan = document.createElement('span');
    labelSpan.className = 'legend-label';
    labelSpan.textContent = label;

    item.appendChild(colorCircle);
    item.appendChild(labelSpan);
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

// Format file size for display
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Format date for display
function formatDate(date) {
  return new Date(date).toLocaleString();
}

// Simple syntax highlighting for code
function highlightCode(content, extension) {
  // Escape HTML
  let escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Basic highlighting based on extension
  if (['.js', '.ts', '.json'].includes(extension)) {
    // Highlight strings
    escaped = escaped.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span style="color: #98C379;">$&</span>');
    // Highlight keywords
    escaped = escaped.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|new|this|true|false|null|undefined)\b/g, '<span style="color: #C678DD;">$1</span>');
    // Highlight comments
    escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span style="color: #5C6370;">$1</span>');
  } else if (extension === '.md') {
    // Highlight headers
    escaped = escaped.replace(/^(#{1,6}\s.*)$/gm, '<span style="color: #E06C75; font-weight: bold;">$1</span>');
    // Highlight bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #E5C07B;">$1</strong>');
    // Highlight code blocks
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: #3E4451; padding: 2px 4px; border-radius: 3px;">$1</code>');
  }

  return escaped;
}

// Details panel functions
async function showDetailsPanel(node) {
  selectedNode = node;
  const panel = document.getElementById('details-panel');
  const title = document.getElementById('panel-title');
  const content = document.getElementById('panel-content');

  // Sync with tree panel - highlight the node in tree
  if (node.type === 'directory' || node.type === 'file') {
    highlightTreeItem(node.id);
  }

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
    html += `<p><strong>Extension:</strong> <span style="color: ${extensionColors[node.extension] || '#888'}">${node.extension}</span></p>`;
  }

  // Add open button for nodes with file paths
  const filePath = node.path || node.file;
  let fullPath = null;

  if (filePath && selectedProjectPath) {
    if (node.path) {
      fullPath = `${selectedProjectPath}/.planning/${node.path}`;
    } else if (node.file) {
      fullPath = `${selectedProjectPath}/.planning/phases/${node.file}`;
    }
    html += `<button id="open-file-btn" class="panel-btn">Open in Editor</button>`;
  }

  // For files, show content preview
  if (node.type === 'file' && fullPath && window.electronAPI && window.electronAPI.readFileContent) {
    html += `<div id="file-preview-container">
      <p><strong>File Preview:</strong></p>
      <div id="file-preview-loading">Loading...</div>
      <pre id="file-preview"></pre>
    </div>`;
  }

  // For directories, show children count info
  if (node.type === 'directory') {
    const childLinks = currentGraphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      return sourceId === node.id;
    });
    html += `<p><strong>Contains:</strong> ${childLinks.length} items</p>`;
  }

  content.innerHTML = html;

  // Load file content preview
  if (node.type === 'file' && fullPath && window.electronAPI && window.electronAPI.readFileContent) {
    try {
      const result = await window.electronAPI.readFileContent(fullPath);
      const previewEl = document.getElementById('file-preview');
      const loadingEl = document.getElementById('file-preview-loading');

      if (loadingEl) loadingEl.style.display = 'none';

      if (result.error) {
        if (previewEl) previewEl.innerHTML = `<span style="color: #E74C3C;">Error: ${result.error}</span>`;
      } else {
        // Show file stats
        const statsHtml = `<p style="font-size: 11px; color: #888; margin-bottom: 8px;">
          Size: ${formatFileSize(result.size)} | Modified: ${formatDate(result.modified)}
          ${result.truncated ? ' | <span style="color: #F39C12;">Truncated</span>' : ''}
        </p>`;

        const container = document.getElementById('file-preview-container');
        if (container) {
          container.insertAdjacentHTML('afterbegin', statsHtml);
        }

        if (previewEl) {
          previewEl.innerHTML = highlightCode(result.content, node.extension);
        }
      }
    } catch (err) {
      console.error('Error loading file preview:', err);
      const previewEl = document.getElementById('file-preview');
      if (previewEl) previewEl.innerHTML = `<span style="color: #E74C3C;">Error loading preview</span>`;
    }
  }

  // Add click handler for open button
  const openBtn = document.getElementById('open-file-btn');
  if (openBtn && fullPath) {
    openBtn.addEventListener('click', async () => {
      if (window.electronAPI && window.electronAPI.openFile) {
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
      // Flash the changed file node if it exists in the graph
      if (data.path) {
        console.log('[FileChange] Received:', data.event, data.path);
        const nodeId = findNodeIdFromPath(data.path);
        if (nodeId) {
          flashNode(nodeId);
          flashTreeItem(nodeId);
        }
      }

      showRefreshIndicator();
      loadProject(selectedProjectPath);
    }
  });
}

// Load recent projects on startup
updateRecentProjects();

// =====================================================
// TREE PANEL FUNCTIONALITY
// =====================================================

// Build hierarchical tree structure from flat directory data
function buildTreeStructure(directoryData) {
  if (!directoryData || !directoryData.nodes) return null;

  const nodeMap = new Map();
  const roots = [];

  // Create map of all nodes
  for (const node of directoryData.nodes) {
    nodeMap.set(node.id, {
      ...node,
      children: []
    });
  }

  // Build parent-child relationships
  for (const link of directoryData.links) {
    const parent = nodeMap.get(link.source);
    const child = nodeMap.get(link.target);
    if (parent && child) {
      parent.children.push(child);
    }
  }

  // Find root nodes (nodes with no parent)
  const childIds = new Set(directoryData.links.map(l => l.target));
  for (const node of directoryData.nodes) {
    if (!childIds.has(node.id)) {
      roots.push(nodeMap.get(node.id));
    }
  }

  // Sort children: directories first, then alphabetically
  function sortChildren(node) {
    node.children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
    return node;
  }

  roots.forEach(sortChildren);
  return roots;
}

// Get icon for tree item
function getTreeIcon(node) {
  if (node.type === 'directory') {
    return treeExpanded.has(node.id) ? '📂' : '📁';
  }
  // File icons by extension
  const extIcons = {
    '.md': '📝',
    '.js': '📜',
    '.ts': '📘',
    '.json': '📋',
    '.html': '🌐',
    '.css': '🎨',
    '.yaml': '⚙️',
    '.yml': '⚙️',
    '.txt': '📄'
  };
  return extIcons[node.extension] || '📄';
}

// Get color for tree item
function getTreeColor(node) {
  if (node.type === 'directory') return '#BB8FCE';
  return extensionColors[node.extension] || '#DDA0DD';
}

// Render tree recursively
function renderTree(nodes, depth = 0) {
  let html = '';
  const indent = depth * 16;

  for (const node of nodes) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = treeExpanded.has(node.id);
    const isSelected = selectedNode && selectedNode.id === node.id;

    html += `<div class="tree-item ${isSelected ? 'selected' : ''}"
                  data-node-id="${node.id}"
                  style="padding-left: ${indent + 8}px">
      <span class="tree-toggle-icon ${isExpanded ? 'expanded' : ''} ${!hasChildren ? 'no-children' : ''}"
            data-node-id="${node.id}">▶</span>
      <span class="tree-icon" style="color: ${getTreeColor(node)}">${getTreeIcon(node)}</span>
      <span class="tree-name">${node.name}</span>
    </div>`;

    if (hasChildren) {
      html += `<div class="tree-children ${isExpanded ? 'expanded' : ''}" data-parent-id="${node.id}">
        ${renderTree(node.children, depth + 1)}
      </div>`;
    }
  }

  return html;
}

// Update tree display
function updateTreePanel() {
  const content = document.getElementById('tree-content');
  if (!content || !treeData) return;

  content.innerHTML = renderTree(treeData);

  // Add click handlers for tree items
  content.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = item.dataset.nodeId;

      // If clicking on toggle icon, just toggle expand/collapse
      if (e.target.classList.contains('tree-toggle-icon')) {
        toggleTreeExpand(nodeId);
        return;
      }

      // Otherwise, select the node and fly to it in graph
      selectTreeItem(nodeId);
    });
  });

  // Add double-click to expand/collapse directories
  content.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('dblclick', (e) => {
      const nodeId = item.dataset.nodeId;
      const node = findNodeById(nodeId);
      if (node && node.type === 'directory') {
        toggleTreeExpand(nodeId);
      }
    });
  });
}

// Find node in graph data by ID
function findNodeById(nodeId) {
  return currentGraphData.nodes.find(n => n.id === nodeId);
}

// Toggle expand/collapse for a directory
function toggleTreeExpand(nodeId) {
  if (treeExpanded.has(nodeId)) {
    treeExpanded.delete(nodeId);
  } else {
    treeExpanded.add(nodeId);
  }
  updateTreePanel();
}

// Expand all parents of a node
function expandParentsOf(nodeId) {
  // Find the path to this node from root
  function findPath(nodes, targetId, path = []) {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...path, node.id];
      }
      if (node.children && node.children.length > 0) {
        const found = findPath(node.children, targetId, [...path, node.id]);
        if (found) return found;
      }
    }
    return null;
  }

  if (!treeData) return;
  const path = findPath(treeData, nodeId);
  if (path) {
    // Expand all nodes in path except the target itself
    path.slice(0, -1).forEach(id => treeExpanded.add(id));
  }
}

// Select a tree item and fly to it in graph
function selectTreeItem(nodeId) {
  const graphNode = findNodeById(nodeId);
  if (!graphNode) return;

  // Update visual selection in tree
  document.querySelectorAll('.tree-item').forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.nodeId === nodeId) {
      item.classList.add('selected');
    }
  });

  // Fly to node in graph
  if (graphNode.x !== undefined) {
    const distance = 50 + getNodeSize(graphNode, connectionCounts) * 4;

    if (is3D) {
      // 3D mode: calculate position relative to node position
      const distRatio = 1 + distance / Math.hypot(graphNode.x || 0, graphNode.y || 0, graphNode.z || 0);
      Graph.cameraPosition(
        {
          x: (graphNode.x || 0) * distRatio,
          y: (graphNode.y || 0) * distRatio,
          z: (graphNode.z || 0) * distRatio
        },
        graphNode,
        1000
      );
    } else {
      // 2D mode: position camera above the node looking down
      Graph.cameraPosition(
        { x: graphNode.x || 0, y: graphNode.y || 0, z: distance + 100 },
        graphNode,
        1000
      );
    }

    // Flash the graph node
    flashNode(nodeId);
  }

  // Show details panel
  showDetailsPanel(graphNode);
}

// Highlight a node in the tree (called when graph node is clicked)
function highlightTreeItem(nodeId) {
  // Expand parents first
  expandParentsOf(nodeId);
  updateTreePanel();

  // Scroll to and highlight the item
  setTimeout(() => {
    const treeContent = document.getElementById('tree-content');
    const treeItems = document.querySelectorAll('.tree-item');

    treeItems.forEach(item => {
      item.classList.remove('selected', 'highlighted');
      if (item.dataset.nodeId === nodeId) {
        item.classList.add('selected');
        // Scroll into view
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Flash the tree item
    flashTreeItem(nodeId);
  }, 50);
}

// Tree toggle button handler
document.getElementById('tree-toggle').addEventListener('click', () => {
  const panel = document.getElementById('tree-panel');
  const toggle = document.getElementById('tree-toggle');
  const graphContainer = document.getElementById('graph-container');

  panel.classList.toggle('visible');
  toggle.classList.toggle('panel-open');
  graphContainer.classList.toggle('tree-open');

  // Update toggle icon
  toggle.textContent = panel.classList.contains('visible') ? '◀' : '📁';

  // Resize graph
  setTimeout(() => handleResize(), 300);
});

// Store directory data for tree building
let storedDirectoryData = null;

// Dimension toggle button handler
document.getElementById('dimension-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('dimension-toggle');

  // Toggle dimension state
  is3D = !is3D;

  // Update graph dimensions
  Graph.numDimensions(is3D ? 3 : 2);

  // Update button text to reflect current mode
  toggle.textContent = is3D ? '3D' : '2D';

  // For 2D mode, adjust camera to top-down view for better visualization
  if (!is3D) {
    // Position camera directly above looking down
    Graph.cameraPosition(
      { x: 0, y: 0, z: 300 },  // Camera position (looking down from Z-axis)
      { x: 0, y: 0, z: 0 },     // Look at origin
      1000                       // Transition duration
    );
  } else {
    // For 3D mode, zoom to fit to see the spatial layout
    setTimeout(() => {
      Graph.zoomToFit(1000);
    }, 100);
  }
});

console.log('GSD Viewer initialized - select a project folder to visualize');
