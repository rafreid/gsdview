# Features Research: Workflow Diagram Visualization

**Feature Area:** Workflow diagram view for GSD Viewer v1.5
**Researched:** 2026-01-28
**Confidence:** HIGH (comprehensive ecosystem survey, real tool examples, integration with existing features)

## Summary

Workflow diagram visualizations in developer tools (CI/CD pipelines, project management, process automation) share common UX patterns: left-to-right or top-to-bottom flow, status-coded nodes, expand/collapse for nested content, and synchronized multi-view coordination. For GSD Viewer v1.5, the workflow diagram must integrate with existing 3D graph features while providing a clearer, stage-oriented view of the GSD process (Initialize → Discuss → Plan → Execute → Verify → Complete). Key differentiators include "why it works" visual indicators (context usage, parallel lanes, atomic commits) that educate users on GSD methodology while showing project status.

## Table Stakes

Features users expect in workflow diagram visualizations. Missing = diagram feels incomplete or broken.

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| **Left-to-right pipeline flow** | Stages arranged horizontally: Initialize → Discuss → Plan → Execute → Verify → Complete | Low | None - foundational layout |
| **Stage containers with labels** | Visual blocks for each workflow stage with clear names | Low | None - basic SVG/DOM structure |
| **Status indicators per stage** | Color-coded completion state (done=green, in-progress=yellow, missing=gray) | Low | Existing status logic from graph-builder.js |
| **Artifact blocks within stages** | Nested blocks showing files (CONTEXT.md, RESEARCH.md, plans) per stage | Medium | Directory parser integration |
| **Connection lines between stages** | Arrows/paths showing sequential flow between stages | Low | SVG path rendering |
| **Click to select artifact** | Click artifact block to highlight/select it | Low | Event handlers + state management |
| **Hover tooltips** | Hover over artifact shows filename, status, last modified | Low | Tooltip component (may exist from graph) |
| **Current stage highlighting** | Active/current workflow stage visually emphasized (glow, bold border) | Low | STATE.md parser for current phase |
| **Expand/collapse stage detail** | Click stage header to show/hide artifact blocks | Medium | Collapse state management, animation |
| **Scroll/pan support** | Diagram can be panned horizontally if stages don't fit viewport | Low | CSS overflow or drag handlers |
| **Responsive stage sizing** | Stage blocks size dynamically based on content (more artifacts = taller) | Medium | Layout calculation based on artifact count |

## Differentiators

Features that set GSD Viewer's diagram apart. Not expected, but provide competitive advantage or unique value.

| Feature | Description | Complexity | Dependencies |
|---------|-------------|------------|--------------|
| **"Why it works" visual indicators** | Overlays showing GSD methodology benefits: context window usage bars, parallel agent swimlanes, atomic commit markers | High | New visualization layer + GSD process understanding |
| **Context window usage bars** | Per-stage bar chart showing how much of 200K token context used (from CONTEXT.md size) | Medium | CONTEXT.md parser, file size calculation, bar chart component |
| **Parallel agent lanes/swimlanes** | Horizontal lanes showing multi-agent parallel work (research, planning, execution happening simultaneously) | High | STATE.md parser for concurrent tasks, swimlane layout algorithm |
| **Atomic commit markers** | Visual indicators on Execute stage showing commit boundaries, linking to git commits | Medium | Git integration (already exists), commit node mapping |
| **Two-way sync with 3D graph** | Select artifact in diagram → fly to node in 3D graph; select node in graph → highlight in diagram | High | Shared selection state, bidirectional event handlers, graph camera control |
| **Drill-down to phase detail** | Click expanded stage opens full phase ROADMAP or REQUIREMENTS view | Medium | Modal system (already exists from inspector), phase file parser |
| **Artifact completion progress ring** | Circular progress indicator per stage showing % of required artifacts completed | Medium | Artifact requirements definition, progress calculation |
| **Timeline replay in diagram view** | Activity timeline scrubber updates diagram to show historical artifact state | High | Timeline system (already exists), historical state reconstruction |
| **Diagram export (SVG/PNG)** | Export current diagram view as image for documentation | Medium | SVG serialization or canvas snapshot |
| **Live update on file change** | Diagram reflects file changes in real-time (artifact status updates, flash animations) | Medium | File watcher integration (already exists), incremental diagram update |
| **Minimap for diagram navigation** | Small overview showing full diagram with viewport indicator | Medium | Minimap component (already exists), adapt for diagram view |
| **Phase bookmarks in diagram** | Jump to specific stage using keyboard shortcuts (same 1-9 bookmarks as graph) | Low | Bookmark system (already exists), stage scroll/pan logic |

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain.

