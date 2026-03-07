#!/usr/bin/env ts-node
/**
 * Activity Invocation Mapping Generator
 * 
 * Generates a comprehensive mapping of:
 * - Activity invocations with full execution history
 * - Impulses used and created
 * - Task executions with outcomes
 * - Template variants and compositions
 * - Cost and token metrics
 * - Tool usage patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ActivityExecution {
  id: string;
  templateId: string;
  templateVersion: number;
  title: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  duration: number;
  
  // Core metadata
  directory: string;
  branch: string;
  baseCommit: string;
  
  // Variables and reason
  variables: Record<string, any>;
  reason: string;
  
  // Selection info
  selection_reason?: {
    method: string;
    selectedId: string;
    variant: string;
  };
  
  // Execution evidence
  executionEvidence: {
    sessionsSpawned: Array<{
      sessionID: string;
      taskId: string;
      agentType: string;
      startTime: number;
      endTime: number;
      messageCount: number;
      toolCallCount: number;
    }>;
    toolCalls: Array<{
      sessionID: string;
      tool: string;
      timestamp: number;
    }>;
  };
  
  // Stats
  stats: {
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
    cost: {
      total: number;
      perPrompt: number[];
    };
    metabob: {
      enabled: boolean;
      issuesResolved: number;
      issuesAdded: number;
      totalParticipations: number;
      totalContextTokens: number;
    };
    duration: number;
  };
  
  // Impulses
  impulses: Record<string, any>;
  
  // Work artifacts
  workArtifacts: {
    filesChanged: string[];
    commitsMade: string[];
  };
  
  // Correctness
  correctnessVerdict?: {
    computed: boolean;
    verdict: string;
    confidence: number;
    issues: Array<{
      severity: string;
      category: string;
      message: string;
    }>;
  };
  
  // Sessions and commits
  sessionIDs: string[];
  commits: string[];
  agentsUsed: string[];
  acpAgents: any[];
}

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  
  version: {
    timestamp: number;
    parent_hash: string;
    variant_hash: string;
    full_version: string;
    generation: number;
  };
  
  genealogy: {
    created_at: number;
    parent_id: string;
    variant_hash: string;
    generation: number;
    evolution: {
      reason: string;
      improvised: boolean;
      author: string;
      notes: string;
    };
    variant_ids: string[];
  };
  
  executions: number;
  successRate: number;
  avgDuration: number;
  avgCost: number;
  avgTokens: {
    input: number;
    output: number;
    cache: number;
  };
  
  tasks: Array<{
    id: string;
    subagent: string;
    description: string;
    dependencies: string[];
    tools: {
      required: string[];
      optional: string[];
      disabled: string[];
    };
    prompt: {
      template: string;
      maxTokens: number;
      compressionStrategy: string;
      variables: any[];
    };
    validation: {
      requiredFiles: string[];
      requiredPatterns: string[];
      forbiddenPatterns: string[];
      commands: string[];
    };
    retry: {
      maxAttempts: number;
      strategy: string;
    };
    metrics: {
      successRate: number;
      avgTokens: number;
      avgDuration: number;
      commonFailures: string[];
    };
  }>;
  
  candidateIds: string[];
  allocationWeight: number;
}

interface ActivityMapping {
  summary: {
    totalExecutions: number;
    totalTemplates: number;
    totalCost: number;
    totalTokens: number;
    totalDuration: number;
    avgSuccessRate: number;
    dateRange: {
      earliest: number;
      latest: number;
    };
  };
  
  executionsByTemplate: Record<string, {
    template: ActivityTemplate;
    executions: ActivityExecution[];
    totalCost: number;
    totalTokens: number;
    successCount: number;
    failureCount: number;
  }>;
  
  impulsesUsed: Record<string, {
    count: number;
    activities: string[];
  }>;
  
  toolUsagePatterns: Record<string, {
    count: number;
    activities: string[];
  }>;
  
  compositionPatterns: Array<{
    activityId: string;
    nestedActivities: string[];
    depth: number;
  }>;
}

class ActivityMappingGenerator {
  private storagePath: string;
  private activityPath: string;
  private templatePath: string;
  
  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.storagePath = path.join(homeDir, '.local/share/opencode/storage');
    this.activityPath = path.join(this.storagePath, 'activity');
    this.templatePath = path.join(this.storagePath, 'activity-template');
  }
  
  /**
   * Load all activity executions from storage
   */
  loadActivityExecutions(): ActivityExecution[] {
    const executions: ActivityExecution[] = [];
    
    if (!fs.existsSync(this.activityPath)) {
      console.warn(`Activity path not found: ${this.activityPath}`);
      return executions;
    }
    
    // Load activity JSON files
    const files = fs.readdirSync(this.activityPath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.activityPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const activity = JSON.parse(content) as ActivityExecution;
          executions.push(activity);
        } catch (err) {
          console.warn(`Failed to parse ${file}:`, err);
        }
      }
    }
    
    // Also load from subdirectories
    for (const file of files) {
      const filePath = path.join(this.activityPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subFiles = fs.readdirSync(filePath);
        for (const subFile of subFiles) {
          if (subFile.endsWith('.json')) {
            const subFilePath = path.join(filePath, subFile);
            try {
              const content = fs.readFileSync(subFilePath, 'utf-8');
              const activity = JSON.parse(content) as ActivityExecution;
              executions.push(activity);
            } catch (err) {
              console.warn(`Failed to parse ${subFile}:`, err);
            }
          }
        }
      }
    }
    
    return executions;
  }
  
  /**
   * Load all activity templates
   */
  loadActivityTemplates(): Record<string, ActivityTemplate> {
    const templates: Record<string, ActivityTemplate> = {};
    
    if (!fs.existsSync(this.templatePath)) {
      console.warn(`Template path not found: ${this.templatePath}`);
      return templates;
    }
    
    const files = fs.readdirSync(this.templatePath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.templatePath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const template = JSON.parse(content) as ActivityTemplate;
          templates[template.id] = template;
        } catch (err) {
          console.warn(`Failed to parse template ${file}:`, err);
        }
      }
    }
    
    return templates;
  }
  
  /**
   * Generate comprehensive mapping
   */
  generateMapping(): ActivityMapping {
    const executions = this.loadActivityExecutions();
    const templates = this.loadActivityTemplates();
    
    console.log(`Loaded ${executions.length} executions and ${Object.keys(templates).length} templates`);
    
    const mapping: ActivityMapping = {
      summary: {
        totalExecutions: executions.length,
        totalTemplates: Object.keys(templates).length,
        totalCost: 0,
        totalTokens: 0,
        totalDuration: 0,
        avgSuccessRate: 0,
        dateRange: {
          earliest: Number.MAX_SAFE_INTEGER,
          latest: 0,
        },
      },
      executionsByTemplate: {},
      impulsesUsed: {},
      toolUsagePatterns: {},
      compositionPatterns: [],
    };
    
    // Group executions by template
    for (const execution of executions) {
      const templateId = execution.templateId;
      
      if (!mapping.executionsByTemplate[templateId]) {
        mapping.executionsByTemplate[templateId] = {
          template: templates[templateId],
          executions: [],
          totalCost: 0,
          totalTokens: 0,
          successCount: 0,
          failureCount: 0,
        };
      }
      
      const group = mapping.executionsByTemplate[templateId];
      group.executions.push(execution);
      group.totalCost += execution.stats.cost.total;
      group.totalTokens += execution.stats.tokens.input + execution.stats.tokens.output;
      
      if (execution.status === 'done' || execution.status === 'completed') {
        group.successCount++;
      } else {
        group.failureCount++;
      }
      
      // Update summary
      mapping.summary.totalCost += execution.stats.cost.total;
      mapping.summary.totalTokens += execution.stats.tokens.input + execution.stats.tokens.output;
      mapping.summary.totalDuration += execution.stats.duration;
      
      if (execution.startedAt < mapping.summary.dateRange.earliest) {
        mapping.summary.dateRange.earliest = execution.startedAt;
      }
      if (execution.startedAt > mapping.summary.dateRange.latest) {
        mapping.summary.dateRange.latest = execution.startedAt;
      }
      
      // Track impulses
      for (const impulseId of Object.keys(execution.impulses)) {
        if (!mapping.impulsesUsed[impulseId]) {
          mapping.impulsesUsed[impulseId] = { count: 0, activities: [] };
        }
        mapping.impulsesUsed[impulseId].count++;
        mapping.impulsesUsed[impulseId].activities.push(execution.id);
      }
      
      // Track tool usage
      for (const toolCall of execution.executionEvidence?.toolCalls || []) {
        if (!mapping.toolUsagePatterns[toolCall.tool]) {
          mapping.toolUsagePatterns[toolCall.tool] = { count: 0, activities: [] };
        }
        mapping.toolUsagePatterns[toolCall.tool].count++;
        if (!mapping.toolUsagePatterns[toolCall.tool].activities.includes(execution.id)) {
          mapping.toolUsagePatterns[toolCall.tool].activities.push(execution.id);
        }
      }
      
      // Detect composition patterns (nested activities)
      const nestedActivities = (execution.executionEvidence?.toolCalls || [])
        .filter(tc => tc.tool === 'activity')
        .map(tc => tc.sessionID);
      
      if (nestedActivities.length > 0) {
        mapping.compositionPatterns.push({
          activityId: execution.id,
          nestedActivities,
          depth: nestedActivities.length,
        });
      }
    }
    
    // Calculate average success rate
    const totalSuccess = Object.values(mapping.executionsByTemplate).reduce(
      (sum, group) => sum + group.successCount,
      0
    );
    mapping.summary.avgSuccessRate = executions.length > 0 ? totalSuccess / executions.length : 0;
    
    return mapping;
  }
  
  /**
   * Generate Markdown report
   */
  generateMarkdownReport(mapping: ActivityMapping): string {
    const md: string[] = [];
    
    md.push('# Activity Invocation Mapping Report');
    md.push('');
    md.push(`Generated: ${new Date().toISOString()}`);
    md.push('');
    
    // Summary
    md.push('## Summary');
    md.push('');
    md.push('| Metric | Value |');
    md.push('|--------|-------|');
    md.push(`| Total Executions | ${mapping.summary.totalExecutions} |`);
    md.push(`| Total Templates | ${mapping.summary.totalTemplates} |`);
    md.push(`| Total Cost | $${mapping.summary.totalCost.toFixed(4)} |`);
    md.push(`| Total Tokens | ${mapping.summary.totalTokens.toLocaleString()} |`);
    md.push(`| Total Duration | ${(mapping.summary.totalDuration / 1000 / 60).toFixed(2)} min |`);
    md.push(`| Avg Success Rate | ${(mapping.summary.avgSuccessRate * 100).toFixed(1)}% |`);
    md.push(`| Date Range | ${new Date(mapping.summary.dateRange.earliest).toLocaleDateString()} - ${new Date(mapping.summary.dateRange.latest).toLocaleDateString()} |`);
    md.push('');
    
    // Executions by Template
    md.push('## Executions by Template');
    md.push('');
    
    for (const [templateId, group] of Object.entries(mapping.executionsByTemplate)) {
      md.push(`### ${group.template?.name || templateId}`);
      md.push('');
      md.push(`**Template ID**: \`${templateId}\``);
      md.push('');
      md.push(`**Category**: ${group.template?.category || 'unknown'}`);
      md.push('');
      md.push(`**Description**: ${group.template?.description || 'N/A'}`);
      md.push('');
      md.push(`**Status**: ${group.template?.status || 'unknown'}`);
      md.push('');
      
      // Template metrics
      md.push('**Template Metrics**:');
      md.push('');
      md.push('| Metric | Value |');
      md.push('|--------|-------|');
      md.push(`| Executions | ${group.executions.length} |`);
      md.push(`| Success | ${group.successCount} |`);
      md.push(`| Failures | ${group.failureCount} |`);
      md.push(`| Success Rate | ${group.executions.length > 0 ? ((group.successCount / group.executions.length) * 100).toFixed(1) : 0}% |`);
      md.push(`| Total Cost | $${group.totalCost.toFixed(4)} |`);
      md.push(`| Avg Cost | $${(group.totalCost / group.executions.length).toFixed(4)} |`);
      md.push(`| Total Tokens | ${group.totalTokens.toLocaleString()} |`);
      md.push(`| Avg Tokens | ${Math.round(group.totalTokens / group.executions.length).toLocaleString()} |`);
      md.push('');
      
      // Template task composition
      if (group.template?.tasks) {
        md.push('**Task Composition**:');
        md.push('');
        md.push('| Task ID | Subagent | Description | Dependencies |');
        md.push('|---------|----------|-------------|--------------|');
        for (const task of group.template.tasks) {
          md.push(`| \`${task.id}\` | ${task.subagent} | ${task.description.substring(0, 50)}... | ${task.dependencies.join(', ') || 'None'} |`);
        }
        md.push('');
      }
      
      // Variants
      if (group.template?.genealogy?.variant_ids?.length > 0) {
        md.push('**Variants**:');
        md.push('');
        for (const variantId of group.template.genealogy.variant_ids) {
          md.push(`- \`${variantId}\``);
        }
        md.push('');
      }
      
      // Individual executions
      md.push('**Individual Executions**:');
      md.push('');
      md.push('| ID | Status | Duration | Cost | Tokens | Date |');
      md.push('|----|--------|----------|------|--------|------|');
      
      for (const exec of group.executions.slice(0, 10)) {  // Limit to 10 most recent
        const duration = (exec.stats.duration / 1000 / 60).toFixed(2);
        const tokens = exec.stats.tokens.input + exec.stats.tokens.output;
        const date = new Date(exec.startedAt).toLocaleDateString();
        
        md.push(`| \`${exec.id.substring(0, 12)}...\` | ${exec.status} | ${duration}m | $${exec.stats.cost.total.toFixed(4)} | ${tokens.toLocaleString()} | ${date} |`);
      }
      
      if (group.executions.length > 10) {
        md.push(`| ... | ... | ... | ... | ... | ... |`);
        md.push(`| *${group.executions.length - 10} more executions* | | | | | |`);
      }
      
      md.push('');
      md.push('---');
      md.push('');
    }
    
    // Impulse Usage
    md.push('## Impulse Usage Patterns');
    md.push('');
    md.push('| Impulse ID | Usage Count | Activities |');
    md.push('|------------|-------------|------------|');
    
    const impulseEntries = Object.entries(mapping.impulsesUsed)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);  // Top 20
    
    for (const [impulseId, data] of impulseEntries) {
      md.push(`| \`${impulseId}\` | ${data.count} | ${data.activities.length} activities |`);
    }
    md.push('');
    
    // Tool Usage
    md.push('## Tool Usage Patterns');
    md.push('');
    md.push('| Tool | Usage Count | Activities |');
    md.push('|------|-------------|------------|');
    
    const toolEntries = Object.entries(mapping.toolUsagePatterns)
      .sort((a, b) => b[1].count - a[1].count);
    
    for (const [tool, data] of toolEntries) {
      md.push(`| \`${tool}\` | ${data.count} | ${data.activities.length} activities |`);
    }
    md.push('');
    
    // Composition Patterns
    if (mapping.compositionPatterns.length > 0) {
      md.push('## Activity Composition Patterns');
      md.push('');
      md.push('Activities that invoke other activities:');
      md.push('');
      md.push('| Activity ID | Nested Activities | Depth |');
      md.push('|-------------|-------------------|-------|');
      
      for (const pattern of mapping.compositionPatterns.slice(0, 10)) {
        md.push(`| \`${pattern.activityId.substring(0, 12)}...\` | ${pattern.nestedActivities.length} | ${pattern.depth} |`);
      }
      md.push('');
    }
    
    return md.join('\n');
  }
  
  /**
   * Generate JSON output
   */
  generateJSONOutput(mapping: ActivityMapping): string {
    return JSON.stringify(mapping, null, 2);
  }
  
  /**
   * Run the generator
   */
  run(outputFormat: 'markdown' | 'json' = 'markdown'): void {
    console.log('Generating activity mapping...');
    
    const mapping = this.generateMapping();
    
    let output: string;
    let filename: string;
    
    if (outputFormat === 'markdown') {
      output = this.generateMarkdownReport(mapping);
      filename = 'ACTIVITY_MAPPING_REPORT.md';
    } else {
      output = this.generateJSONOutput(mapping);
      filename = 'activity-mapping-data.json';
    }
    
    // Write to file
    const outputPath = path.join(process.cwd(), filename);
    fs.writeFileSync(outputPath, output);
    
    console.log(`Report written to: ${outputPath}`);
    console.log(`\nSummary:`);
    console.log(`- ${mapping.summary.totalExecutions} executions`);
    console.log(`- ${mapping.summary.totalTemplates} templates`);
    console.log(`- $${mapping.summary.totalCost.toFixed(4)} total cost`);
    console.log(`- ${(mapping.summary.avgSuccessRate * 100).toFixed(1)}% success rate`);
  }
}

// Run the generator
const generator = new ActivityMappingGenerator();
const format = process.argv[2] as 'markdown' | 'json' || 'markdown';
generator.run(format);
