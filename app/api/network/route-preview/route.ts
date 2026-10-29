import { NextRequest, NextResponse } from 'next/server';
import { findOptimalRoute } from '@/src/lib/routingEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const sourceProviderId = body.sourceProviderId || body.sourceNodeId || body.source;
    const destinationProviderId =
      body.destinationProviderId ||
      body.targetNodeId ||
      body.destinationNodeId ||
      body.target ||
      body.destination;
    const sourceCountry = body.sourceCountry;
    const destinationCountry = body.destinationCountry;
    const { excludeEdges, excludeNodes, maxAlternatives = 3 } = body;

    const result = await findOptimalRoute({
      sourceCountry,
      destinationCountry,
      sourceProviderId,
      destinationProviderId,
      excludeEdges,
      excludeNodes,
      maxAlternatives: Math.min(5, Math.max(1, parseInt(maxAlternatives, 10) || 3)),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      route: result.route,
      primaryRoute: result.route,
      alternatives: result.route?.alternatives || [],
    });
  } catch (error: unknown) {
    console.error('Error simulating route preview:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal routing error',
      },
      { status: 500 }
    );
  }
}

