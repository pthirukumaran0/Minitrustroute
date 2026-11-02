import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Server-side JWT revocation list (logout / role switch).
 * Each entry expires automatically (TTL index) when the original token would have expired,
 * so the collection never grows unbounded.
 */
export interface IRevokedToken {
  jti: string;
  userId?: string;
  reason: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRevokedTokenDocument extends IRevokedToken, Document {}

const RevokedTokenSchema = new Schema<IRevokedTokenDocument>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: String },
    reason: { type: String, default: 'LOGOUT' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RevokedToken: Model<IRevokedTokenDocument> =
  (mongoose.models.RevokedToken as Model<IRevokedTokenDocument>) ||
  mongoose.model<IRevokedTokenDocument>('RevokedToken', RevokedTokenSchema);

export default RevokedToken;

