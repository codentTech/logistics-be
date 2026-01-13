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

export async function driverRoutes(fastify: FastifyInstance) {
  // Get all drivers
  fastify.get(
    '/v1/drivers',
    {
      preHandler: [fastify.authenticate],
      schema: getAllDriversSchema,
    },
    getAllDriversHandler(fastify)
  );

  // Get driver by ID
  fastify.get<{ Params: { id: string } }>(
    '/v1/drivers/:id',
    {
      preHandler: [fastify.authenticate],
      schema: getDriverByIdSchema,
    },
    getDriverByIdHandler(fastify)
  );

  // Update driver location
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/drivers/:id/location',
    {
      preHandler: [fastify.authenticate],
      schema: updateDriverLocationSchema,
    },
    updateDriverLocationHandler(fastify)
  );
}

