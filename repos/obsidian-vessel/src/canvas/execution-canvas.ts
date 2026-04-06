import { App } from 'obsidian';
import {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  CanvasFileNode,
  CanvasTextNode,
  CanvasGroupNode
} from '../types/canvas';
import { ExecutionTrace } from '../types';
import { MetabobVesselSettings } from '../settings';

/**
 * Get cost from execution trace, handling both cost and cost_usd field names
 */
function getCost(execution: ExecutionTrace): number {
  return execution.cost ?? execution.cost_usd ?? 0;
}

type CanvasColor = '1' | '2' | '3' | '4' | '5' | '6' | string;
import { CanvasManager } from './canvas-manager';
import {
  HierarchicalLayout,
  TimelineLayout,
  RadialLayout,
  ForceDirectedLayout,
  LayoutEngine,
  Position
} from './layout-engines';

/**
 * Color mapping for execution status.
 * Obsidian canvas colors: 1=red, 2=orange, 3=yellow, 4=green, 5=cyan, 6=purple
 */
const STATUS_COLORS = {
  success: '4' as CanvasColor,      // Green
  failed: '1' as CanvasColor,       // Red
  partial: '3' as CanvasColor,      // Yellow
  inProgress: '5' as CanvasColor,   // Cyan
  pending: '2' as CanvasColor       // Orange
};

/**
 * Color mapping for activity categories.
 */
const CATEGORY_COLORS: Record<string, CanvasColor> = {
  feature: '4',        // Green
  bugfix: '1',         // Red
  refactor: '6',       // Purple
  tool: '5',           // Cyan
  infrastructure: '2'  // Orange
};

/**
 * Builds execution visualization canvases.
 * Displays execution traces as connected nodes in Obsidian canvas.
 */
export class ExecutionCanvasBuilder {
  private canvasManager: CanvasManager;

  constructor(
    private app: App,
    private settings: MetabobVesselSettings
  ) {
    this.canvasManager = new CanvasManager(app, settings);
  }

  /**
   * Build a canvas showing execution traces.
   */
  async buildExecutionCanvas(
    executions: ExecutionTrace[],
    name: string = 'executions'
  ): Promise<void> {
    if (executions.length === 0) {
      // Create empty canvas with placeholder
      const emptyCanvas: CanvasData = {
        nodes: [{
          id: 'empty-placeholder',
          type: 'text',
          x: 0,
          y: 0,
          width: 400,
          height: 100,
          text: '# No Executions\n\nNo execution traces to display. Run some activities to see them here.',
          color: '3'
        }],
        edges: []
      };
      await this.canvasManager.createOrUpdateCanvas(name, emptyCanvas);
      return;
    }

    const layout = this.getLayoutEngine();
    const positions = layout.calculate(executions);

    const nodes = this.createExecutionNodes(executions, positions);
    const edges = this.createSequentialEdges(executions);

    await this.canvasManager.createOrUpdateCanvas(name, { nodes, edges });
  }

  /**
   * Build a canvas grouped by activity.
   * Each activity is a group containing its executions.
   */
  async buildGroupedCanvas(
    executions: ExecutionTrace[],
    name: string = 'grouped-executions'
  ): Promise<void> {
    if (executions.length === 0) {
      await this.buildExecutionCanvas(executions, name);
      return;
    }

    const byActivity = this.groupByActivity(executions);
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    // Layout configuration
    const nodeWidth = 380;
    const nodeHeight = 180;
    const groupPadding = 40;
    const horizontalGap = 100;
    const verticalGap = 80;

    let currentX = 0;

    for (const [activityId, activityExecs] of byActivity) {
      // Sort executions by time
      activityExecs.sort((a, b) =>
        new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
      );

      // Calculate group dimensions
      const groupWidth = nodeWidth + groupPadding * 2;
      const groupHeight = activityExecs.length * (nodeHeight + verticalGap) - verticalGap + groupPadding * 2;

      // Create group node
      const templateName = activityExecs[0]?.template_name || activityId;
      const successRate = activityExecs.filter(e => e.success).length / activityExecs.length;

      nodes.push({
        id: `group-${activityId}`,
        type: 'group',
        x: currentX,
        y: 0,
        width: groupWidth,
        height: groupHeight,
        label: `${templateName} (${Math.round(successRate * 100)}% success)`,
        color: this.getSuccessRateColor(successRate)
      } as CanvasGroupNode);

      // Add execution nodes within group
      activityExecs.forEach((exec, index) => {
        const nodeX = currentX + groupPadding;
        const nodeY = groupPadding + index * (nodeHeight + verticalGap);

        nodes.push(this.createFileNode(exec, { x: nodeX, y: nodeY }, nodeWidth, nodeHeight));

        // Create edges between sequential executions within activity
        if (index > 0) {
          edges.push({
            id: `edge-${activityExecs[index - 1].execution_id}-${exec.execution_id}`,
            fromNode: activityExecs[index - 1].execution_id,
            toNode: exec.execution_id,
            fromSide: 'bottom',
            toSide: 'top',
            toEnd: 'arrow'
          });
        }
      });

      currentX += groupWidth + horizontalGap;
    }

    await this.canvasManager.createOrUpdateCanvas(name, { nodes, edges });
  }

