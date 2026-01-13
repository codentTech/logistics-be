import { FastifyRequest } from 'fastify';

export interface CurrentUserPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

// Fastify-specific decorator (using request.user)
export function getCurrentUser(request: FastifyRequest): CurrentUserPayload {
  return request.user as CurrentUserPayload;
}

