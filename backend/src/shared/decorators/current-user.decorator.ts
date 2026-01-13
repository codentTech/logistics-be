import { FastifyRequest } from 'fastify';
import { AppError, ErrorCode } from '../errors/error-handler';

export interface CurrentUserPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

// Fastify helper to get current user from request
export function getCurrentUser(request: FastifyRequest): CurrentUserPayload {
  if (!request.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
  }
  return request.user as CurrentUserPayload;
}

