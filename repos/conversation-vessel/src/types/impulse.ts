export interface ImpulseRef {
  id: string;
  type: 'memo' | 'file' | 'activityOutput' | 'custom';
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  budget: number;
  metadata?: {
    shape?: string;
    rowCount?: number;
    summary?: string;
    availableOps?: string[];
  };
}

export interface ResolvedImpulse {
  id: string;
  type: string;
  data: string;
  metadata?: {
    shape?: string;
    rowCount?: number;
    summary?: string;
    availableOps?: string[];
  };
}