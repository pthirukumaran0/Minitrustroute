import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app';
import { connectToDatabase } from './lib/database';
import { ensureStableAnonymousIds } from './lib/userUtils';
import { getNeo4jDriver, closeNeo4jDriver } from './lib/neo4j';
const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  try {
    console.log('====================================================');
    console.log('🚀 TrustRoute Standalone Backend Service');
    console.log('====================================================');

    // 1. Start Express HTTP listener immediately so health & monitoring endpoints respond
    const server = app.listen(PORT, () => {
      console.log(`\n⚡ Backend API server listening at http://localhost:${PORT} (port ${PORT})`);
      console.log(`📡 Health check available at: http://localhost:${PORT}/api/health`);
      console.log(`💳 Transactions endpoint: http://localhost:${PORT}/api/transactions`);
      console.log(`🗺️ Network topology: http://localhost:${PORT}/api/network\n`);
    });

    // 2. Initialize MongoDB connection (non-fatal on initial start; dynamic retry on requests)
    try {
      console.log('📦 Connecting to MongoDB...');
      await connectToDatabase();
      console.log('✅ MongoDB connected successfully.');
      await ensureStableAnonymousIds().catch((err) => console.warn('Anonymous ID sync notice:', err.message));
    } catch (mongoErr: unknown) {
      const msg = mongoErr instanceof Error ? mongoErr.message : String(mongoErr);
      console.warn(`⚠️ Warning: MongoDB initial connection failed: ${msg}. Endpoints will retry on request.`);
    }

    // 3. Initialize Neo4j Driver (non-fatal on initial start; dynamic retry on requests)
    try {
      console.log('🌐 Verifying Neo4j connection...');
      const neoDriver = getNeo4jDriver();
      await neoDriver.verifyConnectivity();
      console.log('✅ Neo4j connection verified.');
    } catch (neoErr: unknown) {
      const msg = neoErr instanceof Error ? neoErr.message : String(neoErr);
      console.warn(`⚠️ Warning: Neo4j initial connection failed: ${msg}. Graph routing will retry on request.`);
    }

    // Graceful Shutdown
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        try {
          await closeNeo4jDriver();
          console.log('Closed Neo4j driver.');
        } catch (e) {
          console.error('Error closing Neo4j driver:', e);
        }
        try {
          const mongoose = await import('mongoose');
          await mongoose.default.disconnect();
          console.log('Closed MongoDB connection.');
        } catch (e) {
          console.error('Error closing MongoDB connection:', e);
        }
        process.exit(0);
      });
      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 8000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start TrustRoute backend server:', error);
    process.exit(1);
  }
}

startServer();