| Feature | Why NOT to build |
|---------|------------------|
| **Editable diagram (drag to reorder stages)** | GSD workflow is a fixed process model. Allowing reordering breaks the methodology and confuses users about the prescribed flow. |
| **Freeform flowchart editor** | Users don't design the workflow — GSD defines it. Adding editor features creates complexity without value. |
| **Vertical swimlanes (one lane per file)** | Creates visual noise. With dozens of files, vertical lanes become unreadable. Horizontal stages + nested blocks is clearer. |
| **Animation-heavy transitions** | Excessive animations (bouncing, spinning, elaborate transitions) distract from information. Keep it crisp and responsive. |
| **Everything expanded by default** | Showing all artifacts for all stages at once overwhelms users. Start collapsed, allow progressive disclosure. |
| **Detailed artifact content preview** | Don't show file contents inline in diagram blocks. That's what the inspector modal is for. Keep diagram high-level. |
| **Parallel branch visualization (git-style)** | GSD doesn't use feature branches. Avoid git-graph-style branching visuals — they don't match the workflow model. |
| **Auto-layout algorithms (force-directed, hierarchical)** | Stages have a fixed left-to-right order. Don't use graph layout algorithms — they create unstable, confusing layouts. |
| **Per-artifact status badges everywhere** | Too many status badges create visual noise. Use stage-level indicators primarily, artifact-level only on hover/expand. |
| **Zoom in/out like 3D graph** | 2D diagrams don't need zoom. Use scroll/pan only. Zooming creates layout inconsistencies and confusion. |

## UX Patterns Observed

### Pattern 1: CI/CD Pipeline Visualizations

**GitHub Actions (2026):**
- Jobs displayed as boxes with status colors (green/red/yellow)
- Steps listed vertically within job boxes
- Parallel jobs shown side-by-side at same vertical level
- Improved rendering for 300+ job workflows planned
- Metadata and deep-linking for investigation
- **Takeaway:** Status-first, box-per-stage, clear parallelism

**GitLab CI:**
- Pipeline visualizations show stages and jobs with needs relationships as connecting lines
- Multi-project pipeline graphs visualize cross-project dependencies in one place
- CI/CD analytics provide health metrics directly in UI
- **Takeaway:** Dependency-aware connections, multi-level hierarchy, integrated analytics

**Best Practices from CI/CD:**
- Visual blocks per stage with clear labels
- Status color-coding (green=pass, yellow=running, red=fail, gray=pending)
- Connecting arrows show flow direction
- Metadata available on hover/click
- Support for parallel execution visualization

### Pattern 2: Swimlane Diagrams

**Structure:**
- Parallel horizontal lanes for roles/teams/systems
- Tasks vertically aligned when they occur simultaneously
- Connecting arrows show flow and dependencies
- Lanes labeled clearly to show organization

**When to Use:**
- Multiple actors/agents working in parallel
- Cross-functional workflows
- Responsibility tracking

**Application to GSD:**
- Horizontal lanes could show parallel agent work (researcher, planner, executor)
- Vertical alignment shows concurrent operations
- Clear labeling distinguishes which agent handles which stage

**Caveat:**
- Avoid one lane per file (too many lanes = visual noise)
- Use lanes for agents/roles, not artifacts

### Pattern 3: Expand/Collapse Interactions

**Icon Conventions:**
- ▸ (right-pointing triangle) = collapsed
- ▾ (down-pointing triangle) = expanded
- Alternative: + / - symbols
- Alternative: ► / ▼ symbols

**Best Practices:**
- Clear visual state change when expanded/collapsed
- Smooth animation (200-300ms) to preserve mental map
- "Expand All" / "Collapse All" controls for nested structures
- Avoid nested accordions on small screens (hard to scan)

**Application to GSD:**
- Stage headers have expand/collapse icon
- Click header toggles artifact visibility
- Start with all stages collapsed (overview first)
- Expand current/in-progress stage by default

### Pattern 4: Status Visualization

**Kanban Boards:**
- Columns represent status (To Do, In Progress, Done)
- Color-coded cards with status indicators
- Real-time task tracking with visual updates
- **Takeaway:** Color = status, position = stage, movement = progress

**Cumulative Flow Diagrams:**
- Color spans show task counts through workflow stages
- X-axis = time, Y-axis = cumulative tasks
- Color indicates outcome (green=completed, red=failed)
- **Takeaway:** Color-coded spans, time-based progression, cumulative metrics

