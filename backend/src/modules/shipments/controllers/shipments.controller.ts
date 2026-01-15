import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ShipmentService } from "../services/shipments.service";
import { RouteSimulationService } from "../services/route-simulation.service";
import { ApprovalTimeoutService } from "../services/approval-timeout.service";
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
import {
  requireAdmin,
  requireAdminOrDriver,
} from "../../../shared/guards/role.guard";
import { AppDataSource } from "../../../infra/db/data-source";
import { Driver } from "../../../infra/db/entities/Driver";
import { User } from "../../../infra/db/entities/User";

/**
 * Helper to get driverId from user
 */
async function getDriverIdFromUser(
  userId: string,
  tenantId: string
): Promise<string | undefined> {
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
    const driverId =
      user.role === UserRole.DRIVER
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
      const driverId =
        user.role === UserRole.DRIVER
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

      // Reload shipment to ensure we have the latest data (pendingApproval is now true, status is ASSIGNED)
      const updatedShipment = await shipmentService.getShipmentById(
        shipment.id,
        tenantId,
        user.role as UserRole,
        undefined
      );

      // Use updated shipment if available, otherwise use original
      const shipmentToUse = updatedShipment || shipment;

      // Get driver's user ID to send notification via Socket.IO
      const driverRepository = AppDataSource.getRepository(Driver);
      const driver = shipmentToUse.driverId
        ? await driverRepository.findOne({
            where: { id: shipmentToUse.driverId, tenantId },
            relations: ["user"],
          })
        : null;

      // Schedule auto-reject timeout (5 minutes)
      if (shipmentToUse.pendingApproval && shipmentToUse.driverId) {
        const approvalTimeoutService = new ApprovalTimeoutService(
          fastify.io || undefined
        );
        approvalTimeoutService.scheduleAutoReject(
          shipmentToUse.id,
          shipmentToUse.driverId,
          tenantId,
          shipmentToUse.assignedAt || new Date()
        );
      }

      // Emit Socket.IO events for real-time updates IMMEDIATELY
      if (fastify.io) {
        // Emit shipment status update to all users in tenant (includes shipmentId for frontend matching)
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipmentToUse.id,
          newStatus: shipmentToUse.status,
          driverId: shipmentToUse.driverId,
          pendingApproval: shipmentToUse.pendingApproval,
        });

        // Emit notification refresh event to driver (notification already created in service)
        if (driver?.userId) {
          fastify.io.to(`user:${driver.userId}`).emit("notification-updated", {
            shipmentId: shipmentToUse.id,
          });
        }
      }

      return sendSuccess(reply, shipmentToUse);
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
      const driverId =
        user.role === UserRole.DRIVER
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

      // Start route simulation Phase 2: Pickup address → Delivery address
      // This happens when status changes to IN_TRANSIT
      if (
        request.body.status === ShipmentStatus.IN_TRANSIT &&
        shipment.driverId
      ) {
        try {
          const routeSimulation = new RouteSimulationService(
            fastify.redis,
            fastify.io || undefined
          );
          // Stop any existing simulation (Phase 1 should have completed)
          await routeSimulation.stopSimulation(shipment.driverId, tenantId);
          
          // Start Phase 2: Pickup → Delivery
          await routeSimulation.startSimulation(
            shipment.id,
            shipment.driverId,
            tenantId,
            shipment.pickupAddress,
            shipment.deliveryAddress,
            'TO_DELIVERY' // Phase 2: Pickup → Delivery
          );
        } catch (error) {
          // Log error but don't fail the status update
          fastify.log.warn({ err: error }, "Failed to start route simulation (Phase 2: TO_DELIVERY)");
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

      // Reload shipment to ensure we have the latest data before emitting
      const updatedShipment = await shipmentService.getShipmentById(
        shipment.id,
        tenantId,
        user.role as UserRole,
        undefined
      );

      const shipmentToEmit = updatedShipment || shipment;

      // Emit Socket.IO event for real-time updates IMMEDIATELY
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipmentToEmit.id,
          newStatus: shipmentToEmit.status,
          driverId: shipmentToEmit.driverId,
          pendingApproval: shipmentToEmit.pendingApproval,
        });
      }

      return sendSuccess(reply, shipmentToEmit);
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

      // Reload shipment to ensure we have the latest data (driverId is now null)
      const updatedShipment = await shipmentService.getShipmentById(
        shipment.id,
        tenantId,
        user.role as UserRole,
        undefined
      );

      const shipmentToEmit = updatedShipment || shipment;

      // Emit Socket.IO event for real-time updates IMMEDIATELY
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipmentToEmit.id,
          newStatus: shipmentToEmit.status,
          driverId: shipmentToEmit.driverId,
          pendingApproval: shipmentToEmit.pendingApproval,
        });
      }

      return sendSuccess(reply, shipmentToEmit);
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

      // Reload shipment to ensure we have the latest data (driverId is now null)
      const updatedShipment = await shipmentService.getShipmentById(
        shipment.id,
        tenantId,
        user.role as UserRole,
        undefined
      );

      const shipmentToEmit = updatedShipment || shipment;

      // Emit Socket.IO event for real-time updates IMMEDIATELY
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipmentToEmit.id,
          newStatus: shipmentToEmit.status,
          driverId: shipmentToEmit.driverId,
          pendingApproval: shipmentToEmit.pendingApproval,
        });
      }

      return sendSuccess(reply, shipmentToEmit);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/approve
 */
