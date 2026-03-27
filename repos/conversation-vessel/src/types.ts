export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  message: Message;
  usage: Usage;
}

export interface Turn {
  id: string;
  userMessage: Message;
  assistantMessage?: Message;
  usage?: Usage;
  metadata?: {
    timestamp: Date;
    duration?: number;
    model?: string;
    temperature?: number;
    tokens_used?: number;
  };
  status: 'pending' | 'completed' | 'error';
}

export interface Conversation {
  id: string;
  title?: string;
  turns: Turn[];
  createdAt: Date;
  updatedAt: Date;
  totalUsage?: Usage;
  metadata?: {
    model?: string;
    systemPrompt?: string;
    tags?: string[];
  };
}

// Impulse system types
export type ImpulsePointer = 
  | { type: 'file'; path: string }
  | { type: 'memo'; content: string };

export interface Impulse {
  id: string;
  pointer: ImpulsePointer;
  priority: 'critical' | 'high' | 'medium' | 'low';
  budget: number;
  metadata?: {
    summary?: string;
    shape?: Record<string, any>;
    rowCount?: number;
    availableOps?: string[];
  };
  loadingState: 'pending' | 'loading' | 'loaded' | 'error';
}