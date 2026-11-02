import mongoose, { Schema, Document, Model } from 'mongoose';

export type ProviderType = 'GATEWAY' | 'BANK' | 'CLEARING' | 'CORRIDOR' | 'DESTINATION_BANK';
export type ProviderStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface IPaymentProvider {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  country: string;
  countryCode: string;
  city?: string;
  supportedCurrencies: string[];
  status: ProviderStatus;
  transactionFee: number;
  averageLatency: number;
  liquidity: number;
  reliability: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentProviderDocument extends IPaymentProvider, Document {}

const PaymentProviderSchema = new Schema<IPaymentProviderDocument>(
  {
    providerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    providerType: {
      type: String,
      required: true,
      enum: ['GATEWAY', 'BANK', 'CLEARING', 'CORRIDOR', 'DESTINATION_BANK'],
      index: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    city: {
      type: String,
      trim: true,
    },
    supportedCurrencies: {
      type: [String],
      default: ['USD'],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
      index: true,
    },
    transactionFee: {
      type: Number,
      default: 1.0,
      min: 0,
    },
    averageLatency: {
      type: Number,
      default: 50,
      min: 1,
    },
    liquidity: {
      type: Number,
      default: 1000000,
      min: 0,
    },
    reliability: {
      type: Number,
      default: 0.999,
      min: 0,
      max: 1.0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const PaymentProvider: Model<IPaymentProviderDocument> =
  (mongoose.models.PaymentProvider as Model<IPaymentProviderDocument>) ||
  mongoose.model<IPaymentProviderDocument>('PaymentProvider', PaymentProviderSchema);

export default PaymentProvider;

