const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseDirectory, parseDirectories, flattenTree, DEFAULT_SRC_IGNORE_PATTERNS } = require('../directory-parser');

describe('directory-parser', () => {
  describe('flattenTree', () => {
    it('should flatten a simple tree structure', () => {
      const tree = {
        id: 'dir-root',
        name: 'root',
        type: 'directory',
        path: '',
        children: [
          {
            id: 'dir-sub',
            name: 'sub',
            type: 'directory',
            path: 'sub',
            children: [
              {
                id: 'file-test',
                name: 'test.js',
                type: 'file',
                path: 'sub/test.js',
                extension: '.js'
              }
            ]
          }
        ]
      };

      const result = flattenTree(tree);

      expect(result.nodes).toHaveLength(3);
      expect(result.links).toHaveLength(2);

      // Verify root node
      expect(result.nodes[0]).toMatchObject({
        id: 'dir-root',
        name: 'root',
        type: 'directory'
      });

      // Verify links
      expect(result.links).toContainEqual({
        source: 'dir-root',
        target: 'dir-sub',
        type: 'contains'
      });
      expect(result.links).toContainEqual({
        source: 'dir-sub',
        target: 'file-test',
        type: 'contains'
      });
    });

    it('should handle null tree', () => {
      const result = flattenTree(null);
      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
    });

    it('should preserve sourceType in nodes', () => {
      const tree = {
        id: 'planning-dir-root',
        name: 'root',
        type: 'directory',
        path: '',
        sourceType: 'planning',
        children: []
      };

      const result = flattenTree(tree);
      expect(result.nodes[0].sourceType).toBe('planning');
    });
  });

  describe('parseDirectoryWithSource', () => {
    let tempDir;

    beforeEach(() => {
      // Create a temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
    });

    afterEach(() => {
      // Clean up temp directory
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should parse directory structure with correct IDs', () => {
      // Create test structure
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      fs.writeFileSync(path.join(tempDir, 'file1.js'), '// test');
      fs.writeFileSync(path.join(tempDir, 'subdir', 'file2.md'), '# test');

      const { parseDirectoryWithSource } = require('../directory-parser');
      const result = parseDirectoryWithSource(tempDir, 'src', []);

      // Verify root
      expect(result.tree.id).toBe('src-dir-root');
      expect(result.tree.sourceType).toBe('src');

      // Verify children
      expect(result.tree.children).toHaveLength(2);

      // Find directory and file
      const subdir = result.tree.children.find(c => c.type === 'directory');
      const file1 = result.tree.children.find(c => c.name === 'file1.js');

      expect(subdir.id).toBe('src-dir-subdir');
      expect(subdir.sourceType).toBe('src');
      expect(file1.id).toBe('src-file-file1.js');
      expect(file1.sourceType).toBe('src');
      expect(file1.extension).toBe('.js');

      // Verify nested file
      expect(subdir.children).toHaveLength(1);
      expect(subdir.children[0].id).toBe('src-file-subdir-file2.md');
    });

    it('should respect ignore patterns', () => {
      // Create test structure with ignored dirs
      fs.mkdirSync(path.join(tempDir, 'node_modules'));
      fs.writeFileSync(path.join(tempDir, 'node_modules', 'package.js'), '// ignored');
      fs.writeFileSync(path.join(tempDir, 'file.js'), '// included');

      const { parseDirectoryWithSource } = require('../directory-parser');
      const result = parseDirectoryWithSource(tempDir, 'src', DEFAULT_SRC_IGNORE_PATTERNS);

      // Should only have file.js, not node_modules
      expect(result.tree.children).toHaveLength(1);
      expect(result.tree.children[0].name).toBe('file.js');
    });

    it('should collect all files', () => {
      fs.writeFileSync(path.join(tempDir, 'file1.js'), '// test');
      fs.mkdirSync(path.join(tempDir, 'sub'));
      fs.writeFileSync(path.join(tempDir, 'sub', 'file2.js'), '// test');

      const { parseDirectoryWithSource } = require('../directory-parser');
      const result = parseDirectoryWithSource(tempDir, 'planning', []);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].type).toBe('file');
      expect(result.files[1].type).toBe('file');
    });
  });

  describe('parseDirectory', () => {
    it('should return error if directory not found', () => {
      const result = parseDirectory('/nonexistent/path');
      expect(result.error).toBe('Directory not found');
      expect(result.tree).toBeNull();
      expect(result.files).toEqual([]);
    });

    it('should maintain backward compatibility with ID format', () => {
      const fixturesPath = path.join(__dirname, 'fixtures');

      // Create a temporary .planning directory for this test
      const tempPlanningDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-planning-test-'));
      fs.writeFileSync(path.join(tempPlanningDir, 'test.md'), '# test');

      const result = parseDirectory(tempPlanningDir);

      // Clean up
      fs.rmSync(tempPlanningDir, { recursive: true, force: true });

      // Verify backward-compatible format (no 'planning-' prefix)
      expect(result.tree.id).toBe('dir-planning');
      expect(result.tree.name).toBe('.planning');
      expect(result.files[0].id).toMatch(/^file-test\.md$/);
    });
  });

  describe('parseDirectories', () => {
    let tempProjectDir;
    let tempPlanningDir;
    let tempSrcDir;

    beforeEach(() => {
      tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-project-'));
      tempPlanningDir = path.join(tempProjectDir, '.planning');
      tempSrcDir = path.join(tempProjectDir, 'src');

      fs.mkdirSync(tempPlanningDir);
      fs.mkdirSync(tempSrcDir);
    });

    afterEach(() => {
      if (tempProjectDir && fs.existsSync(tempProjectDir)) {
        fs.rmSync(tempProjectDir, { recursive: true, force: true });
      }
    });

    it('should combine multiple directories with sourceType markers', () => {
      fs.writeFileSync(path.join(tempPlanningDir, 'ROADMAP.md'), '# roadmap');
      fs.writeFileSync(path.join(tempSrcDir, 'main.js'), '// code');

      const configs = [
        { path: tempPlanningDir, sourceType: 'planning', ignorePatterns: [] },
        { path: tempSrcDir, sourceType: 'src', ignorePatterns: DEFAULT_SRC_IGNORE_PATTERNS }
      ];

      const result = parseDirectories(configs, tempProjectDir);

      // Should have unified tree with root node
      expect(result.tree.id).toBe('dir-root');
      expect(result.tree.sourceType).toBe('root');
      expect(result.tree.children).toHaveLength(2);

      // Should have both source types in nodes
      const planningNodes = result.nodes.filter(n => n.sourceType === 'planning');
      const srcNodes = result.nodes.filter(n => n.sourceType === 'src');

      expect(planningNodes.length).toBeGreaterThan(0);
      expect(srcNodes.length).toBeGreaterThan(0);
    });

    it('should skip non-existent directories', () => {
      const configs = [
        { path: tempPlanningDir, sourceType: 'planning', ignorePatterns: [] },
        { path: '/nonexistent/path', sourceType: 'other', ignorePatterns: [] }
      ];

      const result = parseDirectories(configs, tempProjectDir);

      // Should only include the planning directory
      expect(result.tree.children).toHaveLength(1);
      expect(result.tree.children[0].sourceType).toBe('planning');
    });

    it('should collect files from all directories', () => {
      fs.writeFileSync(path.join(tempPlanningDir, 'file1.md'), '# test');
      fs.writeFileSync(path.join(tempSrcDir, 'file2.js'), '// test');

      const configs = [
        { path: tempPlanningDir, sourceType: 'planning', ignorePatterns: [] },
        { path: tempSrcDir, sourceType: 'src', ignorePatterns: [] }
      ];

      const result = parseDirectories(configs, tempProjectDir);

      expect(result.files).toHaveLength(2);
      expect(result.files.find(f => f.sourceType === 'planning')).toBeDefined();
      expect(result.files.find(f => f.sourceType === 'src')).toBeDefined();
    });
  });
});
