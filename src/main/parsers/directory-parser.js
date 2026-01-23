const fs = require('fs');
const path = require('path');

/**
 * Default ignore patterns for src/ directory
 */
const DEFAULT_SRC_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '__pycache__',
  '.nuxt',
  '.output',
  'out'
];

/**
 * Parse multiple directories into a unified tree with source type markers
 * @param {Array} configs - Array of directory configs with path, sourceType, and ignorePatterns
 * @param {string} projectPath - Root project path for deriving project name
 * @returns {Object} { tree, files, nodes, links }
 */
function parseDirectories(configs, projectPath) {
  const projectName = path.basename(projectPath);
  const allFiles = [];
  const childTrees = [];

  // Create virtual project root
  const rootNode = {
    id: 'dir-root',
    name: projectName,
    type: 'directory',
    path: projectPath,
    sourceType: 'root',
    children: []
  };

  for (const config of configs) {
    const { path: dirPath, sourceType, ignorePatterns = [] } = config;

    // Skip if directory doesn't exist
    if (!fs.existsSync(dirPath)) {
      console.log(`[parseDirectories] Skipping non-existent directory: ${dirPath}`);
      continue;
    }

    const result = parseDirectoryWithSource(dirPath, sourceType, ignorePatterns);
    if (result.tree) {
      childTrees.push(result.tree);
      allFiles.push(...result.files);
    }
  }

  rootNode.children = childTrees;

  // Flatten the unified tree
  const flattened = flattenTree(rootNode);

  return {
    tree: rootNode,
    files: allFiles,
    nodes: flattened.nodes,
    links: flattened.links
  };
}

/**
 * Parse a single directory with source type markers
 * @param {string} dirPath - Path to directory
 * @param {string} sourceType - Source type marker ('planning', 'src', etc.)
 * @param {Array} ignorePatterns - Patterns to ignore
 * @returns {Object} { tree, files }
 */
function parseDirectoryWithSource(dirPath, sourceType, ignorePatterns = []) {
  const files = [];
  const dirName = path.basename(dirPath);
  const idPrefix = sourceType;

  function shouldIgnore(name) {
    return ignorePatterns.some(pattern => {
      // Simple string matching for now
      return name === pattern || name.startsWith(pattern);
    });
  }

  function walkDir(currentPath, relativePath = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      // Skip ignored patterns
      if (shouldIgnore(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        const dirNode = {
          id: `${idPrefix}-dir-${relPath.replace(/[\/\\]/g, '-')}`,
          name: entry.name,
          type: 'directory',
          path: relPath,
          sourceType: sourceType,
          children: walkDir(fullPath, relPath)
        };
        children.push(dirNode);
      } else if (entry.isFile()) {
        const fileNode = {
          id: `${idPrefix}-file-${relPath.replace(/[\/\\]/g, '-')}`,
          name: entry.name,
          type: 'file',
          path: relPath,
          extension: path.extname(entry.name).toLowerCase(),
          sourceType: sourceType
        };
        children.push(fileNode);
        files.push(fileNode);
      }
    }

    return children;
  }

  const tree = {
    id: `${idPrefix}-dir-root`,
    name: dirName,
    type: 'directory',
    path: '',
    sourceType: sourceType,
    children: walkDir(dirPath)
  };

  return { tree, files };
}

/**
 * Parse .planning/ directory structure into a tree representation
 * @param {string} planningPath - Path to .planning/ directory
 * @returns {Object} Directory tree data
 */
function parseDirectory(planningPath) {
  if (!fs.existsSync(planningPath)) {
    return { tree: null, files: [], error: 'Directory not found' };
  }

  // Use the new source-aware parsing internally
  const result = parseDirectoryWithSource(planningPath, 'planning', []);

  // Maintain backward compatibility by returning tree without prefix
  // Strip the prefix from IDs to match old format
  function stripPrefix(node) {
    const newNode = { ...node };
    // Convert 'planning-dir-xxx' back to 'dir-xxx' for backward compat
    newNode.id = newNode.id.replace(/^planning-/, '');
    if (newNode.children) {
      newNode.children = newNode.children.map(stripPrefix);
    }
    return newNode;
  }

  const backwardCompatTree = stripPrefix(result.tree);
  // Rename root to match old format
  backwardCompatTree.id = 'dir-planning';
  backwardCompatTree.name = '.planning';

  const files = result.files.map(f => ({
    ...f,
    id: f.id.replace(/^planning-/, '')
  }));

  return { tree: backwardCompatTree, files };
}

/**
 * Flatten directory tree into a list of nodes and links for the graph
 * @param {Object} tree - Directory tree from parseDirectory or parseDirectories
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
      extension: node.extension || null,
      sourceType: node.sourceType || null
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

module.exports = { parseDirectory, parseDirectories, flattenTree, DEFAULT_SRC_IGNORE_PATTERNS };
