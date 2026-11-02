import mongoose from 'mongoose';

/**
 * Global interface for caching the Mongoose connection across hot-reloads in Next.js.
 * Without this caching mechanism, every code change in development would create
 * a new connection to MongoDB, quickly exhausting the database connection pool.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Reuse the existing cached connection if available, otherwise initialize empty
let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Establishes or reuses an existing Mongoose connection.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'Missing MONGODB_URI environment variable. Please define it in your .env.local file.'
    );
  }

  // If a connection is already established, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is in-flight, await the same promise
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Fail fast if commands are executed before connection is established
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      // Reset cached state if connection is lost so the next request can reconnect
      mongooseInstance.connection.on('disconnected', () => {
        cached.conn = null;
        cached.promise = null;
      });
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset promise so subsequent requests can retry connecting
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/**
 * Performs an active ping check on MongoDB to verify end-to-end connectivity.
 */
export async function checkMongoHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const instance = await connectToDatabase();
    const db = instance.connection.db;

    if (!db) {
      return {
        status: 'unhealthy',
        error: 'Database reference is undefined after connection.',
      };
    }

    // Run ping command to verify the database engine is responsive
    await db.admin().ping();
    const latencyMs = Date.now() - startTime;

    return {
      status: 'healthy',
      latencyMs,
    };
  } catch (err: unknown) {
    return {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

