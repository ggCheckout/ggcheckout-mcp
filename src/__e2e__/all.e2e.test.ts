/**
 * E2E test suite for ggcheckout-mcp.
 *
 * Requires: GGCHECKOUT_API_KEY in .env (staging key).
 * Run: npm run test:e2e
 *
 * Rate limit: 30 req/min — tests include delays between requests.
 * Total requests: ~20, total time: ~60s.
 */

import { describe, it, expect } from 'vitest';
import { services, adapters, delay } from './setup.js';
import { HttpClient } from '../adapters/outbound/http-client.js';
import { AuthApiAdapter } from '../adapters/outbound/auth.api.js';

const API_URL = process.env.GGCHECKOUT_API_URL || 'https://ggcheckout.app';

const DELAY = 3000;

describe('E2E: ggcheckout-mcp', () => {
  // --- Auth ---
  describe('Authentication', () => {
    it('valid API key returns businessId', async () => {
      const businessId = await adapters.auth.getMyBusinessId();
      expect(businessId).toBeDefined();
      expect(typeof businessId).toBe('string');
      expect(businessId.length).toBeGreaterThan(0);
    });

    it('invalid API key returns error', async () => {
      await delay(DELAY);
      const badHttp = new HttpClient(API_URL, 'ggck_live_invalid_key_000000000000000000000000000000000000000000000000');
      const badAuth = new AuthApiAdapter(badHttp);
      await expect(badAuth.getMyBusinessId()).rejects.toThrow();
    });
  });

  // --- Smoke (read-only) ---
  describe('Smoke tests', () => {
    it('get_profile returns user data', async () => {
      await delay(DELAY);
      const profile = await services.profile.getProfile();
      expect(profile.uid).toBeDefined();
      expect(profile.email).toBeDefined();
    });

    it('list_products returns array', async () => {
      await delay(DELAY);
      const products = await services.product.list();
      expect(Array.isArray(products)).toBe(true);
    });

    it('list_checkouts returns array', async () => {
      await delay(DELAY);
      const checkouts = await services.checkout.list();
      expect(Array.isArray(checkouts)).toBe(true);
    });

    it('get_billing_status returns valid status', async () => {
      await delay(DELAY);
      const status = await services.billing.getStatus();
      expect(['active', 'pending_card', 'grace_period', 'blocked']).toContain(status.status);
    });

    it('get_dashboard_stats returns numbers', async () => {
      await delay(DELAY);
      const stats = await services.dashboard.getStats('week');
      expect(typeof stats.totalSales).toBe('number');
      expect(typeof stats.totalRevenue).toBe('number');
    });
  });

  // --- Product CRUD ---
  describe('Product CRUD', () => {
    let productId: string;

    it('creates a product', async () => {
      await delay(DELAY);
      const result = await services.product.create({
        title: 'E2E Test Product',
        description: 'Created by automated E2E test - safe to delete',
        price: 19.90,
        discount: 0,
        url: 'https://example.com/delivery',
      });
      expect(result.productId).toBeDefined();
      productId = result.productId;
    });

    it('gets product by id', async () => {
      await delay(DELAY);
      const product = await services.product.getById(productId);
      expect(product.title).toBe('E2E Test Product');
    });

    it('updates the product', async () => {
      await delay(DELAY);
      await services.product.update(productId, { title: 'E2E Updated' });
      await delay(DELAY);
      const product = await services.product.getById(productId);
      expect(product.title).toBe('E2E Updated');
    });

    it('deletes the product', async () => {
      await delay(DELAY);
      await services.product.delete(productId);
      await delay(DELAY);
      await expect(services.product.getById(productId)).rejects.toThrow();
    });
  });

  // --- Payment PII sanitization ---
  describe('Payment sanitization', () => {
    it('payments have PII masked', async () => {
      await delay(DELAY);
      const businessId = await adapters.auth.getMyBusinessId();
      await delay(DELAY);
      const result = await services.payment.getPaginated(businessId, { pageSize: 3 });
      if ('payments' in result && result.payments.length > 0) {
        const p = result.payments[0];
        if (p.cpf) expect(p.cpf).toContain('***');
        if (p.email) expect(p.email).toContain('**');
        expect(p.customerIp).toBeUndefined();
      }
    });
  });

  // --- Error handling ---
  describe('Error handling', () => {
    it('nonexistent product returns error', async () => {
      await delay(DELAY);
      await expect(services.product.getById('nonexistent-id-xyz')).rejects.toThrow();
    });

    it('nonexistent checkout returns error', async () => {
      await delay(DELAY);
      await expect(services.checkout.getById('nonexistent-id-xyz')).rejects.toThrow();
    });
  });
});
