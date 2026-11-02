import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'sender' | 'analyst' | 'admin';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  organization: string;
  status: UserStatus;
  /** E.164 mobile number used as the subject for (simulated) CAMARA telecom checks. */
  mobileNumber?: string;
  /**
   * Academic demo flag. Only accounts with this flag may use the demo role switcher
   * (POST /api/auth/quick-switch). Public registrations never receive it.
   */
  demoRoleSwitch?: boolean;
  lastLogin?: Date;
  lastLoginAt?: Date;
  loginCount?: number;
  anonymousId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  toSafeObject(): Omit<IUser, 'passwordHash' | 'salt' | 'demoRoleSwitch'> & {
    id: string;
    canSwitchRoles: boolean;
  };
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    salt: {
      type: String,
      required: [true, 'Salt is required'],
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['sender', 'analyst', 'admin'],
      default: 'sender',
      index: true,
    },
    organization: {
      type: String,
      trim: true,
      default: 'TrustRoute Client',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    demoRoleSwitch: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    anonymousId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.salt;
  obj.canSwitchRoles = Boolean(obj.demoRoleSwitch);
  delete obj.demoRoleSwitch;
  obj.id = obj._id.toString();
  return obj;
};

const User: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', UserSchema);

export default User;

