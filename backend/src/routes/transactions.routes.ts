import { Router } from 'express';
import {
  getTransactions,
  createTransaction,
  getTransactionById,
  getReviewQueue,
  reviewTransaction,
  verifyStepUpTransaction,
  transferTransactionToAdmin,
  dismissTransaction,
  rejectTransaction,
  underReviewTransaction,
  resolveTransaction,
} from '../controllers/transactions.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// Review queue endpoints
router.get('/review-queue', optionalAuthenticate, getReviewQueue);
router.post('/:id/review', optionalAuthenticate, reviewTransaction);
router.post('/:id/dismiss', optionalAuthenticate, dismissTransaction);
router.post('/:id/reject', optionalAuthenticate, rejectTransaction);
router.post('/:id/under-review', optionalAuthenticate, underReviewTransaction);
router.post('/:id/investigate', optionalAuthenticate, underReviewTransaction);
router.post('/:id/resolve', optionalAuthenticate, resolveTransaction);
router.post('/:id/verify-step-up', optionalAuthenticate, verifyStepUpTransaction);
router.post('/:id/transfer-to-admin', optionalAuthenticate, transferTransactionToAdmin);
router.post('/:id/transfer-admin', optionalAuthenticate, transferTransactionToAdmin);

// Standard transaction endpoints
router.get('/', optionalAuthenticate, getTransactions);
router.post('/', optionalAuthenticate, createTransaction);
router.get('/:id', optionalAuthenticate, getTransactionById);

export default router;
