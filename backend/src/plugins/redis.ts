import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { redisConfig } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    // Connection settings
    connectTimeout: 15000, // 15 seconds (increased for Windows compatibility)
    commandTimeout: 5000, // 5 seconds
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      // Don't retry forever - stop after 10 attempts
      if (times > 10) {
        fastify.log.warn('Redis connection failed after 10 retries - continuing without Redis');
        return null; // Stop retrying
      }
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true, // Don't auto-connect, we'll connect manually
    enableOfflineQueue: false, // Don't queue commands when offline
    // Performance settings
    keepAlive: 30000, // 30 seconds
    // Windows compatibility: Use IPv4 (better Windows compatibility)
    family: 4, // Use IPv4
    // Reconnection settings
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on READONLY error
      }
      return false;
    },
    // Connection pool settings
    enableReadyCheck: true,
    // Windows: Disable auto-resubscribe to prevent connection issues
    enableAutoPipelining: false,
  });

  redis.on('error', (err) => {
    // Don't crash - just log the error
    fastify.log.warn({ err }, 'Redis connection error - some features may be unavailable');
    fastify.log.warn('   Start Redis with: docker-compose up -d redis');
  });

  redis.on('connect', () => {
    fastify.log.info('✅ Redis connected');
  });

  redis.on('ready', () => {
    fastify.log.info('✅ Redis ready');
  });

  redis.on('close', () => {
    fastify.log.warn('Redis connection closed');
  });

  // Try to connect, but don't fail if it doesn't work
  try {
    await redis.connect();
  } catch (error) {
    fastify.log.warn({ err: error }, '⚠️  Redis connection failed - continuing without Redis');
    fastify.log.warn('   Some features (idempotency, caching, real-time) may not work');
    fastify.log.warn('   Start Redis with: docker-compose up -d redis');
    fastify.log.warn('   Or install Redis on Windows: https://github.com/microsoftarchive/redis/releases');
    fastify.log.warn('   Or use WSL2: wsl --install and then install Redis in WSL');
  }

  // Attach Redis to fastify instance (even if not connected)
  fastify.decorate('redis', redis);

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: 'redis',
});
