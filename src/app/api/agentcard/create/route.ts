import { NextResponse } from 'next/server';
import { AgentCardService } from '@/lib/agentcard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { amountCents, description } = await request.json();

    // Validate required parameters
    if (!amountCents || typeof amountCents !== 'number' || amountCents <= 0) {
      return NextResponse.json(
        { error: 'amountCents is required and must be a positive number' },
        { status: 400 }
      );
    }

    const service = new AgentCardService();
    const result = await service.createCard({
      amountCents,
      description,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('AgentCard create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
