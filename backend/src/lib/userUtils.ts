import User, { IUserDocument } from '../models/User';

/**
 * Ensures all users in MongoDB have a persistent, stable, unique Anonymous ID (e.g., USR-1001).
 * Never regenerates IDs for users who already have one.
 */
export async function ensureStableAnonymousIds(): Promise<void> {
  const usersWithoutId = await User.find({
    $or: [{ anonymousId: { $exists: false } }, { anonymousId: null }, { anonymousId: '' }],
  }).sort({ createdAt: 1, _id: 1 });

  if (usersWithoutId.length === 0) return;

  // Find the highest existing USR-XXXX number
  const existingUsersWithId = await User.find({
    anonymousId: { $regex: /^USR-\d+$/ },
  }).select('anonymousId').lean();

  let maxNum = 1000;
  for (const u of existingUsersWithId) {
    if (u.anonymousId) {
      const match = u.anonymousId.match(/^USR-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  for (const user of usersWithoutId) {
    maxNum += 1;
    user.anonymousId = `USR-${maxNum}`;
    if (!user.loginCount) {
      user.loginCount = 1;
    }
    if (!user.lastLoginAt) {
      user.lastLoginAt = user.lastLogin || user.createdAt || new Date();
    }
    await user.save();
  }
}

/**
 * Generates or retrieves a stable anonymous ID for a single user document.
 */
export async function getOrAssignAnonymousId(user: IUserDocument): Promise<string> {
  if (user.anonymousId) return user.anonymousId;

  await ensureStableAnonymousIds();
  const refreshed = await User.findById(user._id).select('anonymousId').lean();
  return refreshed?.anonymousId || `USR-1001`;
}

