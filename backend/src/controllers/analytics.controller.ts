import { Request, Response, NextFunction } from 'express';
import { connectToDatabase } from '../lib/database';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { ensureStableAnonymousIds } from '../lib/userUtils';

/**
 * GET /api/analytics
 * Aggregates summary statistics, disaggregated currency volume, and corridor metrics.
 */
export async function getAnalytics(req: Request, res: Response, next: NextFunction) {
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
      totalVolume: Number((item.totalVolume || 0).toFixed(2)),
      transactionCount: item.transactionCount || 0,
      avgAmount: Number((item.avgAmount || 0).toFixed(2)),
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
      corridor: `${c._id?.source || 'UNKNOWN'} ➔ ${c._id?.dest || 'UNKNOWN'}`,
      source: c._id?.source || 'UNKNOWN',
      destination: c._id?.dest || 'UNKNOWN',
      count: c.count || 0,
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

    const approvalRate = total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0;
    const blockedRate = total > 0 ? Number(((blocked / total) * 100).toFixed(1)) : 0;
    const stepUpRate = total > 0 ? Number(((stepUp / total) * 100).toFixed(1)) : 0;

    const summary = {
      total,
      approved,
      stepUp,
      blocked,
      approvalRate,
      blockedRate,
      stepUpRate,
      volumeByCurrency,
    };

    res.json({
      success: true,
      summary,
      ...summary,
      riskDistribution: {
        low: lowRisk,
        medium: mediumRisk,
        high: highRisk,
      },
      corridors,
      recentFlagged: recentFlagged || [],
      recentTransactions: recentTransactions || [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/user-personas
 * Returns privacy-preserving, anonymized user analytics using stable Anonymous IDs (e.g., USR-1001).
 * Absolutely zero PII (no names, emails, phones) is included in the output.
 */
export async function getUserPersonaAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    await connectToDatabase();
    await ensureStableAnonymousIds();

    // Query only User (sender) and Analyst roles - Admin accounts are never managed or exposed here
    const users = await User.find({ role: { $in: ['sender', 'analyst'] } }).sort({ createdAt: 1 }).lean();

    // Fetch all transactions to aggregate per user
    const transactions = await Transaction.find({})
      .select('transactionId senderEmail senderId amount currency riskScore riskDecision status signals createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Build map of transactions by sender email and senderId
    const txByEmail = new Map<string, typeof transactions>();
    const txByUserId = new Map<string, typeof transactions>();

    for (const tx of transactions) {
      if (tx.senderEmail) {
        const emailLower = tx.senderEmail.toLowerCase();
        if (!txByEmail.has(emailLower)) txByEmail.set(emailLower, []);
        txByEmail.get(emailLower)!.push(tx);
      }
      if (tx.senderId) {
        const sId = String(tx.senderId);
        if (!txByUserId.has(sId)) txByUserId.set(sId, []);
        txByUserId.get(sId)!.push(tx);
      }
    }

    const personaProfiles = users.map((u, index) => {
      const stableId = u.anonymousId || `USR-${1001 + index}`;
      const emailLower = u.email ? u.email.toLowerCase() : '';
      const userIdStr = u._id ? u._id.toString() : '';

      // Match transactions
      const userTxnsMap = new Map<string, (typeof transactions)[0]>();
      if (emailLower && txByEmail.has(emailLower)) {
        for (const t of txByEmail.get(emailLower)!) {
          userTxnsMap.set(t.transactionId, t);
        }
      }
      if (userIdStr && txByUserId.has(userIdStr)) {
        for (const t of txByUserId.get(userIdStr)!) {
          userTxnsMap.set(t.transactionId, t);
        }
      }

      const userTxns = Array.from(userTxnsMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const totalTxns = userTxns.length;
      let approvedCount = 0;
      let blockedCount = 0;
      let stepUpCount = 0;
      let totalAmount = 0;
      let suspiciousCount = 0;

      for (const t of userTxns) {
        if (t.riskDecision === 'APPROVED' || t.status === 'APPROVED') {
          approvedCount++;
        } else if (t.riskDecision === 'BLOCKED' || t.status === 'BLOCKED') {
          blockedCount++;
        } else if (t.riskDecision === 'STEP_UP' || t.status === 'STEP_UP_REQUIRED') {
          stepUpCount++;
        }

        if (t.riskScore >= 35 || t.signals?.simSwap24h || t.riskDecision === 'BLOCKED') {
          suspiciousCount++;
        }

        totalAmount += t.amount || 0;
      }

      const avgAmount = totalTxns > 0 ? Number((totalAmount / totalTxns).toFixed(2)) : 0;
      const riskScores = userTxns.slice(0, 10).map((t) => ({
        score: t.riskScore,
        decision: t.riskDecision,
        date: t.createdAt,
      }));

      const avgRiskScore =
        totalTxns > 0
          ? Math.round(userTxns.reduce((sum, t) => sum + (t.riskScore || 0), 0) / totalTxns)
          : 0;

      return {
        id: userIdStr,
        userId: stableId, // Persistent Anonymous ID (e.g. USR-1001)
        role: u.role,
        status: u.status || 'ACTIVE',
        loginCount: u.loginCount || 1,
        lastLoginTime: u.lastLoginAt || u.lastLogin || u.updatedAt || u.createdAt,
        accountCreatedAt: u.createdAt,
        totalTransactions: totalTxns,
        approvedTransactions: approvedCount,
        blockedTransactions: blockedCount,
        stepUpTransactions: stepUpCount,
        totalVolume: Number(totalAmount.toFixed(2)),
        averageAmount: avgAmount,
        averageRiskScore: avgRiskScore,
        suspiciousActivityCount: suspiciousCount,
        riskScoreHistory: riskScores,
        recentActivity: userTxns.slice(0, 5).map((t) => ({
          transactionId: t.transactionId,
          amount: t.amount,
          currency: t.currency,
          riskScore: t.riskScore,
          riskDecision: t.riskDecision,
          createdAt: t.createdAt,
        })),
      };
    });

    // Aggregations
    const mostActiveUsers = [...personaProfiles]
      .filter((p) => p.totalTransactions > 0)
      .sort((a, b) => b.totalTransactions - a.totalTransactions)
      .slice(0, 5);

    const repeatedBlockedUsers = [...personaProfiles]
      .filter((p) => p.blockedTransactions > 0)
      .sort((a, b) => b.blockedTransactions - a.blockedTransactions);

    const accountStatusDistribution = {
      ACTIVE: personaProfiles.filter((p) => p.status === 'ACTIVE').length,
      INACTIVE: personaProfiles.filter((p) => p.status === 'INACTIVE').length,
      SUSPENDED: personaProfiles.filter((p) => p.status === 'SUSPENDED').length,
    };

    const riskDistribution = {
      low: personaProfiles.filter((p) => p.averageRiskScore < 35).length,
      medium: personaProfiles.filter((p) => p.averageRiskScore >= 35 && p.averageRiskScore < 70).length,
      high: personaProfiles.filter((p) => p.averageRiskScore >= 70).length,
    };

    res.json({
      success: true,
      summary: {
        totalTrackedPersonas: personaProfiles.length,
        activePersonas: accountStatusDistribution.ACTIVE,
        suspendedPersonas: accountStatusDistribution.SUSPENDED,
        totalTransactionsAnalyzed: transactions.length,
      },
      personas: personaProfiles,
      aggregations: {
        mostActiveUsers,
        repeatedBlockedUsers,
        accountStatusDistribution,
        riskDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
}


