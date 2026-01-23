const fs = require('fs');
const path = require('path');

/**
 * Parse .planning/ directory structure into a tree representation
 * @param {string} planningPath - Path to .planning/ directory
 * @returns {Object} Directory tree data
 */
function parseDirectory(planningPath) {
  if (!fs.existsSync(planningPath)) {
    return { tree: null, files: [], error: 'Directory not found' };
  }

  const files = [];

  function walkDir(dirPath, relativePath = '') {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        const dirNode = {
          id: `dir-${relPath.replace(/[\/\\]/g, '-')}`,
          name: entry.name,
          type: 'directory',
          path: relPath,
          children: walkDir(fullPath, relPath)
        };
        children.push(dirNode);
      } else if (entry.isFile()) {
        const fileNode = {
          id: `file-${relPath.replace(/[\/\\]/g, '-')}`,
          name: entry.name,
          type: 'file',
          path: relPath,
          extension: path.extname(entry.name).toLowerCase()
        };
        children.push(fileNode);
        files.push(fileNode);
      }
    }

    return children;
  }

  const tree = {
    id: 'dir-planning',
    name: '.planning',
    type: 'directory',
    path: '',
    children: walkDir(planningPath)
  };

  return { tree, files };
}

/**
 * Flatten directory tree into a list of nodes and links for the graph
 * @param {Object} tree - Directory tree from parseDirectory
 * @returns {Object} { nodes: [], links: [] }
 */
function flattenTree(tree) {
  const nodes = [];
  const links = [];

  function traverse(node, parentId = null) {
    nodes.push({
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      extension: node.extension || null
    });

    if (parentId) {
      links.push({
        source: parentId,
        target: node.id,
        type: 'contains'
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, node.id);
      }
    }
  }

  if (tree) {
    traverse(tree);
  }

  return { nodes, links };
}

module.exports = { parseDirectory, flattenTree };
