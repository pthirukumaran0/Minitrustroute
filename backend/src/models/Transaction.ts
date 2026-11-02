import mongoose, { Schema, Document, Model } from 'mongoose';

export type RiskDecisionType = 'APPROVED' | 'STEP_UP' | 'BLOCKED';

export interface ITransactionSignals {
  simSwap24h: boolean;
  numberVerified: boolean;
  deviceStatus: 'TRUSTED' | 'SUSPICIOUS' | 'UNKNOWN' | string;
  simSwapVerificationStatus?: string;
  numberVerificationStatus?: string;
  simSwapProvider?: string;
  simSwapMode?: string;
}

export interface ISelectedRoute {
  routeId: string;
  routeName: string;
  hops: string[];
  providerNames?: string[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  reliability?: number;
  algorithm?: string;
  explanation?: string;
  [key: string]: unknown;
}

export interface ITransaction {
  transactionId: string;
  amount: number;
  currency: string;
  sourceCountry: string;
  destinationCountry: string;
  riskScore: number;
  riskDecision: RiskDecisionType;
  signals: ITransactionSignals;
  contributingFactors?: string[];
  recommendedAction?: string;
  selectedRoute: ISelectedRoute | null;
  status: string;
  senderId?: string;
  senderEmail?: string;
  senderName?: string;
  recipientName?: string;
  sourceProviderId?: string;
  destinationProviderId?: string;
  retryOfTransactionId?: string;
  telecomVerification?: any;
  reviewStatus?: 'PENDING_REVIEW' | 'PENDING_ADMIN_REVIEW' | 'VERIFIED_APPROVED' | 'ESCALATED' | 'BLOCKED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'DISMISSED';
  transferredToAdmin?: boolean;
  transferredBy?: string;
  transferredAt?: Date;
  transferNotes?: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  dismissedBy?: string;
  dismissedAt?: Date;
  dismissalReason?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionDocument extends ITransaction, Document {}

const SignalsSchema = new Schema<ITransactionSignals>(
  {
    simSwap24h: {
      type: Boolean,
      required: [true, 'simSwap24h signal is required'],
    },
    numberVerified: {
      type: Boolean,
      required: [true, 'numberVerified signal is required'],
    },
    deviceStatus: {
      type: String,
      required: [true, 'deviceStatus signal is required'],
      trim: true,
      default: 'UNKNOWN',
    },
    simSwapVerificationStatus: {
      type: String,
      trim: true,
    },
    numberVerificationStatus: {
      type: String,
      trim: true,
    },
    simSwapProvider: {
      type: String,
      trim: true,
    },
    simSwapMode: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    transactionId: {
      type: String,
      required: [true, 'transactionId is required'],
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0.01, 'amount must be a positive number greater than 0'],
    },
    currency: {
      type: String,
      required: [true, 'currency is required'],
      uppercase: true,
      trim: true,
      minlength: [3, 'currency code must be 3 characters'],
      maxlength: [3, 'currency code must be 3 characters'],
    },
    sourceCountry: {
      type: String,
      required: [true, 'sourceCountry is required'],
      trim: true,
    },
    destinationCountry: {
      type: String,
      required: [true, 'destinationCountry is required'],
      trim: true,
    },
    riskScore: {
      type: Number,
      required: [true, 'riskScore is required'],
      min: [0, 'riskScore must be at least 0'],
      max: [100, 'riskScore cannot exceed 100'],
    },
    riskDecision: {
      type: String,
      required: [true, 'riskDecision is required'],
      enum: {
        values: ['APPROVED', 'STEP_UP', 'BLOCKED'],
        message: '{VALUE} is not a valid risk decision (must be APPROVED, STEP_UP, or BLOCKED)',
      },
      index: true,
    },
    signals: {
      type: SignalsSchema,
      required: [true, 'signals are required'],
    },
    contributingFactors: {
      type: [String],
      default: [],
    },
    recommendedAction: {
      type: String,
      default: '',
    },
    selectedRoute: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      trim: true,
      default: 'PENDING',
      index: true,
    },
    senderId: {
      type: String,
      trim: true,
      index: true,
    },
    senderEmail: {
      type: String,
      trim: true,
      index: true,
    },
    senderName: {
      type: String,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    sourceProviderId: {
      type: String,
      trim: true,
    },
    destinationProviderId: {
      type: String,
      trim: true,
    },
    retryOfTransactionId: {
      type: String,
      trim: true,
      index: true,
    },
    telecomVerification: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING_REVIEW', 'PENDING_ADMIN_REVIEW', 'VERIFIED_APPROVED', 'ESCALATED', 'BLOCKED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'DISMISSED'],
      index: true,
    },
    transferredToAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    transferredBy: {
      type: String,
      trim: true,
    },
    transferredAt: {
      type: Date,
    },
    transferNotes: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: String,
      trim: true,
    },
    reviewerName: {
      type: String,
      trim: true,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
    dismissedBy: {
      type: String,
      trim: true,
    },
    dismissedAt: {
      type: Date,
    },
    dismissalReason: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt timestamps
  }
);

// Compound index for querying latest transactions efficiently
TransactionSchema.index({ createdAt: -1 });

// Guard against model re-registration during tsx watch hot-reload.
// Use existing compiled model if already registered in the current process.


const Transaction: Model<ITransactionDocument> =
  (mongoose.models.Transaction as Model<ITransactionDocument>) ||
  mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

export default Transaction;
