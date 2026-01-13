import { FastifySchema } from 'fastify';

/**
 * Schema for GET /v1/dashboard/summary
 */
export const getDashboardSummarySchema: FastifySchema = {
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
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

