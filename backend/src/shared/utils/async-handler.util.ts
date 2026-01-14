import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors/error-handler';

/**
 * Wraps an async route handler to automatically catch errors
 * Similar to NestJS exception filters/interceptors
 * 
 * @param handler The async route handler function
 * @returns Wrapped handler with automatic error handling
 */
export function asyncHandler<T extends FastifyRequest = FastifyRequest>(
  handler: (request: T, reply: FastifyReply) => Promise<any>
) {
  return async (request: T, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      // If it's our custom AppError, handle it
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      // Re-throw other errors to be handled by global error handler
      throw error;
    }
  };
}

