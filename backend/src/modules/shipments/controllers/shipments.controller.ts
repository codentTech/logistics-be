import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ShipmentService } from "../services/shipments.service";
import { RouteSimulationService } from "../services/route-simulation.service";
import {
  CreateShipmentDto,
  AssignDriverDto,
  UpdateShipmentStatusDto,
} from "../dto/shipments.dto";
import { getTenantId } from "../../tenants/tenant.decorator";
import { ShipmentStatus } from "../../../infra/db/entities/Shipment";
import { UserRole } from "../../../infra/db/entities/User";
import { sendSuccess } from "../../../shared/utils/response.util";
import { asyncHandler } from "../../../shared/utils/async-handler.util";
import { requireAdmin, requireAdminOrDriver } from "../../../shared/guards/role.guard";
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
 * Handler for GET /v1/shipments
 */
export const getAllShipmentsHandler = (fastify: FastifyInstance) =>
  asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const shipmentService = new ShipmentService();
    const tenantId = getTenantId(request);
    const user = (request as any).user;
    const query = request.query as { status?: string };
    
    // Get driverId if user is a driver
    const driverId = user.role === UserRole.DRIVER
      ? await getDriverIdFromUser(user.userId, tenantId)
      : undefined;

    const shipments = await shipmentService.getAllShipments(
      tenantId,
      query.status,
      user.role as UserRole,
      driverId
    );
    return sendSuccess(reply, shipments);
  });

/**
 * Handler for GET /v1/shipments/:id
 */
export const getShipmentByIdHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      
      // Get driverId if user is a driver
      const driverId = user.role === UserRole.DRIVER
        ? await getDriverIdFromUser(user.userId, tenantId)
        : undefined;

      const shipment = await shipmentService.getShipmentById(
        request.params.id,
        tenantId,
        user.role as UserRole,
        driverId
      );
      if (!shipment) {
        return reply.status(404).send({
          success: false,
          error_code: "SHIPMENT_NOT_FOUND",
          message: "Shipment not found",
        });
      }
      return sendSuccess(reply, shipment);
    }
  );

/**
 * Handler for POST /v1/shipments
 */
export const createShipmentHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Body: CreateShipmentDto }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      const shipment = await shipmentService.createShipment(
        tenantId,
        request.body,
        user.userId
      );
      return sendSuccess(reply, shipment, 201);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/assign-driver
 */
export const assignDriverHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AssignDriverDto;
      }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      const shipment = await shipmentService.assignDriver(
        request.params.id,
        tenantId,
        request.body,
        user.userId
      );

      // Emit Socket.IO event for real-time updates
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipment.id,
          newStatus: shipment.status,
          driverId: shipment.driverId,
        });
      }

      return sendSuccess(reply, shipment);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/status
 */
export const updateStatusHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateShipmentStatusDto;
      }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      // Get driverId if user is a driver
      const driverId = user.role === UserRole.DRIVER
        ? await getDriverIdFromUser(user.userId, tenantId)
        : undefined;

      const shipment = await shipmentService.updateStatus(
        request.params.id,
        tenantId,
        request.body,
        user.userId,
        user.role as UserRole,
        driverId
      );

      // Start route simulation when status changes to IN_TRANSIT
      if (request.body.status === ShipmentStatus.IN_TRANSIT && shipment.driverId) {
        try {
          const routeSimulation = new RouteSimulationService(
            fastify.redis,
            fastify.io || undefined
          );
          // Check if simulation is already running to avoid duplicates
          const hasActiveSimulation = routeSimulation.hasActiveSimulation(
            shipment.driverId,
            tenantId
          );
          if (!hasActiveSimulation) {
            await routeSimulation.startSimulation(
              shipment.id,
              shipment.driverId,
              tenantId,
              shipment.pickupAddress,
              shipment.deliveryAddress
            );
          }
        } catch (error) {
          // Log error but don't fail the status update
          fastify.log.warn({ err: error }, "Failed to start route simulation");
        }
      }

      // Stop route simulation when shipment is delivered or cancelled
      if (
        request.body.status === ShipmentStatus.DELIVERED ||
        request.body.status === ShipmentStatus.CANCEL_BY_CUSTOMER ||
        request.body.status === ShipmentStatus.CANCEL_BY_DRIVER
      ) {
        try {
          const routeSimulation = new RouteSimulationService(
            fastify.redis,
            fastify.io || undefined
          );
          await routeSimulation.stopSimulationByShipment(shipment.id, tenantId);
        } catch (error) {
          // Log error but don't fail the status update
          fastify.log.warn({ err: error }, "Failed to stop route simulation");
        }
      }

      // Emit Socket.IO event for real-time updates
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipment.id,
          newStatus: shipment.status,
          previousStatus: request.body.status,
        });
      }

      return sendSuccess(reply, shipment);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/cancel-by-customer
 */
export const cancelByCustomerHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;

      const shipment = await shipmentService.cancelByCustomer(
        request.params.id,
        tenantId,
        user.userId
      );

      // Stop route simulation when shipment is cancelled
      try {
        const routeSimulation = new RouteSimulationService(
          fastify.redis,
          fastify.io || undefined
        );
        await routeSimulation.stopSimulationByShipment(shipment.id, tenantId);
      } catch (error) {
        fastify.log.warn({ err: error }, "Failed to stop route simulation");
      }

      // Emit Socket.IO event
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipment.id,
          newStatus: shipment.status,
        });
      }

      return sendSuccess(reply, shipment);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/cancel-by-driver
 */
export const cancelByDriverHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;

      // Get driverId
      const driverId = await getDriverIdFromUser(user.userId, tenantId);
      if (!driverId) {
        return reply.status(403).send({
          success: false,
          error_code: "UNAUTHORIZED",
          message: "Driver not found",
        });
      }

      const shipment = await shipmentService.cancelByDriver(
        request.params.id,
        tenantId,
        user.userId,
        driverId
      );

      // Stop route simulation when shipment is cancelled
      try {
        const routeSimulation = new RouteSimulationService(
          fastify.redis,
          fastify.io || undefined
        );
        await routeSimulation.stopSimulationByShipment(shipment.id, tenantId);
      } catch (error) {
        fastify.log.warn({ err: error }, "Failed to stop route simulation");
      }

      // Emit Socket.IO event
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipment.id,
          newStatus: shipment.status,
        });
      }

      return sendSuccess(reply, shipment);
    }
  );

/**
 * Handler for GET /v1/shipments/:id/route
 */
export const getShipmentRouteHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request);
      const shipmentService = new ShipmentService();
      
      // Get shipment to verify it exists and get driverId
      const shipment = await shipmentService.getShipmentById(
        request.params.id,
        tenantId,
        UserRole.OPS_ADMIN, // Admin can view any route
        undefined
      );

      if (!shipment) {
        return reply.status(404).send({
          success: false,
          error_code: "SHIPMENT_NOT_FOUND",
          message: "Shipment not found",
        });
      }

      // If no driver assigned, return null
      if (!shipment.driverId) {
        return sendSuccess(reply, null);
      }

      // Get route data
      const routeSimulation = new RouteSimulationService(
        fastify.redis,
        fastify.io || undefined
      );
      
      const routeData = await routeSimulation.getRouteDataByShipment(
        request.params.id,
        tenantId
      );

      return sendSuccess(reply, routeData);
    }
  );