**Progress Indicators:**
- Circular progress rings show % complete
- Dashboard views aggregate activity across stages
- Heat maps highlight recent activity with color intensity
- **Takeaway:** Percentage visualization, aggregation, recency indication

**Application to GSD:**
- Per-stage progress ring (% of required artifacts complete)
- Color-coded artifact blocks (green/yellow/gray)
- Heat map overlay for recent activity (already implemented)

### Pattern 5: Interactive Flowchart Behavior

**Click Interactions:**
- Click shape → show details popup
- Click shape → navigate to related content
- Click shape → expand nested content
- Double-click → drill down to detail view

**Hover Interactions:**
- Hover → tooltip with metadata
- Hover → subtle highlight/glow (gentle color change)
- Hover → show connected elements
- Avoid: hover-to-open (prefer click-to-open for stability)

**Selection States:**
- Selected element has distinct visual treatment (bold border, glow)
- Deselect by clicking background or pressing Escape
- Multi-select not common in workflow diagrams (single focus)

**Application to GSD:**
- Click artifact → select, highlight in graph
- Double-click artifact → open inspector modal (existing pattern)
- Hover artifact → tooltip with filename, status, timestamp
- Click stage header → expand/collapse

### Pattern 6: Multi-View Synchronization

**Coordination Patterns:**
- Selection in one view highlights in other views
- Shared state via coordination model (coordination types, scopes, views)
- Model change listeners propagate updates bidirectionally
- Synchronous updates maintain consistency

**Tree + Diagram Sync (yFiles, GoJS):**
- Dual model approach: TreeModel for tree, GraphModel for diagram
- Change listener on each model updates the other
- Shared node IDs enable cross-referencing

**Application to GSD:**
- Diagram uses same node IDs as 3D graph
- Shared selection state via Electron store or IPC
- Click artifact in diagram → graph.setCameraPosition(node)
- Click node in graph → diagram.scrollToArtifact(node.id)

### Pattern 7: Complexity Management

**From Flowchart Usability Research:**

**Common Problems:**
- Too many connections = visual noise, flow lost
- Too much detail = overcrowded, unreadable
- Disorganized layout = hard to follow
- Everything on one page = overwhelming

**Solutions:**
- Break complex processes into smaller, linked diagrams
- Use progressive disclosure (expand/collapse)
- Start with overview, allow drill-down
- Limit visible elements to 7±4 (cognitive load principle)
- Clear visual hierarchy (primary vs secondary information)

**Application to GSD:**
- Start with 6 stage blocks (manageable count)
- Artifacts hidden by default (progressive disclosure)
- Drill-down to phase detail via modal (not inline)
- Limit initial visual complexity to stage-level overview

## Dependency Notes

### Existing GSD Viewer Features to Leverage

| Existing Feature | How Diagram Uses It |
|------------------|---------------------|
| **graph-builder.js** | Parse project data into nodes — reuse status logic, artifact metadata |
| **File watcher + flash animations** | Diagram artifacts flash on file change, matching graph behavior |
| **Inspector modal** | Click artifact in diagram → open inspector (same double-click as graph) |
| **Git integration** | Commit markers in Execute stage, staged/modified indicators on artifacts |
| **Activity feed** | Timeline replay updates diagram state based on historical activity |
| **Minimap component** | Adapt for diagram view — overview of horizontal stage flow |
| **Bookmarks (1-9)** | Jump to specific workflow stage using same keyboard shortcuts |
| **Settings/persistence** | Diagram view preferences (collapsed stages, view mode) persist via electron-store |
| **Two-way sync pattern** | Tree ↔ Graph sync already implemented — extend to Diagram ↔ Graph |

### New Components Required

| Component | Purpose | Complexity |
|-----------|---------|------------|
| **Diagram layout engine** | Calculate stage positions, artifact placement, connection paths | Medium |
| **Stage container component** | Expandable/collapsible stage block with artifact list | Low |
| **Context usage bar chart** | Visualize token context consumption per stage | Low |
| **Swimlane overlay** | Show parallel agent work across stages | Medium |
| **View toggle (Graph/Diagram)** | Switch between 3D graph and 2D diagram views | Low |
| **Diagram-graph sync manager** | Coordinate selection state between views | Medium |

## Implementation Notes

### Recommended Library: React Flow (or vanilla SVG)

**If using React Flow:**
- Performance-optimized for large diagrams
- Built-in node/edge components
- Layout algorithms available (Dagre, Elkjs)
- Interactive behaviors (drag, select, zoom)
- Caveat: GSD stages are fixed order, don't need auto-layout

