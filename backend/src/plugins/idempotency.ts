import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { redisConfig } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  // Redis should already be available from redisPlugin
  if (!fastify.redis) {
    throw new Error('Redis plugin must be registered before idempotency plugin');
  }

  // Register idempotency middleware as onValidation hook
  // This runs after preHandler (where authentication happens) but before handler
  fastify.addHook('onRequest', async (request: any, reply: any) => {
    // Only apply to POST, PUT, PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return; // Skip if no idempotency key
    }

    // Skip idempotency check here - will be handled after authentication
    // Store key for later processing
    (request as any).__idempotencyKey = idempotencyKey;
    return;
  });

  // Process idempotency after authentication
  // preValidation runs AFTER route's preHandler (where authentication happens)
  fastify.addHook('preValidation', async (request: any, reply: any) => {
    // Only apply to POST, PUT, PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return;
    }

    const idempotencyKey = (request as any).__idempotencyKey;
    if (!idempotencyKey) {
      return; // Skip if no idempotency key
    }

    // Check if user is authenticated (set by route's preHandler)
    const user = request.user;
    if (!user || !user.tenantId) {
      return; // Skip if not authenticated
    }

    // Now we can safely use tenant-scoped idempotency
    const tenantId = user.tenantId;
    const redisKey = `idempotency:${tenantId}:${idempotencyKey}`;
    const ttl = 3600; // 1 hour

    // Try to set the key (SETNX - Set if Not eXists)
    const setResult = await fastify.redis.set(redisKey, 'processing', 'EX', ttl, 'NX');

    if (!setResult) {
      // Key already exists - this is a duplicate request
      const cachedResponse = await fastify.redis.get(redisKey);
      
      if (cachedResponse && cachedResponse !== 'processing') {
        // Return cached response
        const parsed = JSON.parse(cachedResponse);
        return reply.status(parsed.statusCode || 200).send(parsed.body);
      }

      // Still processing - wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryCached = await fastify.redis.get(redisKey);
      
      if (retryCached && retryCached !== 'processing') {
        const parsed = JSON.parse(retryCached);
        return reply.status(parsed.statusCode || 200).send(parsed.body);
      }

      // Return error for duplicate request
      throw new (await import('../shared/errors/error-handler')).AppError(
        (await import('../shared/errors/error-handler')).ErrorCode.DUPLICATE_REQUEST,
        'Duplicate request detected. Please wait for the previous request to complete.',
        409
      );
    }

    // Store original send function
    const originalSend = reply.send.bind(reply);

    // Override send to cache response
    reply.send = function (payload: any) {
      // Cache the response
      const responseToCache = JSON.stringify({
        statusCode: reply.statusCode,
        body: payload,
      });
      
      fastify.redis.set(redisKey, responseToCache, 'EX', ttl).catch(() => {
        // Failed to cache - non-critical
      });

      return originalSend(payload);
    };
  });
};

export default fp(idempotencyPlugin, {
  name: 'idempotency',
});

