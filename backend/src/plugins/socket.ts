import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { redisConfig } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

const socketPlugin: FastifyPluginAsync = async (fastify) => {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Use Redis adapter for multi-instance scaling (if Redis is available)
  let pubClient: Redis | null = null;
  let subClient: Redis | null = null;

  try {
    pubClient = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      enableOfflineQueue: true, // Allow queuing commands when offline
      connectTimeout: 15000, // 15 seconds (Windows compatibility)
      family: 4, // Use IPv4 (Windows compatibility)
      retryStrategy: (times) => {
        if (times > 10) {
          return null; // Stop retrying after 10 attempts
        }
        return Math.min(times * 50, 2000);
      },
    });

    subClient = pubClient.duplicate();

    // Add error handlers to prevent "missing 'error' handler" warnings
    pubClient.on('error', (err) => {
      fastify.log.warn({ err }, 'Redis pub client error');
    });

    subClient.on('error', (err) => {
      fastify.log.warn({ err }, 'Redis sub client error');
    });

    // Try to connect, but don't fail if Redis is unavailable
    try {
      await Promise.race([
        pubClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);
      io.adapter(createAdapter(pubClient, subClient));
      fastify.log.info('✅ Socket.IO using Redis adapter');
    } catch (error) {
      fastify.log.warn('⚠️  Redis not available for Socket.IO - using in-memory adapter');
      // Clean up failed clients
      if (pubClient) {
        pubClient.quit().catch(() => {});
        pubClient = null;
      }
      if (subClient) {
        subClient.quit().catch(() => {});
        subClient = null;
      }
    }
  } catch (error) {
    fastify.log.warn('⚠️  Failed to initialize Redis for Socket.IO - using in-memory adapter');
    // Continue without Redis adapter
  }

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = await fastify.jwt.verify(token);
      
      // Attach user info to socket
      (socket as any).user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    const tenantId = user.tenantId;

    // Join tenant room automatically on connection
    socket.join(`tenant:${tenantId}`);
    fastify.log.info(`Socket connected: ${socket.id} (tenant: ${tenantId})`);

    // Handle explicit join-tenant event (for reconnection scenarios)
    socket.on('join-tenant', (roomTenantId: string) => {
      if (roomTenantId && roomTenantId === tenantId) {
        socket.join(`tenant:${tenantId}`);
        fastify.log.info(`Socket ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  fastify.decorate('io', io);

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await new Promise<void>((resolve) => {
      io.close(() => {
        if (pubClient) pubClient.quit();
        if (subClient) subClient.quit();
        resolve();
      });
    });
  });
};

export default fp(socketPlugin, {
  name: 'socket',
  dependencies: ['@fastify/jwt'],
});
