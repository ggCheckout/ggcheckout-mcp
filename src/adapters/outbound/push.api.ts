import type { PushPort } from '../../core/ports/push.port.js';
import type { PushDevice } from '../../core/types/push.js';
import type { HttpClient } from './http-client.js';

export class PushApiAdapter implements PushPort {
  constructor(private readonly http: HttpClient) {}
  async listDevices(userId: string) {
    return this.http.get<{ success: boolean; devices: PushDevice[]; count: number }>(`/api/push-tokens/devices?userId=${userId}`);
  }
  async registerToken(token: string, deviceId?: string) {
    return this.http.post<any>('/api/push-tokens', { token, deviceId });
  }
  async removeDevice(deviceId: string, userId: string) {
    await this.http.delete('/api/push-tokens/devices', { deviceId, userId });
  }
}