  /**
   * Build a canvas with activity summary nodes.
   * Shows aggregated metrics per activity.
   */
  async buildSummaryCanvas(
    executions: ExecutionTrace[],
    name: string = 'activity-summary'
  ): Promise<void> {
    if (executions.length === 0) {
      await this.buildExecutionCanvas(executions, name);
      return;
    }

    const byActivity = this.groupByActivity(executions);
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    const nodeWidth = 400;
    const nodeHeight = 250;
    const gap = 100;
    const itemsPerRow = 3;

    let index = 0;
    for (const [activityId, activityExecs] of byActivity) {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;

      const summary = this.calculateActivitySummary(activityExecs);

      nodes.push({
        id: `summary-${activityId}`,
        type: 'text',
        x: col * (nodeWidth + gap),
        y: row * (nodeHeight + gap),
        width: nodeWidth,
        height: nodeHeight,
        text: this.formatActivitySummary(summary),
        color: this.getSuccessRateColor(summary.successRate)
      } as CanvasTextNode);

      index++;
    }

    await this.canvasManager.createOrUpdateCanvas(name, { nodes, edges });
  }

  /**
   * Update an existing canvas with new executions.
   */
  async updateCanvas(
    name: string,
    newExecutions: ExecutionTrace[]
  ): Promise<void> {
    const existing = await this.canvasManager.readCanvas(name);

    if (!existing) {
      await this.buildExecutionCanvas(newExecutions, name);
      return;
    }

    const layout = this.getLayoutEngine();

    // Get existing node IDs
    const existingIds = new Set(existing.nodes.map(n => n.id));

    // Filter to only new executions
    const actuallyNew = newExecutions.filter(e => !existingIds.has(e.execution_id));

    if (actuallyNew.length === 0) {
      return;
    }

    // Calculate positions for all executions (including existing)
    const allExecutions = [
      ...this.extractExecutionsFromNodes(existing.nodes),
      ...actuallyNew
    ];

    const positions = layout.calculate(allExecutions);

    // Create nodes only for new executions
    const newNodes = this.createExecutionNodes(actuallyNew, positions);

    // Create edges connecting new executions
    const newEdges = this.createSequentialEdges(allExecutions).filter(
      edge => !existing.edges.some(e => e.id === edge.id)
    );

    await this.canvasManager.mergeCanvas(name, {
      nodes: newNodes,
      edges: newEdges
    });
  }

  /**
   * Open the canvas in Obsidian.
   */
  async openCanvas(name: string): Promise<void> {
    await this.canvasManager.openCanvas(name);
  }

  /**
   * Get the configured layout engine.
   */
  private getLayoutEngine(): LayoutEngine {
    switch (this.settings.canvasLayout) {
      case 'timeline':
        return new TimelineLayout();
      case 'radial':
        return new RadialLayout();
      case 'force-directed':
        return new ForceDirectedLayout();
      case 'hierarchical':
      default:
        return new HierarchicalLayout();
    }
  }

  /**
   * Create canvas nodes for executions.
   */
  private createExecutionNodes(
    executions: ExecutionTrace[],
    positions: Map<string, Position>
  ): CanvasNode[] {
    return executions.map(exec => {
      const pos = positions.get(exec.execution_id) || { x: 0, y: 0 };
      return this.createFileNode(exec, pos);
    });
  }

  /**
   * Create a file node for an execution.
   */
  private createFileNode(
    exec: ExecutionTrace,
    pos: Position,
    width: number = 400,
    height: number = 200
  ): CanvasFileNode {
    return {
      id: exec.execution_id,
      type: 'file',
      x: pos.x,
      y: pos.y,
      width,
      height,
      file: this.getNotePath(exec),
      color: this.getStatusColor(exec)
    };
  }

