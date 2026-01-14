import { FastifyInstance } from 'fastify';
import {
  getAllDriversSchema,
  getDriverByIdSchema,
  updateDriverLocationSchema,
} from '../schemas/drivers.schema';
import {
  getAllDriversHandler,
  getDriverByIdHandler,
  updateDriverLocationHandler,
} from '../controllers/drivers.controller';
import { requireAdminOrDriver } from '../../../shared/guards/role.guard';

export async function driverRoutes(fastify: FastifyInstance) {
  // Get all drivers (Admin or Driver - needed for dashboard dropdown)
  fastify.get(
    '/v1/drivers',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: getAllDriversSchema,
    },
    getAllDriversHandler(fastify)
  );

  // Get driver by ID (Admin or Driver - driver can only view own details)
  fastify.get<{ Params: { id: string } }>(
    '/v1/drivers/:id',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: getDriverByIdSchema,
    },
    getDriverByIdHandler(fastify)
  );

  // Update driver location (Admin or Driver - but driver can only update own location)
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/drivers/:id/location',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: updateDriverLocationSchema,
    },
    updateDriverLocationHandler(fastify)
  );
}

