import { FastifyInstance } from 'fastify';
import {
  getAllShipmentsSchema,
  getShipmentByIdSchema,
  createShipmentSchema,
  assignDriverSchema,
  updateStatusSchema,
  approveAssignmentSchema,
  rejectAssignmentSchema,
  cancelByCustomerSchema,
  cancelByDriverSchema,
  getShipmentRouteSchema,
} from '../schemas/shipments.schema';
import {
  getAllShipmentsHandler,
  getShipmentByIdHandler,
  createShipmentHandler,
  assignDriverHandler,
  updateStatusHandler,
  cancelByCustomerHandler,
  cancelByDriverHandler,
  approveAssignmentHandler,
  rejectAssignmentHandler,
  getShipmentRouteHandler,
} from '../controllers/shipments.controller';
import { requireAdmin, requireAdminOrDriver, requireCustomer, requireDriver } from '../../../shared/guards/role.guard';

export async function shipmentRoutes(fastify: FastifyInstance) {
  // Get all shipments (Admin or Driver)
  fastify.get(
    '/v1/shipments',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: getAllShipmentsSchema,
    },
    getAllShipmentsHandler(fastify)
  );

  // Get shipment by ID (Admin or Driver)
  fastify.get<{ Params: { id: string } }>(
    '/v1/shipments/:id',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: getShipmentByIdSchema,
    },
    getShipmentByIdHandler(fastify)
  );

  // Create shipment (Admin only)
  fastify.post<{ Body: any }>(
    '/v1/shipments',
    {
      preHandler: [fastify.authenticate, requireAdmin()],
      schema: createShipmentSchema,
    },
    createShipmentHandler(fastify)
  );

  // Assign driver (Admin only)
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/shipments/:id/assign-driver',
    {
      preHandler: [fastify.authenticate, requireAdmin()],
      schema: assignDriverSchema,
    },
    assignDriverHandler(fastify)
  );

  // Update status (Admin or Driver)
  fastify.post<{ Params: { id: string }; Body: any }>(
    '/v1/shipments/:id/status',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: updateStatusSchema,
    },
    updateStatusHandler(fastify)
  );

  // Cancel by customer (Customer only)
  fastify.post<{ Params: { id: string } }>(
    '/v1/shipments/:id/cancel-by-customer',
    {
      preHandler: [fastify.authenticate, requireCustomer()],
      schema: cancelByCustomerSchema,
    },
    cancelByCustomerHandler(fastify)
  );

  // Cancel by driver (Driver only)
  fastify.post<{ Params: { id: string } }>(
    '/v1/shipments/:id/cancel-by-driver',
    {
      preHandler: [fastify.authenticate, requireDriver()],
      schema: cancelByDriverSchema,
    },
    cancelByDriverHandler(fastify)
  );

  // Approve assignment (Driver only)
  fastify.post<{ Params: { id: string } }>(
    '/v1/shipments/:id/approve',
    {
      preHandler: [fastify.authenticate, requireDriver()],
      schema: approveAssignmentSchema,
    },
    approveAssignmentHandler(fastify)
  );

  // Reject assignment (Driver only)
  fastify.post<{ Params: { id: string } }>(
    '/v1/shipments/:id/reject',
    {
      preHandler: [fastify.authenticate, requireDriver()],
      schema: rejectAssignmentSchema,
    },
    rejectAssignmentHandler(fastify)
  );

  // Get shipment route (Admin or Driver)
  fastify.get<{ Params: { id: string } }>(
    '/v1/shipments/:id/route',
    {
      preHandler: [fastify.authenticate, requireAdminOrDriver()],
      schema: getShipmentRouteSchema,
    },
    getShipmentRouteHandler(fastify)
  );
}

