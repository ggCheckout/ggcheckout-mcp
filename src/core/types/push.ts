export interface PushDevice {
  id: string;
  deviceId: string;
  os: string;
  osDisplayName: string;
  browser: string;
  browserDisplayName: string;
  displayName: string;
  userAgent: string;
  lastUsed: string;
  token: string;
  ipAddress?: string;
}