**If using vanilla SVG:**
- Full control over rendering
- Simpler dependency graph
- Fixed layout = no need for complex library
- Direct DOM manipulation via existing renderer.js

**Recommendation:**
- Start with vanilla SVG (GSD has fixed flow, low complexity)
- Upgrade to React Flow if interactivity becomes complex
- Reuse existing 3d-force-graph rendering patterns

### Stage Mapping to GSD Process

| Stage | GSD Phase | Key Artifacts | Status Logic |
|-------|-----------|---------------|--------------|
| Initialize | Project setup | PROJECT.md, config.json | Required files exist |
| Discuss | Problem definition | CONTEXT.md, problem statement | Files present + not empty |
| Plan | Milestone planning | ROADMAP.md, REQUIREMENTS.md | Phase count > 0 |
| Execute | Implementation | Plans in .planning/phases/, code in src/ | Plans marked done |
| Verify | Testing/review | Test files, SUMMARY.md | Tests pass, summary written |
| Complete | Finalization | Shipped milestone, updated STATE.md | Milestone marked shipped |

### Artifact Status Detection

```javascript
// Pseudocode for artifact status
function getArtifactStatus(artifact, projectData) {
  if (!fileExists(artifact.path)) return 'missing';
  if (artifact.inProgress) return 'in-progress';
  if (artifact.completed) return 'done';
  return 'pending';
}

// Stage status = aggregate of artifacts
function getStageStatus(stage) {
  const artifacts = getStageArtifacts(stage);
  if (artifacts.every(a => a.status === 'done')) return 'done';
  if (artifacts.some(a => a.status === 'in-progress')) return 'in-progress';
  if (artifacts.every(a => a.status === 'missing')) return 'missing';
  return 'partial';
}
```

## Complexity Assessment

| Feature Category | Overall Complexity | Rationale |
|------------------|-------------------|-----------|
| **Basic diagram layout** | Low | Fixed horizontal stages, standard DOM/SVG rendering |
| **Artifact blocks + status** | Low | Reuse existing parsers, simple color-coding |
| **Expand/collapse** | Medium | State management, animation, responsive layout |
| **Two-way sync with graph** | High | Bidirectional event propagation, coordinate systems differ (2D ↔ 3D) |
| **"Why it works" indicators** | High | New visualization concepts, requires deep GSD understanding |
| **Timeline replay in diagram** | High | Historical state reconstruction, incremental updates |

## MVP Recommendation

For v1.5 MVP, prioritize:

### Must Have (Table Stakes)
1. **Basic diagram layout** — Horizontal stage flow (Initialize → Complete)
2. **Stage containers** — Visual blocks with labels and status colors
3. **Artifact blocks** — Nested file indicators within stages
4. **Status indicators** — Color-coded completion state per artifact and stage
5. **Expand/collapse stages** — Progressive disclosure of artifact detail
6. **Connection lines** — Arrows showing stage-to-stage flow
7. **Hover tooltips** — Artifact metadata on hover

### Should Have (High-Value Differentiators)
8. **Click artifact → inspect** — Open file inspector modal (existing)
9. **Click artifact → sync graph** — Fly to node in 3D graph
10. **Live file updates** — Diagram reflects changes via file watcher
11. **View toggle** — Switch between Graph and Diagram views
12. **Current stage highlight** — Visual emphasis on active workflow stage

### Nice to Have (Defer to Post-MVP)
- **Timeline replay in diagram** — Complex historical state logic
- **Parallel agent swimlanes** — Requires multi-agent execution detection
- **Context usage bars** — Nice-to-have, not critical for core functionality
- **Diagram export (SVG/PNG)** — Useful but not essential for internal tool
- **Progress rings per stage** — Polish feature, can add incrementally
- **Minimap adaptation** — Existing minimap works for graph, diagram can wait

### Explicitly Defer
- **Editable diagram** — Anti-feature (fixed GSD workflow)
- **Freeform flowchart editor** — Out of scope
- **Zoom in/out** — Not needed for 2D diagram (scroll/pan sufficient)

## Sources

