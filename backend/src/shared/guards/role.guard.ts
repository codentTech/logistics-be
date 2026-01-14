import { FastifyRequest, FastifyReply } from "fastify";
import { AppError, ErrorCode } from "../errors/error-handler";
import { UserRole } from "../../infra/db/entities/User";

/**
 * Role-based access control guard
 * Use this to restrict routes to specific user roles
 * 
 * @param allowedRoles - Array of roles that can access this route
 * @returns Fastify preHandler hook
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "User not authenticated", 401);
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        403
      );
    }
  };
}

/**
 * Helper function to get role guard for admin only
 */
export function requireAdmin() {
  return requireRole([UserRole.OPS_ADMIN]);
}

/**
 * Helper function to get role guard for driver only
 */
export function requireDriver() {
  return requireRole([UserRole.DRIVER]);
}

/**
 * Helper function to get role guard for customer only
 */
export function requireCustomer() {
  return requireRole([UserRole.CUSTOMER]);
}

/**
 * Helper function to get role guard for admin or driver
 */
export function requireAdminOrDriver() {
  return requireRole([UserRole.OPS_ADMIN, UserRole.DRIVER]);
}

