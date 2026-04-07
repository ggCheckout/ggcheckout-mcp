import type { PushPort } from '../../core/ports/push.port.js';
import type { PushDevice } from '../../core/types/push.js';
import { sanitizePushDevice } from '../../shared/sanitizer.js';
import type { HttpClient } from './http-client.js';

export class PushApiAdapter implements PushPort {
  constructor(private readonly http: HttpClient) {}
  async listDevices(userId: string) {
    const data = await this.http.get<{ success: boolean; devices: PushDevice[]; count: number }>(`/api/push-tokens/devices?userId=${userId}`);
    return { ...data, devices: data.devices.map(sanitizePushDevice) };
  }
  async registerToken(token: string, deviceId?: string) {
    return this.http.post<any>('/api/push-tokens', { token, deviceId });
  }
  async removeDevice(deviceId: string, userId: string) {
    await this.http.delete('/api/push-tokens/devices', { deviceId, userId });
  }
}
