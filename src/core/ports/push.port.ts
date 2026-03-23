import type { PushDevice } from '../types/push.js';
export interface PushPort {
  listDevices(userId: string): Promise<{ devices: PushDevice[]; count: number }>;
  registerToken(token: string, deviceId?: string): Promise<any>;
  removeDevice(deviceId: string, userId: string): Promise<void>;
}
