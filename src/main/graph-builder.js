/**
 * Build graph data from parsed GSD project data
 * Combines roadmap phases, requirements, and directory structure into a unified graph
 */

/**
 * Build graph nodes and links from parsed project data
 * @param {Object} projectData - Parsed project data from parse-project
 * @returns {Object} { nodes: [], links: [] }
 */
function buildGraph(projectData) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map(); // Track created nodes by ID

  // Helper to add node if not already exists
  function addNode(node) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
      nodes.push(node);
    }
    return nodeMap.get(node.id);
  }

  // Helper to add link
  function addLink(source, target, type = 'default') {
    links.push({ source, target, type });
  }

  // Add project root node
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

      // Link phase to project root
      addLink(projectNode.id, phaseNode.id, 'contains');

      // Process plans within phase
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

          // Link plan to phase
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

      // Link requirement to its phase (if mapping exists)
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
    // Add directory/file nodes
    for (const dirNode of directory.nodes) {
      // Prefix type to avoid conflicts with other node types
      const nodeType = dirNode.type === 'directory' ? 'directory' : 'file';
      addNode({
        id: dirNode.id,
        name: dirNode.name,
        type: nodeType,
        path: dirNode.path,
        extension: dirNode.extension,
        sourceType: dirNode.sourceType
      });
    }

    // Add directory structure links
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

module.exports = { buildGraph };
