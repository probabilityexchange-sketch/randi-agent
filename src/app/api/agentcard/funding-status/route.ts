import { NextResponse } from 'next/server';
import { AgentCardService } from '@/lib/agentcard';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter is required' }, { status: 400 });
    }

    const service = new AgentCardService();
    const result = await service.getFundingStatus(sessionId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('AgentCard funding status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
