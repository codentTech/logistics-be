import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ShipmentService } from "../services/shipments.service";
import { RouteSimulationService } from "../services/route-simulation.service";
import {
  CreateShipmentDto,
  AssignDriverDto,
  UpdateShipmentStatusDto,
} from "../dto/shipments.dto";
import { AppError } from "../../../shared/errors/error-handler";
import { getTenantId } from "../../tenants/tenant.decorator";
import { ShipmentStatus } from "../../../infra/db/entities/Shipment";

/**
 * Handler for GET /v1/shipments
 */
export const getAllShipmentsHandler =
  (fastify: FastifyInstance) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const query = request.query as { status?: string };
      const shipments = await shipmentService.getAllShipments(
        tenantId,
        query.status
      );
      return reply.status(200).send({
        success: true,
        data: shipments,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for GET /v1/shipments/:id
 */
export const getShipmentByIdHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const shipment = await shipmentService.getShipmentById(
        request.params.id,
        tenantId
      );
      if (!shipment) {
        return reply.status(404).send({
          success: false,
          error_code: "SHIPMENT_NOT_FOUND",
          message: "Shipment not found",
        });
      }
      return reply.status(200).send({
        success: true,
        data: shipment,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for POST /v1/shipments
 */
export const createShipmentHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{ Body: CreateShipmentDto }>,
    reply: FastifyReply
  ) => {
    try {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      const shipment = await shipmentService.createShipment(
        tenantId,
        request.body,
        user.userId
      );
      return reply.status(201).send({
        success: true,
        data: shipment,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for POST /v1/shipments/:id/assign-driver
 */
export const assignDriverHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: AssignDriverDto;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      const shipment = await shipmentService.assignDriver(
        request.params.id,
        tenantId,
        request.body,
        user.userId
      );

      // Start route simulation when driver is assigned
      try {
        const routeSimulation = new RouteSimulationService(fastify.redis, fastify.io || undefined);
        await routeSimulation.startSimulation(
          shipment.id,
          shipment.driverId!,
          tenantId,
          shipment.pickupAddress,
          shipment.deliveryAddress
        );
      } catch (error) {
        // Log error but don't fail the assignment
        fastify.log.warn({ err: error }, 'Failed to start route simulation');
      }

      // Emit Socket.IO event for real-time updates
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipment.id,
          newStatus: shipment.status,
          driverId: shipment.driverId,
        });
      }

      return reply.status(200).send({
        success: true,
        data: shipment,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for POST /v1/shipments/:id/status
 */
export const updateStatusHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: UpdateShipmentStatusDto;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;
      const shipment = await shipmentService.updateStatus(
        request.params.id,
        tenantId,
        request.body,
        user.userId
      );

      // Stop route simulation when shipment is delivered or status changes significantly
      if (
        request.body.status === ShipmentStatus.DELIVERED ||
        request.body.status === ShipmentStatus.CREATED
      ) {
        try {
          const routeSimulation = new RouteSimulationService(fastify.redis, fastify.io || undefined);
          await routeSimulation.stopSimulationByShipment(shipment.id, tenantId);
        } catch (error) {
          // Log error but don't fail the status update
          fastify.log.warn({ err: error }, 'Failed to stop route simulation');
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

      return reply.status(200).send({
        success: true,
        data: shipment,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };
