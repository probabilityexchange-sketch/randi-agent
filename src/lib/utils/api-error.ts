import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function wrapRoute<T = unknown>(
  handler: (req: NextRequest) => Promise<NextResponse | T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const result = await handler(req);
      if (result instanceof NextResponse) {
        return result;
      }
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      console.error('[API Error]', error instanceof Error ? error.message : 'Unknown error');

      const message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
