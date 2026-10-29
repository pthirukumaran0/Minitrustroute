import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/src/lib/database';
import Transaction from '@/src/models/Transaction';

export async function GET() {
  try {
    await connectToDatabase();

    // 1. Transaction Counts by Decision
    const [total, approved, stepUp, blocked] = await Promise.all([
      Transaction.countDocuments({}),
      Transaction.countDocuments({ riskDecision: 'APPROVED' }),
      Transaction.countDocuments({ riskDecision: 'STEP_UP' }),
      Transaction.countDocuments({ riskDecision: 'BLOCKED' }),
    ]);

    // 2. Volume by Currency (Separate currencies aggregated independently)
    const volumeByCurrencyAgg = await Transaction.aggregate([
      {
        $group: {
          _id: '$currency',
          totalVolume: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      { $sort: { totalVolume: -1 } },
    ]);

    const volumeByCurrency = volumeByCurrencyAgg.map((item) => ({
      currency: item._id || 'USD',
      totalVolume: Number(item.totalVolume.toFixed(2)),
      transactionCount: item.transactionCount,
      avgAmount: Number(item.avgAmount.toFixed(2)),
    }));

    // 3. Risk Score Distribution
    const [lowRisk, mediumRisk, highRisk] = await Promise.all([
      Transaction.countDocuments({ riskScore: { $lt: 35 } }),
      Transaction.countDocuments({ riskScore: { $gte: 35, $lt: 70 } }),
      Transaction.countDocuments({ riskScore: { $gte: 70 } }),
    ]);

    // 4. Corridor Summaries
    const corridorAgg = await Transaction.aggregate([
      {
        $group: {
          _id: { source: '$sourceCountry', dest: '$destinationCountry' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const corridors = corridorAgg.map((c) => ({
      corridor: `${c._id.source} ➔ ${c._id.dest}`,
      source: c._id.source,
      destination: c._id.dest,
      count: c.count,
    }));

    // 5. Recent high-risk activity (BLOCKED and STEP_UP)
    const recentFlagged = await Transaction.find({
      riskDecision: { $in: ['BLOCKED', 'STEP_UP'] },
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // 6. Recent transactions
    const recentTransactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    return NextResponse.json({
      success: true,
      summary: {
        total,
        approved,
        stepUp,
        blocked,
        approvalRate: total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0,
        blockedRate: total > 0 ? Number(((blocked / total) * 100).toFixed(1)) : 0,
        stepUpRate: total > 0 ? Number(((stepUp / total) * 100).toFixed(1)) : 0,
        volumeByCurrency,
      },
      riskDistribution: {
        low: lowRisk,
        medium: mediumRisk,
        high: highRisk,
      },
      corridors,
      recentFlagged,
      recentTransactions,
    });
  } catch (error: unknown) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal analytics error',
      },
      { status: 500 }
    );
  }
}