### Developer Tool Visualizations
- [GitHub Actions Workflow Visualization](https://docs.github.com/actions/managing-workflow-runs/using-the-visualization-graph)
- [GitHub Actions UX Improvements 2026](https://github.blog/news-insights/product-news/lets-talk-about-github-actions/)
- [GitLab Pipeline Editor Visualization](https://docs.gitlab.com/ci/pipeline_editor/)
- [GitLab Multi-Project Pipeline Graphs](https://gitlab.lcqb.upmc.fr/help/ci/multi_project_pipeline_graphs.md)

### Workflow Diagram Patterns
- [Flowcharts for Project Managers 2026](https://www.invensislearning.com/blog/flowcharts-for-project-managers/)
- [Workflow Diagram Examples 2026](https://thedigitalprojectmanager.com/productivity/workflow-examples/)
- [Workflow Visualization Guide - Creately](https://creately.com/guides/workflow-visualization/)
- [CI/CD Pipeline Visualization - Codefresh](https://codefresh.io/learn/ci-cd-pipelines/ci-cd-process-flow-stages-and-critical-best-practices/)

### Swimlanes and Parallel Execution
- [Understanding Swimlane Diagrams - Atlassian](https://www.atlassian.com/work-management/project-management/project-planning/swimlane-diagram)
- [What is a Swimlane Diagram - Miro](https://miro.com/diagramming/what-is-a-swimlane-diagram/)
- [Parallel Activity in Swimlanes - ConceptDraw](https://www.conceptdraw.com/examples/parallel-activity-in-flow-chart)

### Expand/Collapse UX
- [React Flow Expand/Collapse Example](https://reactflow.dev/examples/layout/expand-collapse)
- [Accordion Pattern - UX Patterns](https://uxpatterns.dev/patterns/content-management/accordion)
- [Expander Control Animation - Microsoft Power Platform](https://powerapps.microsoft.com/en-us/blog/ux-patterns-expander-control-with-expand-collapse-animation/)
- [Collapsing Subtrees in Diagrams - yWorks](https://www.yworks.com/pages/collapsing-subtrees-in-diagrams)

### Status Visualization
- [Workflow Diagram Status Indicators - Asana](https://asana.com/resources/workflow-diagram)
- [Cumulative Flow Diagram - ClickUp](https://clickup.com/blog/cumulative-flow-diagram/)
- [15 Popular Project Management Charts 2026](https://niftypm.com/blog/project-charts/)

### Interactive Flowchart Behavior
- [Interactive Flowchart Maker - Vexlio](https://vexlio.com/solutions/interactive-flowchart-maker/)
- [GoJS Interactive Flowchart Sample](https://gojs.net/latest/samples/flowchart.html)
- [Ant Design Charts - Graphs Overview](https://ant-design-charts.antgroup.com/en/components/graphs/overview)

### Multi-View Synchronization
- [Multiple and Coordinated Views in Information Visualization](https://www.researchgate.net/publication/242186774_Multiple_and_Coordinated_Views_in_Information_Visualization)
- [Coordinated Multiple Views - Vitessce](http://vitessce.io/docs/coordination/)
- [Tree View Synchronization - GoJS](https://hyipworld.github.io/maps/samples/regroupingTreeView.html)

### Implementation Libraries
- [React Flow Examples](https://reactflow.dev/examples)
- [React Flow Best Practices 2026](https://www.synergycodes.com/blog/react-flow-everything-you-need-to-know)
- [Building Workflow Editor with React Flow](https://medium.com/pinpoint-engineering/part-2-building-a-workflow-editor-with-react-flow-a-guide-to-auto-layout-and-complex-node-1aadae67a3a5)
- [D3.js Official Documentation](https://d3js.org/)
- [D3 Graph Gallery](https://d3-graph-gallery.com/)

### Anti-Patterns and Complexity Management
- [BPMN Anti-Patterns - Modern Analyst](https://www.modernanalyst.com/Resources/Articles/tabid/115/ID/2438/Efficient-BPMN-from-Anti-Patterns-to-Best-Practices.aspx)
- [Workflow Design Anti-Patterns - Fluent Commerce](https://docs.fluentcommerce.com/essential-knowledge/workflow-design-anti-patterns)
- [Data-Flow Anti-Patterns in Workflows (PDF)](https://www.vdaalst.com/publications/p514.pdf)
- [Flowcharts Too Complex - Mermaid Chart](https://docs.mermaidchart.com/blog/posts/flow-charts-are-on2-complex-so-dont-go-over-100-connections)
- [Common Flowchart Mistakes - Creately](https://creately.com/blog/software-teams/part-1-15-mistakes-you-would-unintentionally-make-with-flowcharts/)
- [Keep it Simple - Flowchart Rules - Nulab](https://nulab.com/learn/design-and-ux/keep-it-simple-follow-flowchart-rules-for-better-diagrams/)
