import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/trustroute');
  const coll = mongoose.connection.db!.collection('transactions');
  const count = await coll.countDocuments();
  console.log('Total transactions in DB:', count);

  const distinctDecisions = await coll.distinct('riskDecision');
  const distinctStatuses = await coll.distinct('status');
  const distinctReviewStatuses = await coll.distinct('reviewStatus');
  console.log('riskDecisions:', distinctDecisions);
  console.log('statuses:', distinctStatuses);
  console.log('reviewStatuses:', distinctReviewStatuses);

  const queueQuery = {
    $or: [
      { riskDecision: 'STEP_UP' },
      { status: 'STEP_UP_REQUIRED' },
      { reviewStatus: 'PENDING_REVIEW' },
    ],
  };
  const queueCount = await coll.countDocuments(queueQuery);
  console.log('Queue matching count:', queueCount);

  const sample = await coll.find(queueQuery).limit(3).toArray();
  console.log('Sample queue items:', JSON.stringify(sample.map(s => ({
    id: s.transactionId,
    riskDecision: s.riskDecision,
    status: s.status,
    reviewStatus: s.reviewStatus,
    signals: s.signals
  })), null, 2));

  await mongoose.disconnect();
}
main().catch(console.error);

