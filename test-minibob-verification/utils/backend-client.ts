/**
 * Backend API Client
 * 
 * Direct HTTP client for metabob-activity-api
 */

const BACKEND_URL = process.env.MINIBOB_BACKEND_URL || "http://api.minibob.local"

export interface ActivityTemplate {
  id: string
  name: string
  description: string
  category: string
  tasks: any[]
  variables: any[]
  metadata?: {
    generatedFrom?: string
    sourceExecutionId?: string
    sourceTemplateId?: string
  }
}

export interface ActivityRecommendation {
  template_id: string
  selection_metadata: {
    method: string
    alpha?: number
    beta?: number
    sample?: number
    score?: number
  }
}

export interface ExecutionTrace {
  id: string
  template_id: string
  status: string
  start_time: number
  end_time?: number
  metrics?: {
    duration: number
    cost: number
    tokens: { input: number; output: number }
  }
}

export class BackendClient {
  private baseUrl: string

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/health`)
    return await response.json()
  }

  /**
   * Get activity recommendations
   */
  async getRecommendations(
    goal: string,
    impulseIds?: string[],
    topK = 5
  ): Promise<ActivityRecommendation[]> {
    const response = await fetch(`${this.baseUrl}/v2/activities/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        impulse_ids: impulseIds || [],
        top_k: topK
      })
    })
    
    const data = await response.json() as { recommendations: ActivityRecommendation[] }
    return data.recommendations || []
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ActivityTemplate | null> {
    const response = await fetch(`${this.baseUrl}/v2/activities/templates/${templateId}`)
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  }

  /**
   * Register template
   */
  async registerTemplate(template: ActivityTemplate): Promise<void> {
    await fetch(`${this.baseUrl}/v2/activities/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template)
    })
  }

  /**
   * Get execution trace
   */
  async getExecution(executionId: string): Promise<ExecutionTrace | null> {
    const response = await fetch(`${this.baseUrl}/v2/activities/executions/${executionId}`)
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  }

  /**
   * Check if impulse exists
   */
  async impulseExists(impulseId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/v2/impulses/${impulseId}`)
    return response.ok
  }

  /**
   * Get impulse content
   */
  async getImpulse(impulseId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v2/impulses/${impulseId}`)
    return await response.json()
  }

  /**
   * Create improvised activity via goal-seeking
   */
  async createImprovisedActivity(params: {
    goalDescription: string
    templateName: string
    category: string
    variables: Record<string, unknown>
    constraints?: {
      maxTasks?: number
      maxCost?: number
      preferComposition?: boolean
    }
  }): Promise<{ template_id: string }> {
    const response = await fetch(`${this.baseUrl}/v2/activities/create-goal-seeking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal_description: params.goalDescription,
        template_name: params.templateName,
        category: params.category,
        variables: params.variables,
        constraints: params.constraints || {
          max_tasks: 5,
          max_cost: 5.0,
          prefer_composition: true
        }
      })
    })
    
    const data = await response.json() as { status: string; template_id?: string }
    
    if (data.status !== "success" || !data.template_id) {
      throw new Error("Failed to create improvised activity")
    }
    
    return { template_id: data.template_id }
  }

  /**
   * Get template relationship (original → variant)
   */
  async getTemplateRelationship(originalId: string, variantId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/v2/activities/templates/${originalId}/relationships/${variantId}`
    )
    
    if (!response.ok) {
      return null
    }
    
    return await response.json()
  }

  /**
   * Get dashboard data (for visualization verification)
   */
  async getDashboardData(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v2/dashboard/data`)
    return await response.json()
  }
}

export const backend = new BackendClient()
