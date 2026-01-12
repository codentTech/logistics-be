import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service';
import { getTenantId } from '../tenants/tenant.decorator';
import { AppError } from '../../shared/errors/error-handler';

export async function dashboardRoutes(fastify: FastifyInstance) {
  const dashboardService = new DashboardService();

  // Get dashboard summary (CQRS read)
  fastify.get(
    '/v1/dashboard/summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Get operational dashboard summary (CQRS read)',
        tags: ['dashboard'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  tenantId: { type: 'string' },
                  totalShipments: { type: 'number' },
                  activeShipments: { type: 'number' },
                  deliveredToday: { type: 'number' },
                  driversOnline: { type: 'number' },
                  lastUpdated: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
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
    }
  );
}

