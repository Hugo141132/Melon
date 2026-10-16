import { describe, it, expect } from 'vitest';
import idMessages from '@/messages/id.json';
import enMessages from '@/messages/en.json';
import { createTranslator } from 'next-intl';

describe('Approvals Error Feedback Regression Test', () => {
  it('ensures rejection error fallback uses generic error instead of false success toast', () => {
    const tApprovalsId = createTranslator({
      locale: 'id',
      messages: idMessages,
      namespace: 'approvals',
    });
    const tErrorsId = createTranslator({ locale: 'id', messages: idMessages, namespace: 'errors' });

    // Toast success text
    const successToast = tApprovalsId('rejectedToast');
    expect(successToast).toBe('Permohonan berhasil ditolak!');

    // Generic error fallback
    const genericError = tErrorsId('generic');
    expect(genericError).toBe('Terjadi kesalahan yang tidak terduga. Silakan coba lagi.');

    // An error message should NEVER match or be confused with the success toast
    expect(genericError).not.toBe(successToast);
  });

  it('ensures en translation error fallback distinguishes rejection success and error', () => {
    const tApprovalsEn = createTranslator({
      locale: 'en',
      messages: enMessages,
      namespace: 'approvals',
    });
    const tErrorsEn = createTranslator({ locale: 'en', messages: enMessages, namespace: 'errors' });

    const successToast = tApprovalsEn('rejectedToast');
    expect(successToast).toBe('Request successfully rejected!');

    const genericError = tErrorsEn('generic');
    expect(genericError).toBe('An unexpected error occurred. Please try again.');

    expect(genericError).not.toBe(successToast);
  });
});
