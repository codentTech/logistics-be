import { FastifyInstance } from 'fastify';
import {
  getAllShipmentsSchema,
  getShipmentByIdSchema,
  createShipmentSchema,
  assignDriverSchema,
  updateStatusSchema,
} from '../schemas/shipments.schema';
import {
  getAllShipmentsHandler,
  getShipmentByIdHandler,
  createShipmentHandler,
  assignDriverHandler,
  updateStatusHandler,
} from '../controllers/shipments.controller';

export async function shipmentRoutes(fastify: FastifyInstance) {
  // Get all shipments
  fastify.get(
    '/v1/shipments',
    {
      preHandler: [fastify.authenticate],
      schema: getAllShipmentsSchema,
    },
    getAllShipmentsHandler(fastify)
  );

  // Get shipment by ID
  fastify.get<{ Params: { id: string } }>(
    '/v1/shipments/:id',
    {
      preHandler: [fastify.authenticate],
      schema: getShipmentByIdSchema,
    },
    getShipmentByIdHandler(fastify)
  );

  // Create shipment
  fastify.post<{ Body: any }>(
    '/v1/shipments',
    {
      preHandler: [fastify.authenticate],
      schema: createShipmentSchema,
    },
    createShipmentHandler(fastify)
  );

  // Assign driver
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/shipments/:id/assign-driver',
    {
      preHandler: [fastify.authenticate],
      schema: assignDriverSchema,
    },
    assignDriverHandler(fastify)
  );

  // Update status
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/shipments/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: updateStatusSchema,
    },
    updateStatusHandler(fastify)
  );
}

