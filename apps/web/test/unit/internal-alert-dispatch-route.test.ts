import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/v1/internal/alerts/[alertId]/dispatch-emails/route';
import * as alertService from '@/lib/notifications/alert-notification-service';

vi.mock('@/lib/env/server', () => ({
  validateServerEnv: vi.fn().mockReturnValue({
    INTERNAL_SERVICE_TOKEN: 'valid-secret-token',
  }),
}));

describe('Internal Alert Email Dispatch Route (POST)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests with 401 if token is missing or invalid', async () => {
    const request = new Request('http://localhost/api/v1/internal/alerts/alert-1/dispatch-emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-token',
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ alertId: 'alert-1' }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('calls dispatchAlertEmails and returns 200 on authorized request', async () => {
    const mockDispatch = vi.spyOn(alertService, 'dispatchAlertEmails').mockResolvedValue({
      success: true,
      alertId: 'alert-001',
      totalEligible: 2,
      sent: 1,
      skipped: 1,
      failed: 0,
    });

    const request = new Request(
      'http://localhost/api/v1/internal/alerts/alert-001/dispatch-emails',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-secret-token',
        },
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ alertId: 'alert-001' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.alertId).toBe('alert-001');
    expect(body.data.sent).toBe(1);
    expect(mockDispatch).toHaveBeenCalledWith('alert-001', expect.any(Object));
  });
});
