const { buildGraph } = require('../graph-builder');

describe('graph-builder', () => {
  describe('buildGraph', () => {
    it('should create project root node', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const rootNode = result.nodes.find(n => n.id === 'project-root');
      expect(rootNode).toBeDefined();
      expect(rootNode.name).toBe('Project');
      expect(rootNode.type).toBe('root');
    });

    it('should create phase nodes with correct properties', () => {
      const projectData = {
        roadmap: {
          phases: [
            {
              id: 'phase-1',
              number: 1,
              name: 'Foundation',
              status: 'complete',
              goal: 'Build foundation',
              plans: []
            },
            {
              id: 'phase-2',
              number: 2,
              name: 'Rendering',
              status: 'in-progress',
              goal: 'Implement rendering',
              plans: []
            }
          ]
        },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const phase1 = result.nodes.find(n => n.id === 'phase-1');
      expect(phase1).toBeDefined();
      expect(phase1.name).toBe('Phase 1: Foundation');
      expect(phase1.type).toBe('phase');
      expect(phase1.status).toBe('complete');
      expect(phase1.goal).toBe('Build foundation');

      const phase2 = result.nodes.find(n => n.id === 'phase-2');
      expect(phase2).toBeDefined();
      expect(phase2.status).toBe('in-progress');
    });

    it('should link phases to project root', () => {
      const projectData = {
        roadmap: {
          phases: [
            { id: 'phase-1', number: 1, name: 'Foundation', status: 'complete', goal: '', plans: [] }
          ]
        },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const phaseLink = result.links.find(
        l => l.source === 'project-root' && l.target === 'phase-1'
      );
      expect(phaseLink).toBeDefined();
      expect(phaseLink.type).toBe('contains');
    });

    it('should create plan nodes and link to phases', () => {
      const projectData = {
        roadmap: {
          phases: [
            {
              id: 'phase-1',
              number: 1,
              name: 'Foundation',
              status: 'complete',
              goal: '',
              plans: [
                {
                  id: 'plan-01-01',
                  name: '01-01-PLAN.md',
                  status: 'complete',
                  description: 'Setup project',
                  file: '01-01-PLAN.md'
                },
                {
                  id: 'plan-01-02',
                  name: '01-02-PLAN.md',
                  status: 'pending',
                  description: 'Add feature',
                  file: '01-02-PLAN.md'
                }
              ]
            }
          ]
        },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const plan1 = result.nodes.find(n => n.id === 'plan-01-01');
      expect(plan1).toBeDefined();
      expect(plan1.name).toBe('01-01-PLAN.md');
      expect(plan1.type).toBe('plan');
      expect(plan1.status).toBe('complete');
      expect(plan1.description).toBe('Setup project');
      expect(plan1.file).toBe('01-01-PLAN.md');

      const planLink = result.links.find(
        l => l.source === 'phase-1' && l.target === 'plan-01-01'
      );
      expect(planLink).toBeDefined();
      expect(planLink.type).toBe('contains');
    });

    it('should create requirement nodes with correct properties', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: {
          requirements: [
            {
              id: 'req-grf-01',
              code: 'GRF-01',
              description: 'Display graph',
              category: 'GRF',
              status: 'complete'
            },
            {
              id: 'req-ui-01',
              code: 'UI-01',
              description: 'Click handler',
              category: 'UI',
              status: 'pending'
            }
          ],
          phaseMapping: {}
        },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const req1 = result.nodes.find(n => n.id === 'req-grf-01');
      expect(req1).toBeDefined();
      expect(req1.name).toBe('GRF-01');
      expect(req1.type).toBe('requirement');
      expect(req1.status).toBe('complete');
      expect(req1.description).toBe('Display graph');
      expect(req1.category).toBe('GRF');

      const req2 = result.nodes.find(n => n.id === 'req-ui-01');
      expect(req2).toBeDefined();
      expect(req2.status).toBe('pending');
    });

    it('should link requirements to phases via phase mapping', () => {
      const projectData = {
        roadmap: {
          phases: [
            { id: 'phase-1', number: 1, name: 'Foundation', status: 'complete', goal: '', plans: [] },
            { id: 'phase-2', number: 2, name: 'Rendering', status: 'pending', goal: '', plans: [] }
          ]
        },
        requirements: {
          requirements: [
            { id: 'req-grf-01', code: 'GRF-01', description: 'Display graph', category: 'GRF', status: 'complete' },
            { id: 'req-ui-01', code: 'UI-01', description: 'Click handler', category: 'UI', status: 'pending' }
          ],
          phaseMapping: {
            'GRF-01': 1,
            'UI-01': 2
          }
        },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      const reqLink1 = result.links.find(
        l => l.source === 'req-grf-01' && l.target === 'phase-1'
      );
      expect(reqLink1).toBeDefined();
      expect(reqLink1.type).toBe('maps-to');

      const reqLink2 = result.links.find(
        l => l.source === 'req-ui-01' && l.target === 'phase-2'
      );
      expect(reqLink2).toBeDefined();
    });

    it('should not link requirement if phase does not exist', () => {
      const projectData = {
        roadmap: {
          phases: [
            { id: 'phase-1', number: 1, name: 'Foundation', status: 'complete', goal: '', plans: [] }
          ]
        },
        requirements: {
          requirements: [
            { id: 'req-grf-01', code: 'GRF-01', description: 'Display graph', category: 'GRF', status: 'complete' }
          ],
          phaseMapping: {
            'GRF-01': 99  // Non-existent phase
          }
        },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      // Requirement should exist but not be linked to phase
      const req = result.nodes.find(n => n.id === 'req-grf-01');
      expect(req).toBeDefined();

      const reqLink = result.links.find(l => l.source === 'req-grf-01');
      expect(reqLink).toBeUndefined();
    });

    it('should add directory and file nodes from directory structure', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: {
          nodes: [
            {
              id: 'dir-planning',
              name: '.planning',
              type: 'directory',
              path: '',
              sourceType: 'planning'
            },
            {
              id: 'file-roadmap',
              name: 'ROADMAP.md',
              type: 'file',
              path: 'ROADMAP.md',
              extension: '.md',
              sourceType: 'planning'
            }
          ],
          links: [
            { source: 'dir-planning', target: 'file-roadmap', type: 'contains' }
          ]
        }
      };

      const result = buildGraph(projectData);

      const dirNode = result.nodes.find(n => n.id === 'dir-planning');
      expect(dirNode).toBeDefined();
      expect(dirNode.type).toBe('directory');
      expect(dirNode.sourceType).toBe('planning');

      const fileNode = result.nodes.find(n => n.id === 'file-roadmap');
      expect(fileNode).toBeDefined();
      expect(fileNode.type).toBe('file');
      expect(fileNode.extension).toBe('.md');
    });

    it('should add directory structure links', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: {
          nodes: [
            { id: 'dir-planning', name: '.planning', type: 'directory', path: '', sourceType: 'planning' },
            { id: 'file-roadmap', name: 'ROADMAP.md', type: 'file', path: 'ROADMAP.md', extension: '.md', sourceType: 'planning' }
          ],
          links: [
            { source: 'dir-planning', target: 'file-roadmap', type: 'contains' }
          ]
        }
      };

      const result = buildGraph(projectData);

      const dirLink = result.links.find(
        l => l.source === 'dir-planning' && l.target === 'file-roadmap'
      );
      expect(dirLink).toBeDefined();
      expect(dirLink.type).toBe('contains');
    });

    it('should link .planning root to project', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: {
          nodes: [
            { id: 'dir-planning', name: '.planning', type: 'directory', path: '', sourceType: 'planning' }
          ],
          links: []
        }
      };

      const result = buildGraph(projectData);

      const projectLink = result.links.find(
        l => l.source === 'project-root' && l.target === 'dir-planning'
      );
      expect(projectLink).toBeDefined();
      expect(projectLink.type).toBe('contains');
    });

    it('should deduplicate nodes by ID', () => {
      const projectData = {
        roadmap: {
          phases: [
            { id: 'phase-1', number: 1, name: 'Foundation', status: 'complete', goal: '', plans: [] }
          ]
        },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      // Count how many times 'phase-1' appears
      const phase1Nodes = result.nodes.filter(n => n.id === 'phase-1');
      expect(phase1Nodes).toHaveLength(1);

      // Count how many times 'project-root' appears
      const rootNodes = result.nodes.filter(n => n.id === 'project-root');
      expect(rootNodes).toHaveLength(1);
    });

    it('should handle empty project data', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      // Should at least have project root
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('project-root');
      expect(result.links).toHaveLength(0);
    });

    it('should handle missing phases gracefully', () => {
      const projectData = {
        roadmap: null,
        requirements: { requirements: [] },
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      // Should still create project root
      expect(result.nodes[0].id).toBe('project-root');
    });

    it('should handle missing requirements gracefully', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: null,
        directory: { nodes: [], links: [] }
      };

      const result = buildGraph(projectData);

      // Should still create project root
      expect(result.nodes[0].id).toBe('project-root');
    });

    it('should handle missing directory gracefully', () => {
      const projectData = {
        roadmap: { phases: [] },
        requirements: { requirements: [] },
        directory: null
      };

      const result = buildGraph(projectData);

      // Should still create project root
      expect(result.nodes[0].id).toBe('project-root');
    });

    it('should build complete graph with all components', () => {
      const projectData = {
        roadmap: {
          phases: [
            {
              id: 'phase-1',
              number: 1,
              name: 'Foundation',
              status: 'complete',
              goal: 'Build base',
              plans: [
                { id: 'plan-01-01', name: '01-01-PLAN.md', status: 'complete', description: 'Setup', file: '01-01-PLAN.md' }
              ]
            }
          ]
        },
        requirements: {
          requirements: [
            { id: 'req-grf-01', code: 'GRF-01', description: 'Display graph', category: 'GRF', status: 'complete' }
          ],
          phaseMapping: { 'GRF-01': 1 }
        },
        directory: {
          nodes: [
            { id: 'dir-planning', name: '.planning', type: 'directory', path: '', sourceType: 'planning' }
          ],
          links: []
        }
      };

      const result = buildGraph(projectData);

      // Should have: project-root, phase-1, plan-01-01, req-grf-01, dir-planning
      expect(result.nodes.length).toBeGreaterThanOrEqual(5);

      // Should have appropriate links
      expect(result.links.length).toBeGreaterThan(0);

      // Verify all node types exist
      expect(result.nodes.find(n => n.type === 'root')).toBeDefined();
      expect(result.nodes.find(n => n.type === 'phase')).toBeDefined();
      expect(result.nodes.find(n => n.type === 'plan')).toBeDefined();
      expect(result.nodes.find(n => n.type === 'requirement')).toBeDefined();
      expect(result.nodes.find(n => n.type === 'directory')).toBeDefined();
    });
  });
});