export const approveAssignmentHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;

      // Get driverId if user is a driver
      const driverId =
        user.role === UserRole.DRIVER
          ? await getDriverIdFromUser(user.userId, tenantId)
          : undefined;

      if (!driverId) {
        return reply.status(403).send({
          success: false,
          error_code: "UNAUTHORIZED",
          message: "Only drivers can approve shipments",
        });
      }

      const shipment = await shipmentService.approveAssignment(
        request.params.id,
        tenantId,
        user.userId,
        driverId
      );

      // Reload shipment to ensure we have the latest data (status is APPROVED, pendingApproval is false)
      const updatedShipment = await shipmentService.getShipmentById(
        shipment.id,
        tenantId,
        user.role as UserRole,
        undefined
      );

      // Cancel auto-reject timeout since shipment was approved
      const approvalTimeoutService = new ApprovalTimeoutService(
        fastify.io || undefined
      );
      approvalTimeoutService.cancelAutoReject(shipment.id);

      // Start route simulation Phase 1: Driver's current location → Pickup address
      // This happens when driver approves the shipment assignment
      if (shipment.driverId) {
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
              shipment.deliveryAddress,
              'TO_PICKUP' // Phase 1: Driver location → Pickup
            );
          }
        } catch (error) {
          // Log error but don't fail the approval
          // If driver hasn't shared location yet, simulation will fail gracefully
          fastify.log.warn({ err: error }, "Failed to start route simulation (Phase 1: TO_PICKUP)");
        }
      }

      // Use updated shipment if available
      const shipmentToEmit = updatedShipment || shipment;

      // Emit Socket.IO events for real-time updates IMMEDIATELY
      if (fastify.io) {
        // Emit shipment status update to all users in tenant (includes shipmentId for frontend matching)
        fastify.io.to(`tenant:${tenantId}`).emit("shipment-status-update", {
          shipmentId: shipmentToEmit.id,
          newStatus: shipmentToEmit.status,
          driverId: shipmentToEmit.driverId,
          pendingApproval: shipmentToEmit.pendingApproval,
        });

        // Emit notification refresh event to admins (notifications already created in service)
        const userRepository = AppDataSource.getRepository(User);
        const adminUsers = await userRepository.find({
          where: { tenantId, role: UserRole.OPS_ADMIN, isActive: true },
        });

        for (const admin of adminUsers) {
          fastify.io.to(`user:${admin.id}`).emit("notification-updated", {
            shipmentId: shipmentToEmit.id,
          });
        }
      }

      return sendSuccess(reply, shipmentToEmit);
    }
  );

/**
 * Handler for POST /v1/shipments/:id/reject
 */
export const rejectAssignmentHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const shipmentService = new ShipmentService();
      const tenantId = getTenantId(request);
      const user = (request as any).user;

      // Get driverId if user is a driver
      const driverId =
        user.role === UserRole.DRIVER
          ? await getDriverIdFromUser(user.userId, tenantId)
          : undefined;

      if (!driverId) {
        return reply.status(403).send({
          success: false,
          error_code: "UNAUTHORIZED",
          message: "Only drivers can reject shipments",
        });
      }

      const shipment = await shipmentService.rejectAssignment(
        request.params.id,
        tenantId,
        user.userId,
        driverId
      );

      // Cancel auto-reject timeout since shipment was manually rejected
      const approvalTimeoutService = new ApprovalTimeoutService(
        fastify.io || undefined
      );
      approvalTimeoutService.cancelAutoReject(shipment.id);

      const updatedShipment = shipment;

      if (fastify.io) {
        // The shipment from service already has driverId = null
        // Emit the actual shipment data to ensure consistency
        const socketPayload = {
          shipmentId: updatedShipment.id,
          newStatus: updatedShipment.status,
          driverId: null,
          pendingApproval: false,
        };

        fastify.io
          .to(`tenant:${tenantId}`)
          .emit("shipment-status-update", socketPayload);

        // Emit notification refresh event to admins (notifications already created in service)
        const userRepository = AppDataSource.getRepository(User);
        const adminUsers = await userRepository.find({
          where: { tenantId, role: UserRole.OPS_ADMIN, isActive: true },
        });

        for (const admin of adminUsers) {
          fastify.io.to(`user:${admin.id}`).emit("notification-updated", {
            shipmentId: (updatedShipment || shipment).id,
          });
        }
      }

      return sendSuccess(reply, updatedShipment || shipment);
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
