import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

describe('gateway', () => {
  it('calculates a quote using application money rules', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'POST', url: '/v1/quotes', payload: { lines: [{ unitPrice: '1250', quantity: 2 }] } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ totalPaise: '2500', total: '₹25.00' });
    await app.close();
  });
  it('does not expose protected routes without the configured gateway token', async () => {
    const original = process.env.AI_GATEWAY_AUTH_TOKEN;
    process.env.AI_GATEWAY_AUTH_TOKEN = 'test-token';
    const app = buildServer();
    const response = await app.inject({ method: 'POST', url: '/v1/quotes', payload: { lines: [] } });
    expect(response.statusCode).toBe(401);
    await app.close();
    if (original === undefined) delete process.env.AI_GATEWAY_AUTH_TOKEN; else process.env.AI_GATEWAY_AUTH_TOKEN = original;
  });
});
