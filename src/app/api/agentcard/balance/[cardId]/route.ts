import { NextResponse } from 'next/server';
import { AgentCardService } from '@/lib/agentcard';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId } = await params;

    if (!cardId) {
      return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
    }

    const service = new AgentCardService();
    const result = await service.getBalance(cardId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('AgentCard balance error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
