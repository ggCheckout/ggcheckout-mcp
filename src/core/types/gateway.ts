export interface GatewayToken {
  id?: string;
  title: string;
  token: string;
  type: string;
  target?: string;
  status: 'active';
  trackingMode?: 'pixel' | 'events_api' | 'both';
  createdAt: string;
  updatedAt?: string;
}

export interface InsertTokenInput {
  token: string;
  type: string;
  title: string;
  status: string;
  target: string;
  tokenId?: string;
  trackingMode?: 'pixel' | 'events_api' | 'both';
}

export interface GatewayStatEntry {
  success: number;
  errors: number;
  total: number;
  reliability: number;
}

export interface GatewayFallbackStats {
  stats: Record<string, GatewayStatEntry>;
  cachedAt: number | null;
}
