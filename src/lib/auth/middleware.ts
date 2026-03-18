import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken } from './jwt';

export interface AuthedRequest {
  userId: string;
  wallet: string;
  jti: string;
}

export async function getAuthFromCookies(): Promise<AuthedRequest | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.sub!,
    wallet: payload.wallet,
    jti: payload.jti,
  };
}

export async function requireAuth(): Promise<AuthedRequest> {
  const auth = await getAuthFromCookies();

  if (!auth) {
    throw new AuthError('Unauthorized');
  }

  return auth;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Handle common Prisma or validation errors if they have specific patterns
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error('API Error:', error);
  } else if (error instanceof Error) {
    console.error('API Error:', error.name);
  } else {
    console.error('API Error: non-error thrown');
  }

  // Don't leak sensitive error details in production
  const displayMessage = errorMessage; // Temporarily show full error for debugging

  return NextResponse.json({ error: displayMessage }, { status: 500 });
}
