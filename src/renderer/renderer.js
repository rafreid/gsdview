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

// Color palette by node type
const nodeColors = {
  root: '#ff6b6b',
  phase: '#4ecdc4',
  plan: '#45b7d1',
  requirement: '#f7dc6f',
  task: '#82e0aa',
  file: '#bb8fce'
};

// Initialize 3D force graph
const container = document.getElementById('graph-container');
const Graph = ForceGraph3D()(container)
  .graphData(placeholderData)
  .nodeLabel('name')
  .nodeColor(node => nodeColors[node.type] || '#999')
  .nodeRelSize(6)
  .linkColor(() => 'rgba(255,255,255,0.2)')
  .linkWidth(1)
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

console.log('GSD Viewer initialized with placeholder data');
