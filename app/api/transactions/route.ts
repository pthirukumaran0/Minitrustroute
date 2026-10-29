import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/src/lib/database';
import Transaction from '@/src/models/Transaction';
import { CreateTransactionInputSchema } from '@/src/lib/validations';
import { calculateRiskDecision } from '@/src/lib/riskEngine';
import { findOptimalRoute } from '@/src/lib/routingEngine';

/**
 * GET /api/transactions
 * Returns saved transactions, sorted newest first (createdAt: -1).
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const skip = (page - 1) * limit;

    const decision = searchParams.get('decision');
    const search = searchParams.get('search');
    const country = searchParams.get('country');
    const sortParam = searchParams.get('sort') || 'createdAt_desc';

    // Build filter query safely
    const query: Record<string, unknown> = {};

    if (decision && ['APPROVED', 'STEP_UP', 'BLOCKED'].includes(decision.toUpperCase())) {
      query.riskDecision = decision.toUpperCase();
    }

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { transactionId: { $regex: sanitized, $options: 'i' } },
        { sourceCountry: { $regex: sanitized, $options: 'i' } },
        { destinationCountry: { $regex: sanitized, $options: 'i' } },
      ];
    }

    if (country && country.trim().length > 0) {
      const countrySanitized = country.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { sourceCountry: { $regex: countrySanitized, $options: 'i' } },
        { destinationCountry: { $regex: countrySanitized, $options: 'i' } },
      ];
    }

    // Determine sort order
    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortParam === 'createdAt_asc') sortOptions = { createdAt: 1 };
    else if (sortParam === 'amount_desc') sortOptions = { amount: -1 };
    else if (sortParam === 'amount_asc') sortOptions = { amount: 1 };
    else if (sortParam === 'riskScore_desc') sortOptions = { riskScore: -1 };
    else if (sortParam === 'riskScore_asc') sortOptions = { riskScore: 1 };

    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      count: transactions.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      transactions,
    });
  } catch (error: unknown) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Validates input with Zod, evaluates risk deterministically on the server,
 * executes intelligent payment routing via Neo4j for eligible transactions,
 * saves the transaction to MongoDB, and returns the saved record.
 * Client-provided risk decisions are intentionally ignored/untrusted.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);

    if (!rawBody) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body. Expected a valid JSON object.',
        },
        { status: 400 }
      );
    }

    // 1. Validate payload structure using Zod
    const validationResult = CreateTransactionInputSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // 2. Deterministically compute risk on the backend
    // Client-provided riskDecision or riskScore are strictly ignored
    const riskResult = calculateRiskDecision({
      amount: input.amount,
      currency: input.currency,
      sourceCountry: input.sourceCountry,
      destinationCountry: input.destinationCountry,
      signals: input.signals,
    });

    // 3. Intelligent Payment Routing Policy Enforcement
    // - BLOCKED: No route is ever selected (prohibited).
    // - STEP_UP: Not approved/verified; payment cannot proceed without MFA. Route is null.
    // - APPROVED: Cleared to proceed; query Neo4j graph for optimal route.
    let selectedRoute = null;
    let finalStatus = riskResult.status;
    let routingExplanation = '';

    if (riskResult.riskDecision === 'APPROVED') {
      try {
        const routeResult = await findOptimalRoute({
          sourceCountry: input.sourceCountry,
          destinationCountry: input.destinationCountry,
          sourceProviderId: input.sourceProviderId,
          destinationProviderId: input.destinationProviderId,
        });

        if (routeResult.success && routeResult.route) {
          selectedRoute = routeResult.route;
          finalStatus = 'APPROVED';
          routingExplanation = routeResult.route.explanation;
        } else {
          // If destination is unreachable or provider missing
          selectedRoute = null;
          finalStatus = 'ROUTING_FAILED';
          routingExplanation = routeResult.details || 'No active payment corridor connects the specified endpoints.';
        }
      } catch (routingErr) {
        console.error('Neo4j routing error:', routingErr);
        selectedRoute = null;
        finalStatus = 'ROUTING_ERROR';
        routingExplanation = 'Payment routing service encountered a database error.';
      }
    } else if (riskResult.riskDecision === 'STEP_UP') {
      selectedRoute = null;
      finalStatus = 'STEP_UP_REQUIRED';
      routingExplanation = 'Transaction held for out-of-band verification (STEP_UP). Payment routing pending authentication.';
    } else {
      // BLOCKED
      selectedRoute = null;
      finalStatus = 'BLOCKED';
      routingExplanation = 'Transaction blocked by risk policy. Payment routing prohibited.';
    }

    // 4. Generate a unique transaction ID if not supplied
    const transactionId =
      input.transactionId ||
      `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Connect to MongoDB
    await connectToDatabase();

    // 6. Create and persist the transaction document
    const newTransaction = await Transaction.create({
      transactionId,
      amount: input.amount,
      currency: input.currency,
      sourceCountry: input.sourceCountry,
      destinationCountry: input.destinationCountry,
      riskScore: riskResult.riskScore,
      riskDecision: riskResult.riskDecision,
      signals: input.signals,
      contributingFactors: riskResult.contributingFactors,
      recommendedAction: riskResult.recommendedAction,
      selectedRoute,
      status: finalStatus,
    });

    return NextResponse.json(
      {
        success: true,
        transaction: newTransaction,
        riskEvaluation: {
          score: riskResult.riskScore,
          decision: riskResult.riskDecision,
          factors: riskResult.contributingFactors,
          action: riskResult.recommendedAction,
          breakdown: riskResult.contributingFactors,
        },
        routing: {
          selected: selectedRoute !== null,
          explanation: routingExplanation,
          route: selectedRoute,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Check for MongoDB unique index violation (duplicate transactionId)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'A transaction with this transactionId already exists.',
        },
        { status: 409 }
      );
    }

    console.error('Error creating transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
