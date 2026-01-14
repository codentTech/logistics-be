import { FastifyInstance } from 'fastify';
import { getDashboardSummarySchema } from '../schemas/dashboard.schema';
import { getDashboardSummaryHandler } from '../controllers/dashboard.controller';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Get dashboard summary (All authenticated users - Admin, Driver, Customer)
  fastify.get(
    '/v1/dashboard/summary',
    {
      preHandler: [fastify.authenticate],
      schema: getDashboardSummarySchema,
    },
    getDashboardSummaryHandler(fastify)
  );
}

