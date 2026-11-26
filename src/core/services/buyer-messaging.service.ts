import type { BuyerMessagingPort } from '../ports/buyer-messaging.port.js';
import type { BuyerMessagingOverview } from '../types/buyer-messaging.js';

export class BuyerMessagingService {
  constructor(private readonly port: BuyerMessagingPort) {}

  async getOverview(): Promise<BuyerMessagingOverview> {
    return await this.port.getOverview();
  }
}
