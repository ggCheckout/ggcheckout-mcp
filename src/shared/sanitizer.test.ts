import { describe, it, expect } from 'vitest';
import {
  maskCpf, maskPhone, maskEmail, maskToken, stripCredentials,
  sanitizePayment, sanitizeWebhook, sanitizeGatewayToken,
  sanitizeWhatsappSession, sanitizeLead, sanitizeFunnel,
  sanitizeBillingCard, sanitizeStoreConfig, sanitizeCustomer,
  sanitizeFeedback, sanitizeStudent, sanitizePushDevice,
  sanitizeWhatsappDelivery,
} from './sanitizer.js';

describe('maskCpf', () => {
  it('masks CPF keeping last 2 digits visible', () => {
    expect(maskCpf('123.456.789-01')).toContain('01');
    expect(maskCpf('123.456.789-01')).toContain('***');
  });
  it('returns null for null/undefined', () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf(undefined)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks phone keeping last 4 digits', () => {
    const result = maskPhone('11999887766');
    expect(result).toContain('7766');
    expect(result).toContain('*');
    expect(result).not.toContain('9998');
  });
  it('returns null for null/undefined', () => {
    expect(maskPhone(null)).toBeNull();
  });
});

describe('maskEmail', () => {
  it('masks email local part', () => {
    const result = maskEmail('john@example.com');
    expect(result).toBe('j**n@example.com');
  });
  it('handles short local part', () => {
    expect(maskEmail('ab@test.com')).toBe('a***@test.com');
  });
  it('returns null for null/undefined', () => {
    expect(maskEmail(null)).toBeNull();
  });
});

describe('maskToken', () => {
  it('masks middle of token', () => {
    expect(maskToken('abcdefghij1234')).toBe('abcd..1234');
  });
  it('masks short tokens completely', () => {
    expect(maskToken('short')).toBe('****');
  });
  it('returns null for null/undefined', () => {
    expect(maskToken(null)).toBeNull();
  });
});

describe('stripCredentials', () => {
  it('removes specified fields', () => {
    const result = stripCredentials({ a: 1, secret: 'x', token: 'y' }, ['secret', 'token']);
    expect(result).toEqual({ a: 1 });
  });
  it('handles missing fields gracefully', () => {
    const result = stripCredentials({ a: 1 }, ['nonexistent']);
    expect(result).toEqual({ a: 1 });
  });
});

describe('sanitizePayment', () => {
  it('masks CPF, phone, email and removes customerIp', () => {
    const payment = {
      id: 'p1', cpf: '12345678901', phone: '11999887766',
      email: 'test@test.com', emailFormatted: 'test@test.com',
      customerIp: '192.168.1.1',
      address: { street: 'Rua A', number: '10', city: 'SP', state: 'SP', zipCode: '01001000' },
    };
    const result = sanitizePayment(payment);
    expect(result.cpf).toContain('***');
    expect(result.cpf).not.toBe('12345678901');
    expect(result.phone).toContain('****');
    expect(result.email).toContain('**');
    expect(result.customerIp).toBeUndefined();
    expect(result.address.street).toBeUndefined();
    expect(result.address.city).toBe('SP');
  });
});

describe('sanitizeWebhook', () => {
  it('strips secret field', () => {
    const result = sanitizeWebhook({ id: 'w1', name: 'Test', secret: 'my-secret-123' });
    expect(result.secret).toBeUndefined();
    expect(result.id).toBe('w1');
    expect(result.name).toBe('Test');
  });
});

describe('sanitizeGatewayToken', () => {
  it('masks token value', () => {
    const result = sanitizeGatewayToken({ id: 't1', token: 'sk_live_abcdefghij1234', type: 'stripe' });
    expect(result.token).toBe('sk_l..1234');
    expect(result.type).toBe('stripe');
  });
});