  /**
   * Get the note path for an execution trace.
   */
  private getNotePath(exec: ExecutionTrace): string {
    const date = new Date(exec.executed_at).toISOString().split('T')[0];
    return `${this.settings.executionNotesFolder}/${date}/${exec.execution_id}.md`;
  }

  /**
   * Get color based on execution status.
   */
  private getStatusColor(exec: ExecutionTrace): CanvasColor {
    if (exec.success) {
      return STATUS_COLORS.success;
    }

    // Partial success: some tasks completed
    if (exec.tasks_completed && exec.tasks_total && exec.tasks_completed > 0 && exec.tasks_completed < exec.tasks_total) {
      return STATUS_COLORS.partial;
    }

    return STATUS_COLORS.failed;
  }

  /**
   * Get color based on success rate.
   */
  private getSuccessRateColor(rate: number): CanvasColor {
    if (rate >= 0.8) return '4';      // Green
    if (rate >= 0.5) return '3';      // Yellow
    if (rate >= 0.2) return '2';      // Orange
    return '1';                        // Red
  }

  /**
   * Create edges based on execution sequence.
   */
  private createSequentialEdges(executions: ExecutionTrace[]): CanvasEdge[] {
    const edges: CanvasEdge[] = [];

    // Sort by timestamp
    const sorted = [...executions].sort((a, b) =>
      new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
    );

    // Connect sequential executions
    for (let i = 0; i < sorted.length - 1; i++) {
      edges.push({
        id: `edge-${sorted[i].execution_id}-${sorted[i + 1].execution_id}`,
        fromNode: sorted[i].execution_id,
        toNode: sorted[i + 1].execution_id,
        fromSide: 'right',
        toSide: 'left',
        toEnd: 'arrow'
      });
    }

    return edges;
  }

  /**
   * Group executions by activity ID.
   */
  private groupByActivity(executions: ExecutionTrace[]): Map<string, ExecutionTrace[]> {
    const grouped = new Map<string, ExecutionTrace[]>();

    for (const exec of executions) {
      const list = grouped.get(exec.activity_id) || [];
      list.push(exec);
      grouped.set(exec.activity_id, list);
    }

    return grouped;
  }

  /**
   * Calculate summary metrics for an activity.
   */
  private calculateActivitySummary(executions: ExecutionTrace[]): ActivitySummary {
    const successful = executions.filter(e => e.success);

    return {
      activityId: executions[0]?.activity_id || '',
      templateName: executions[0]?.template_name || 'Unknown',
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      successRate: successful.length / executions.length,
      totalDurationMs: executions.reduce((sum, e) => sum + (e.duration_ms || 0), 0),
      avgDurationMs: executions.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / executions.length,
      totalCostUsd: executions.reduce((sum, e) => sum + getCost(e), 0),
      lastExecutedAt: executions.reduce((latest, e) =>
        new Date(e.executed_at) > new Date(latest) ? e.executed_at : latest,
        executions[0]?.executed_at || ''
      )
    };
  }

  /**
   * Format activity summary as markdown.
   */
  private formatActivitySummary(summary: ActivitySummary): string {
    return `# ${summary.templateName}

## Metrics
- **Executions**: ${summary.totalExecutions}
- **Success Rate**: ${Math.round(summary.successRate * 100)}%
- **Avg Duration**: ${Math.round(summary.avgDurationMs / 1000)}s
- **Total Cost**: $${summary.totalCostUsd.toFixed(4)}

## Timeline
- **Last Run**: ${new Date(summary.lastExecutedAt).toLocaleString()}

---
*Activity ID: ${summary.activityId}*`;
  }

  /**
   * Extract execution data from existing canvas nodes.
   * Used for incremental updates.
   */
  private extractExecutionsFromNodes(nodes: CanvasNode[]): ExecutionTrace[] {
    // This is a simplified extraction - in practice you'd need
    // to fetch full execution data from the API
    return nodes
      .filter((n): n is CanvasFileNode => n.type === 'file')
      .map(n => ({
        execution_id: n.id,
        activity_id: '', // Would need to be extracted from note
        template_id: '',
        template_name: '',
        success: n.color === STATUS_COLORS.success,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        cost: 0,
        tasks_completed: 0,
        tasks_total: 0
      }));
  }
}

/**
 * Summary metrics for an activity.
 */
interface ActivitySummary {
  activityId: string;
  templateName: string;
  totalExecutions: number;
  successfulExecutions: number;
  successRate: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalCostUsd: number;
  lastExecutedAt: string;
}
