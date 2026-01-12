import { FastifyRequest } from "fastify";
import { AppError, ErrorCode } from "../../shared/errors/error-handler";

/**
 * Extract tenant ID from authenticated user
 * Use this in routes that require tenant context
 */
export function getTenantId(request: FastifyRequest): string {
  const user = (request as any).user;
  if (!user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "User not authenticated", 401);
  }
  return user.tenantId;
}

/**
 * Ensure request has tenant context
 */
export function requireTenant(request: FastifyRequest): void {
  const user = (request as any).user;
  if (!user || !user.tenantId) {
    throw new Error("Tenant context required");
  }
}
