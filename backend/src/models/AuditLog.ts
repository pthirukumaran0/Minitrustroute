import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog {
  timestamp: Date;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actorRole: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'BLOCKED'],
      default: 'SUCCESS',
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ timestamp: -1 });

const AuditLog: Model<IAuditLogDocument> =
  (mongoose.models.AuditLog as Model<IAuditLogDocument>) ||
  mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);

export default AuditLog;

