import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/src/lib/database';
import Transaction from '@/src/models/Transaction';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Search by transactionId string first, or fallback to _id
    let transaction = await Transaction.findOne({ transactionId: id }).lean();
    if (!transaction && id.match(/^[0-9a-fA-F]{24}$/)) {
      transaction = await Transaction.findById(id).lean();
    }

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: `Transaction with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error: unknown) {
    console.error('Error fetching transaction details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

