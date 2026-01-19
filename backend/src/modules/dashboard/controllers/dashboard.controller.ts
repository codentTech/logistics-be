import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "../services/dashboard.service";
import { getTenantId } from "../../tenants/tenant.decorator";
import { sendSuccess } from "../../../shared/utils/response.util";
import { asyncHandler } from "../../../shared/utils/async-handler.util";
import { UserRole } from "../../../infra/db/entities/User";
import { AppDataSource } from "../../../infra/db/data-source";
import { Driver } from "../../../infra/db/entities/Driver";

/**
 * Helper to get driverId from user
 */
async function getDriverIdFromUser(userId: string, tenantId: string): Promise<string | undefined> {
  const driverRepository = AppDataSource.getRepository(Driver);
  const driver = await driverRepository.findOne({
    where: { userId, tenantId, isActive: true },
  });
  return driver?.id;
}

/**
 * Handler for GET /v1/dashboard/summary
 */
export const getDashboardSummaryHandler = (fastify: FastifyInstance) =>
  asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const dashboardService = new DashboardService();
    const tenantId = getTenantId(request);
    const user = (request as any).user;
    
    // Get driverId if user is a driver
    const driverId = user.role === UserRole.DRIVER
      ? await getDriverIdFromUser(user.userId, tenantId)
      : undefined;

    const summary = await dashboardService.getSummary(
      tenantId,
      fastify.redis,
      user.role as UserRole,
      driverId,
      fastify.io
    );
    return sendSuccess(reply, summary);
  });
