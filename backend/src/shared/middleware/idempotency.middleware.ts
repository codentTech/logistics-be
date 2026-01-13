import { FastifyRequest, FastifyReply } from 'fastify';
import { Redis } from 'ioredis';
import { getTenantId } from '../../modules/tenants/tenant.decorator';
import { AppError, ErrorCode } from '../errors/error-handler';

export interface IdempotencyOptions {
  required?: boolean; // Whether idempotency key is required
  ttl?: number; // TTL in seconds (default: 3600 = 1 hour)
}

export function createIdempotencyMiddleware(redis: Redis, options: IdempotencyOptions = {}) {
  const { required = false, ttl = 3600 } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only apply to POST, PUT, PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      if (required) {
        throw new AppError(
          ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
          'Idempotency-Key header is required',
          400
        );
      }
      return; // Skip idempotency check if key not provided
    }

    // Get tenant ID if user is authenticated
    // Note: For routes with preHandler authentication, user may not be set yet in onRequest hook
    // We'll use a deferred approach - store the idempotency key and check it later
    const user = (request as any).user;
    
    // If user is not authenticated yet, we can't use tenant-scoped keys
    // Skip idempotency check here - it will be handled by route-specific logic if needed
    // OR we can defer the check until after authentication
    if (!user || !user.tenantId) {
      // User not authenticated yet - store idempotency key in request for later use
      // Routes with authentication will handle idempotency after auth
      (request as any).idempotencyKey = idempotencyKey;
      return; // Skip idempotency check for now
    }

    const tenantId = user.tenantId;
    const redisKey = `idempotency:${tenantId}:${idempotencyKey}`;

    // Try to set the key (SETNX - Set if Not eXists)
    const setResult = await redis.set(redisKey, 'processing', 'EX', ttl, 'NX');

    if (!setResult) {
      // Key already exists - this is a duplicate request
      // Get the cached response
      const cachedResponse = await redis.get(redisKey);
      
      if (cachedResponse && cachedResponse !== 'processing') {
        // Return cached response
        const parsed = JSON.parse(cachedResponse);
        return reply.status(parsed.statusCode || 200).send(parsed.body);
      }

      // Still processing - wait a bit and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryCached = await redis.get(redisKey);
      
      if (retryCached && retryCached !== 'processing') {
        const parsed = JSON.parse(retryCached);
        return reply.status(parsed.statusCode || 200).send(parsed.body);
      }

      // Return error for duplicate request
      throw new AppError(
        ErrorCode.DUPLICATE_REQUEST,
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
      
      redis.set(redisKey, responseToCache, 'EX', ttl).catch((err) => {
        // Failed to cache idempotency response - non-critical
      });

      return originalSend(payload);
    };
  };
}

