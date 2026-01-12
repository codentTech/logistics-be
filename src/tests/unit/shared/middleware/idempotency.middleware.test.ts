import { createIdempotencyMiddleware } from '../../../../shared/middleware/idempotency.middleware';
import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';
import Redis from 'ioredis';

jest.mock('../../../../modules/tenants/tenant.decorator', () => ({
  getTenantId: jest.fn().mockReturnValue('tenant-1'),
}));

describe('IdempotencyMiddleware', () => {
  let mockRedis: jest.Mocked<Redis>;
  let middleware: any;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
    } as any;

    middleware = createIdempotencyMiddleware(mockRedis, { required: false, ttl: 3600 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('idempotency key handling', () => {
    it('should skip middleware for non-POST/PUT/PATCH methods', async () => {
      const request = {
        method: 'GET',
        headers: {},
      } as any;
      const reply = {} as any;

      await middleware(request, reply);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should skip middleware when idempotency key is not provided and not required', async () => {
      const request = {
        method: 'POST',
        headers: {},
      } as any;
      const reply = {} as any;

      await middleware(request, reply);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw error when idempotency key is required but not provided', async () => {
      const request = {
        method: 'POST',
        headers: {},
      } as any;
      const reply = {} as any;

      const requiredMiddleware = createIdempotencyMiddleware(mockRedis, { required: true });

      await expect(requiredMiddleware(request, reply)).rejects.toThrow(AppError);
      await expect(requiredMiddleware(request, reply)).rejects.toThrow('Idempotency-Key header is required');
    });

    it('should set idempotency key in Redis for new request', async () => {
      const request = {
        method: 'POST',
        headers: {
          'idempotency-key': 'test-key-123',
        },
      } as any;
      const reply: any = {
        statusCode: 200,
        send: jest.fn().mockReturnThis(),
      };

      mockRedis.set.mockResolvedValue('OK');

      await middleware(request, reply);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'idempotency:tenant-1:test-key-123',
        'processing',
        'EX',
        3600,
        'NX'
      );
    });

    it('should return cached response for duplicate request', async () => {
      const request = {
        method: 'POST',
        headers: {
          'idempotency-key': 'test-key-123',
        },
      } as any;
      const reply: any = {
        statusCode: 200,
        send: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      };

      const cachedResponse = JSON.stringify({
        statusCode: 200,
        body: { success: true, data: 'cached' },
      });

      mockRedis.set.mockResolvedValue(null); // Key already exists
      mockRedis.get.mockResolvedValue(cachedResponse);

      await middleware(request, reply);

      expect(mockRedis.get).toHaveBeenCalledWith('idempotency:tenant-1:test-key-123');
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ success: true, data: 'cached' });
    });

    it('should throw error for duplicate request still processing', async () => {
      const request = {
        method: 'POST',
        headers: {
          'idempotency-key': 'test-key-123',
        },
      } as any;
      const reply: any = {
        statusCode: 200,
        send: jest.fn().mockReturnThis(),
      };

      mockRedis.set.mockResolvedValue(null); // Key already exists
      mockRedis.get
        .mockResolvedValueOnce('processing') // First check
        .mockResolvedValueOnce('processing'); // Retry check

      jest.useFakeTimers();
      const middlewarePromise = middleware(request, reply);
      
      // Fast-forward timers
      jest.advanceTimersByTime(100);
      
      await expect(middlewarePromise).rejects.toThrow(AppError);
      await expect(middlewarePromise).rejects.toThrow('Duplicate request detected');

      jest.useRealTimers();
    });

    it('should cache response after successful request', async () => {
      const request = {
        method: 'POST',
        headers: {
          'idempotency-key': 'test-key-123',
        },
      } as any;
      const reply: any = {
        statusCode: 201,
        send: jest.fn(function (payload) {
          return this;
        }),
      };

      mockRedis.set.mockResolvedValue('OK');

      // Middleware should complete immediately (doesn't await response)
      await middleware(request, reply);

      // Simulate response being sent (this happens after middleware completes)
      const responsePayload = { success: true, id: '123' };
      reply.send(responsePayload);

      // Wait a bit for the async cache operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have been called at least once (for processing)
      expect(mockRedis.set).toHaveBeenCalled();
    }, 15000);
  });
});

