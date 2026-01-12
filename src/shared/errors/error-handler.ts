import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from './error-codes';

export { ErrorCode };

export interface ApiError {
  success: false;
  error_code: string;
  message: string;
  details?: any;
}

export class AppError extends Error {
  constructor(
    public errorCode: ErrorCode | string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): ApiError {
    return {
      success: false,
      error_code: this.errorCode,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Handle our custom AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(error.toJSON());
  }

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error_code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: error.validation,
    });
  }

  // Handle JWT errors
  if (error.name === 'UnauthorizedError' || error.statusCode === 401) {
    return reply.status(401).send({
      success: false,
      error_code: ErrorCode.UNAUTHORIZED,
      message: 'Unauthorized',
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error_code: error.name || ErrorCode.INTERNAL_SERVER_ERROR,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}

