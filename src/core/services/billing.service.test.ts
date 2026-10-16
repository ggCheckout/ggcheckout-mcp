import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service.js';
import type { BillingPort } from '../ports/billing.port.js';
import { ApiError, NetworkError, TemporarilyUnavailableError } from '../../shared/errors.js';

describe('BillingService', () => {
  let service: BillingService;
  let port: BillingPort;

  beforeEach(() => {
    port = { addCredit: vi.fn() } as unknown as BillingPort;
    service = new BillingService(port);
  });

  // The PIX may exist even though the answer was lost, so a plain retry would charge twice.
  it('addCredit says to check list_credits before retrying after a 502', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(
      new TemporarilyUnavailableError(502, 'API Error (502): Erro ao comunicar com o serviço.'),
    );

    await expect(service.addCredit(1000)).rejects.toThrow(/may have been opened anyway.*list_credits/);
  });

  it('addCredit says the same after a timeout', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(
      new NetworkError('request timed out', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })),
    );

    await expect(service.addCredit(1000)).rejects.toThrow(/may have been opened anyway/);
  });

  it('addCredit points to get_credit_topup, where a pending top-up of the new billing is', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(new TemporarilyUnavailableError(504, 'API Error (504): timeout.'));

    await expect(service.addCredit(1000)).rejects.toThrow(/get_credit_topup/);
  });

  it('addCredit treats a connection reset after sending as ambiguous', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(
      new NetworkError('socket hang up', Object.assign(new Error('reset'), { code: 'ECONNRESET' })),
    );

    await expect(service.addCredit(1000)).rejects.toThrow(/may have been opened anyway/);
  });

  it('addCredit leaves alone a failure that never reached the API', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(
      new NetworkError('could not reach the API', Object.assign(new Error('dns'), { code: 'ENOTFOUND' })),
    );

    await expect(service.addCredit(1000)).rejects.toThrow('could not reach the API');
    await expect(service.addCredit(1000)).rejects.not.toThrow(/opened anyway/);
  });

  it('addCredit leaves alone a refusal on the merits', async () => {
    vi.mocked(port.addCredit).mockRejectedValue(new ApiError(400, 'Valor inválido'));

    await expect(service.addCredit(1000)).rejects.toThrow('Valor inválido');
    await expect(service.addCredit(1000)).rejects.not.toThrow(/opened anyway/);
  });
});