describe('sanitizeWhatsappSession', () => {
  it('strips qrCode, workerUrl and masks phoneNumber', () => {
    const session = { uid: 's1', qrCode: 'base64...', workerUrl: 'https://internal.url', phoneNumber: '5511999887766' };
    const result = sanitizeWhatsappSession(session);
    expect(result.qrCode).toBeUndefined();
    expect(result.workerUrl).toBeUndefined();
    expect(result.phoneNumber).toContain('****');
    expect(result.uid).toBe('s1');
  });
});

describe('sanitizeWhatsappDelivery', () => {
  it('masks recipientPhone', () => {
    const result = sanitizeWhatsappDelivery({ uid: 'd1', recipientPhone: '5511999887766' });
    expect(result.recipientPhone).toContain('****');
    expect(result.recipientPhone).not.toBe('5511999887766');
  });
});

describe('sanitizeLead', () => {
  it('masks PII and removes ip/userAgent', () => {
    const lead = { id: 'l1', cpf: '12345678901', phone: '119998877', email: 'lead@test.com', ip: '10.0.0.1', userAgent: 'Mozilla...' };
    const result = sanitizeLead(lead);
    expect(result.cpf).toContain('***');
    expect(result.phone).toContain('****');
    expect(result.email).toContain('**');
    expect(result.ip).toBeUndefined();
    expect(result.userAgent).toBeUndefined();
  });
});

describe('sanitizeFunnel', () => {
  it('strips webhookSecret from settings', () => {
    const funnel = { id: 'f1', settings: { webhookSecret: 'secret-123', seo: {} } };
    const result = sanitizeFunnel(funnel);
    expect(result.settings.webhookSecret).toBeUndefined();
    expect(result.settings.seo).toBeDefined();
  });
});

describe('sanitizeBillingCard', () => {
  it('strips tokenId from card', () => {
    const result = sanitizeBillingCard({ hasCard: true, card: { tokenId: 'tok_123', lastFour: '4242', brand: 'visa' } });
    expect(result.card.tokenId).toBeUndefined();
    expect(result.card.lastFour).toBe('4242');
    expect(result.card.brand).toBe('visa');
  });
});

describe('sanitizeStoreConfig', () => {
  it('strips token from payment methods', () => {
    const config = {
      paymentMethods: {
        pix: { enabled: true, gateways: ['pushinpay'], token: 'encrypted-token-123' },
        credit_card: { enabled: true, gateways: ['stripe'], token: 'sk_live_xxx' },
      },
      theme: {},
    };
    const result = sanitizeStoreConfig(config);
    expect(result.paymentMethods.pix.token).toBeUndefined();
    expect(result.paymentMethods.credit_card.token).toBeUndefined();
    expect(result.paymentMethods.pix.enabled).toBe(true);
  });
});

describe('sanitizeCustomer', () => {
  it('masks cpf, phone, email', () => {
    const result = sanitizeCustomer({ name: 'John', cpf: '12345678901', phone: '119998877', email: 'john@test.com' });
    expect(result.cpf).toContain('***');
    expect(result.phone).toContain('****');
    expect(result.email).toContain('**');
    expect(result.name).toBe('John');
  });
});

describe('sanitizeFeedback', () => {
  it('masks customerEmail', () => {
    const result = sanitizeFeedback({ feedbackId: 'f1', customerEmail: 'buyer@shop.com', rating: 5 });
    expect(result.customerEmail).toBe('b***r@shop.com');
    expect(result.rating).toBe(5);
  });
});

describe('sanitizeStudent', () => {
  it('masks email', () => {
    const result = sanitizeStudent({ id: 's1', email: 'student@school.com', name: 'Ana' });
    expect(result.email).toBe('s*****t@school.com');
    expect(result.name).toBe('Ana');
  });
});

describe('sanitizePushDevice', () => {
  it('masks token and removes ipAddress', () => {
    const result = sanitizePushDevice({ id: 'd1', token: 'fcm_very_long_token_123456', ipAddress: '192.168.1.1', displayName: 'Chrome' });
    expect(result.token).toBe('fcm_..3456');
    expect(result.ipAddress).toBeUndefined();
    expect(result.displayName).toBe('Chrome');
  });
});
