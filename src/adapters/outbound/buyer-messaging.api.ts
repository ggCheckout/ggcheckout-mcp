import { z } from 'zod';
import type { BuyerMessagingPort } from '../../core/ports/buyer-messaging.port.js';
import {
  BUYER_MESSAGING_LIMITS as L, NOTICE_MOMENTS, RECOVERY_MOMENTS, type BuyerMessagingOverview,
} from '../../core/types/buyer-messaging.js';
import { AppError } from '../../shared/errors.js';
import { codePoints } from '../../shared/text.js';
import type { HttpClient } from './http-client.js';

const noticeRow = (moment: typeof NOTICE_MOMENTS[number]) => z.strictObject({
  lane: z.literal('notices'), moment: z.literal(moment), on: z.boolean(),
});

const recoveryRow = (moment: typeof RECOVERY_MOMENTS[number]) => z.strictObject({
  lane: z.literal('recovery'),
  moment: z.literal(moment),
  owner: z.strictObject({
    journeyId: z.string().min(1).max(L.ownerIdMaxLength),
    name: z.string().refine((name) => codePoints(name) <= L.ownerNameMaxCodePoints),
  }).nullable(),
  assistantSkipped: z.boolean(),
});

/** The body of `GET /api/whatsapp/buyer-messaging`, as `buyer-messaging/overview/v1` of the saas defines it. */
export const buyerMessagingOverview = z.strictObject({
  url: z.string().regex(/^https?:\/\//),
  dailyCap: z.number().int().min(L.dailyCapMin).max(L.dailyCapMax).nullable(),
  rows: z.tuple([
    noticeRow('pending'),
    noticeRow('approved'),
    ...RECOVERY_MOMENTS.map(recoveryRow) as [ReturnType<typeof recoveryRow>, ...ReturnType<typeof recoveryRow>[]],
    z.strictObject({ lane: z.literal('conversation'), moment: z.literal('buyer_replied'), owner: z.enum(['assistant', 'team']) }),
  ]),
});

export class BuyerMessagingApiAdapter implements BuyerMessagingPort {
  constructor(private readonly http: HttpClient) {}

  /**
   * The answer is parsed before it reaches the model: a shape this version does not know would
   * otherwise be read as "nobody messages here" or "notice off".
   */
  async getOverview(): Promise<BuyerMessagingOverview> {
    const parsed = buyerMessagingOverview.safeParse(await this.http.get<unknown>('/api/whatsapp/buyer-messaging'));
    if (!parsed.success) {
      throw new AppError('The API answered the buyer messaging overview in a shape this version of ggcheckout-mcp does not know: update it.', 'UNEXPECTED_RESPONSE');
    }
    return parsed.data as BuyerMessagingOverview;
  }
}
