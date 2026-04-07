import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileService } from './profile.service.js';
import type { ProfilePort } from '../ports/profile.port.js';
import type { AuthPort } from '../ports/auth.port.js';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockPort: ProfilePort;
  let mockAuthPort: AuthPort;

  beforeEach(() => {
    mockPort = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      listSupportEmails: vi.fn().mockResolvedValue([]),
      addSupportEmail: vi.fn(),
      deleteSupportEmail: vi.fn(),
      getKycStatus: vi.fn(),
    };
    mockAuthPort = { getMyBusinessId: vi.fn().mockResolvedValue('uid-123') };
    service = new ProfileService(mockPort, mockAuthPort);
  });

  it('listSupportEmails fetches uid from authPort', async () => {
    await service.listSupportEmails();
    expect(mockAuthPort.getMyBusinessId).toHaveBeenCalled();
    expect(mockPort.listSupportEmails).toHaveBeenCalledWith('uid-123');
  });

  it('addSupportEmail fetches uid and passes name + email', async () => {
    vi.mocked(mockPort.addSupportEmail).mockResolvedValue({ id: 'se-1' } as any);
    await service.addSupportEmail('Support', 'support@test.com');
    expect(mockPort.addSupportEmail).toHaveBeenCalledWith('uid-123', 'Support', 'support@test.com');
  });

  it('deleteSupportEmail fetches uid and passes emailId', async () => {
    vi.mocked(mockPort.deleteSupportEmail).mockResolvedValue(undefined);
    await service.deleteSupportEmail('se-1');
    expect(mockPort.deleteSupportEmail).toHaveBeenCalledWith('uid-123', 'se-1');
  });

  it('getProfile delegates directly (no authPort needed)', async () => {
    vi.mocked(mockPort.getProfile).mockResolvedValue({ uid: 'uid-123', name: 'Test' } as any);
    await service.getProfile();
    expect(mockPort.getProfile).toHaveBeenCalled();
    expect(mockAuthPort.getMyBusinessId).not.toHaveBeenCalled();
  });
});
