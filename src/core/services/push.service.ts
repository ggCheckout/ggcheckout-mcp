import type { AuthPort } from '../ports/auth.port.js';
import type { PushPort } from '../ports/push.port.js';
export class PushService {
  constructor(private readonly port: PushPort, private readonly authPort: AuthPort) {}
  async listDevices() { const uid = await this.authPort.getMyBusinessId(); return this.port.listDevices(uid); }
  async registerToken(token: string, deviceId?: string) { return this.port.registerToken(token, deviceId); }
  async removeDevice(deviceId: string) { const uid = await this.authPort.getMyBusinessId(); return this.port.removeDevice(deviceId, uid); }
}
