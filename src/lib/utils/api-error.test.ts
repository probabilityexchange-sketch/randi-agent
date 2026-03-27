import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, wrapRoute } from '@/lib/utils/api-error';

describe('ApiError', () => {
  it('sets statusCode, message, and name', () => {
    const err = new ApiError(404, 'not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('not found');
    expect(err.name).toBe('ApiError');
    expect(err instanceof Error).toBe(true);
  });

  it('sets optional code', () => {
    const err = new ApiError(422, 'invalid', 'INVALID_INPUT');
    expect(err.code).toBe('INVALID_INPUT');
  });

  it('code is undefined when not provided', () => {
    const err = new ApiError(500, 'oops');
    expect(err.code).toBeUndefined();
  });
});

describe('wrapRoute', () => {
  const makeRequest = () =>
    new NextRequest('http://localhost/api/test', { method: 'GET' });

  it('returns NextResponse directly when handler returns one', async () => {
    const expected = NextResponse.json({ ok: true }, { status: 200 });
    const handler = vi.fn().mockResolvedValue(expected);
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result).toBe(expected);
  });

  it('wraps non-NextResponse return values in JSON', async () => {
    const handler = vi.fn().mockResolvedValue({ data: 'hello' });
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    const body = await result.json();
    expect(body).toEqual({ data: 'hello' });
  });

  it('returns ApiError status and message on ApiError throw', async () => {
    const handler = vi.fn().mockRejectedValue(new ApiError(403, 'forbidden', 'FORBIDDEN'));
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.error).toBe('forbidden');
    expect(body.code).toBe('FORBIDDEN');
  });

  it('returns 500 with real message in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const handler = vi.fn().mockRejectedValue(new Error('db exploded'));
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('db exploded');
    vi.unstubAllEnvs();
  });

  it('returns 500 with generic message in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const handler = vi.fn().mockRejectedValue(new Error('secret internal error'));
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('Internal server error');
    vi.unstubAllEnvs();
  });

  it('handles non-Error throws in production with generic message', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const handler = vi.fn().mockRejectedValue('string error');
    const wrapped = wrapRoute(handler);
    const result = await wrapped(makeRequest());
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('Internal server error');
    vi.unstubAllEnvs();
  });
});
