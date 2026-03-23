import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileApiAdapter } from './profile.api.js';
import type { HttpClient } from './http-client.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } as any;
}

describe('ProfileApiAdapter', () => {
  let adapter: ProfileApiAdapter;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    adapter = new ProfileApiAdapter(http);
  });

  it('getProfile GETs /api/user/profile', async () => {
    vi.mocked(http.get).mockResolvedValue({ uid: 'u1', name: 'Test' });
    await adapter.getProfile();
    expect(http.get).toHaveBeenCalledWith('/api/user/profile');
  });

  it('updateProfile PATCHes /api/user/profile', async () => {
    vi.mocked(http.patch).mockResolvedValue({ success: true });
    await adapter.updateProfile({ name: 'New Name' });
    expect(http.patch).toHaveBeenCalledWith('/api/user/profile', { name: 'New Name' });
  });

  it('listSupportEmails extracts array from wrapper', async () => {
    vi.mocked(http.get).mockResolvedValue({ supportEmails: [{ id: 'se1', email: 'a@b.com' }] });
    const result = await adapter.listSupportEmails('uid-1');
    expect(http.get).toHaveBeenCalledWith('/api/user/support-emails?userId=uid-1');
    expect(result).toEqual([{ id: 'se1', email: 'a@b.com' }]);
  });

  it('addSupportEmail extracts supportEmail from wrapper', async () => {
    vi.mocked(http.post).mockResolvedValue({ success: true, supportEmail: { id: 'se1' } });
    const result = await adapter.addSupportEmail('uid-1', 'Support', 'support@test.com');
    expect(http.post).toHaveBeenCalledWith('/api/user/support-emails', { userId: 'uid-1', name: 'Support', email: 'support@test.com' });
    expect(result.id).toBe('se1');
  });

  it('deleteSupportEmail passes userId and emailId as query params', async () => {
    vi.mocked(http.delete).mockResolvedValue({});
    await adapter.deleteSupportEmail('uid-1', 'se1');
    expect(http.delete).toHaveBeenCalledWith('/api/user/support-emails?userId=uid-1&emailId=se1');
  });

  it('getKycStatus GETs /api/kyc/status', async () => {
    vi.mocked(http.get).mockResolvedValue({ success: true, kycStatus: 'approved', approved: true });
    const result = await adapter.getKycStatus();
    expect(http.get).toHaveBeenCalledWith('/api/kyc/status');
    expect(result.approved).toBe(true);
  });
});
