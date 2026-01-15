import { FastifySchema } from 'fastify';

/**
 * Schema for GET /v1/dashboard/summary
 */
export const getDashboardSummarySchema: FastifySchema = {
  summary: 'Get dashboard summary',
  description: `
Get real-time operational dashboard summary for the authenticated tenant.

**Access:** All authenticated users (Admin, Driver, Customer)

**Data Source:**
Uses CQRS read model for optimal performance. Data is cached and refreshed periodically.

**Response Includes:**
- \`totalShipments\`: Total number of shipments in the tenant
- \`activeShipments\`: Number of active shipments (CREATED, ASSIGNED, APPROVED, IN_TRANSIT)
- \`deliveredToday\`: Number of shipments delivered today
- \`driversOnline\`: Number of drivers currently online (with recent location updates)
- \`lastUpdated\`: Timestamp when summary was last updated

**Performance:**
This endpoint is optimized for frequent polling. Data is cached in Redis and updated asynchronously.
  `,
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

