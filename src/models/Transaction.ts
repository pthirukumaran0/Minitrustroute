import mongoose, { Schema, Document, Model } from 'mongoose';

export type RiskDecisionType = 'APPROVED' | 'STEP_UP' | 'BLOCKED';

export interface ITransactionSignals {
  simSwap24h: boolean;
  numberVerified: boolean;
  deviceStatus: 'TRUSTED' | 'SUSPICIOUS' | 'UNKNOWN' | string;
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
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt timestamps
  }
);

// Compound index for querying latest transactions efficiently
TransactionSchema.index({ createdAt: -1 });

// In Next.js dev server, delete existing cached model to allow hot schema updates
if (mongoose.models && mongoose.models.Transaction) {
  delete (mongoose.models as Record<string, unknown>).Transaction;
}

const Transaction: Model<ITransactionDocument> =
  mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

export default Transaction;
