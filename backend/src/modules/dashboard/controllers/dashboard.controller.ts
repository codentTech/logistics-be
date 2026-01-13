import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from '../services/dashboard.service';
import { getTenantId } from '../../tenants/tenant.decorator';
import { AppError } from '../../../shared/errors/error-handler';

/**
 * Handler for GET /v1/dashboard/summary
 */
export const getDashboardSummaryHandler =
  (fastify: FastifyInstance) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dashboardService = new DashboardService();
      const tenantId = getTenantId(request);
      const summary = await dashboardService.getSummary(tenantId, fastify.redis);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };
