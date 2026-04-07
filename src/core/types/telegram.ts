// Types validated against saas-checkout/types/telegram-bot.ts

export type TelegramBotStatus = 'active' | 'paused' | 'error';
export type TelegramFlowMode = 'basic' | 'visual';
export type TelegramLeadStatus = 'visitor' | 'lead' | 'qualified' | 'customer';

export interface TelegramBotSettings {
  language: 'pt' | 'en' | 'es';
}

export interface TelegramBotConfig {
  id: string;
  businessId: string;
  name: string;
  username: string;
  status: TelegramBotStatus;
  errorMessage?: string;
  activeFlowId?: string;
  settings: TelegramBotSettings;
  createdAt: string;
  updatedAt: string;
  // token is NEVER exposed by the API
}

export interface TelegramFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdgeCondition {
  variable: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists' | 'regex';
  value: string;
}

export interface TelegramFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  condition?: FlowEdgeCondition;
}

export interface FlowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue?: string;
}

export interface TelegramFlow {
  id: string;
  businessId: string;
  botId: string;
  name: string;
  mode?: TelegramFlowMode;
  published: boolean;
  nodes: TelegramFlowNode[];
  edges: TelegramFlowEdge[];
  variables: FlowVariable[];
  basicConfig?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramFlowListItem {
  id: string;
  botId: string;
  name: string;
  mode?: TelegramFlowMode;
  published: boolean;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TelegramLead {
  id: string;
  businessId: string;
  botId: string;
  flowId: string;
  telegramUserId: string;
  telegramUsername?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags: string[];
  status: TelegramLeadStatus;
  source: 'telegram';
  createdAt: string;
  updatedAt: string;
}

export interface TelegramBotGroup {
  chatId: string;
  title: string;
  type: string;
  isAdmin: boolean;
  addedAt: string | null;
}

export interface TelegramTokenValidation {
  valid: boolean;
  username?: string;
  firstName?: string;
  canJoinGroups?: boolean;
  error?: string;
}

export interface TelegramMediaUpload {
  uploadUrl: string;
  filePath: string;
  publicUrl: string;
}

// --- Input types ---

export interface CreateBotInput {
  name: string;
  token: string;
}

export interface UpdateBotInput {
  name?: string;
  token?: string;
  status?: 'active' | 'paused';
  settings?: Partial<TelegramBotSettings>;
}

export interface CreateFlowInput {
  botId: string;
  name: string;
  mode?: TelegramFlowMode;
  nodes?: TelegramFlowNode[];
  edges?: TelegramFlowEdge[];
  variables?: FlowVariable[];
  basicConfig?: Record<string, any>;
}

export interface UpdateFlowInput {
  name?: string;
  mode?: TelegramFlowMode;
  nodes?: TelegramFlowNode[];
  edges?: TelegramFlowEdge[];
  variables?: FlowVariable[];
  published?: boolean;
  basicConfig?: Record<string, any>;
}

export interface ListLeadsQuery {
  botId?: string;
  flowId?: string;
  status?: TelegramLeadStatus;
  limit?: number;
}

export interface MediaUploadInput {
  fileName: string;
  fileType: string;
  fileSize: number;
}
