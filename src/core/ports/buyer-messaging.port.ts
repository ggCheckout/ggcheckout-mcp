import type { BuyerMessagingOverview } from '../types/buyer-messaging.js';

export interface BuyerMessagingPort {
  getOverview(): Promise<BuyerMessagingOverview>;
}
