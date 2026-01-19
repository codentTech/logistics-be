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

          // Phase 1 has been removed - Phase 2 always starts from pickup
          // Stop any existing simulation
          await routeSimulation.stopSimulation(shipment.driverId, tenantId);

          // Geocode pickup address to get coordinates for Phase 2 start
          let pickupCoordinates = null;
          const encodedAddress = encodeURIComponent(shipment.pickupAddress);
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { "User-Agent": "OpsCore/1.0" },
          });
          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();
            if (geocodeData && geocodeData.length > 0) {
              pickupCoordinates = {
                lat: parseFloat(geocodeData[0].lat),
                lng: parseFloat(geocodeData[0].lon),
              };
            }
          }

          // Start Phase 2: Pickup → Delivery
          // If we have pickup coordinates, update driver location to pickup first
          if (pickupCoordinates) {
            const locationKey = `driver:${tenantId}:${shipment.driverId}:location`;
            await fastify.redis.setex(
              locationKey,
              3600,
              JSON.stringify({
                latitude: pickupCoordinates.lat,
                longitude: pickupCoordinates.lng,
                timestamp: new Date().toISOString(),
                source: "SIMULATED",
              })
            );

            // Emit location update
            if (fastify.io) {
              fastify.io
                .to(`tenant:${tenantId}`)
                .emit("driver-location-update", {
                  driverId: shipment.driverId,
                  location: {
                    latitude: pickupCoordinates.lat,
                    longitude: pickupCoordinates.lng,
                    timestamp: new Date().toISOString(),
                  },
                  source: "SIMULATED",
                });
            }
          }

          fastify.log.info(
            `🚀 Starting Phase 2 route simulation for shipment ${shipment.id}, driver ${shipment.driverId}`
          );

          await routeSimulation.startSimulation(
            shipment.id,
            shipment.driverId,
            tenantId,
            shipment.pickupAddress,
            shipment.deliveryAddress,
            "TO_DELIVERY" // Phase 2: Pickup → Delivery
          );

          fastify.log.info(
            `✅ Phase 2 route simulation started successfully for shipment ${shipment.id}`
          );
        } catch (error) {
          // Log error but don't fail the status update
          fastify.log.error(
            { err: error },
            "❌ Failed to start route simulation (Phase 2: TO_DELIVERY)"
          );
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

        // Emit notification refresh events for IN_TRANSIT and DELIVERED
        if (
          request.body.status === ShipmentStatus.IN_TRANSIT ||
          request.body.status === ShipmentStatus.DELIVERED
        ) {
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

        // Emit notification refresh event to admins and driver (if assigned)
        const userRepository = AppDataSource.getRepository(User);
        const adminUsers = await userRepository.find({
          where: { tenantId, role: UserRole.OPS_ADMIN, isActive: true },
        });

        for (const admin of adminUsers) {
          fastify.io.to(`user:${admin.id}`).emit("notification-updated", {
            shipmentId: shipmentToEmit.id,
          });
        }

        // Notify driver if they were assigned
        if (shipmentToEmit.driverId) {
          const driverRepository = AppDataSource.getRepository(Driver);
          const driver = await driverRepository.findOne({
            where: { id: shipmentToEmit.driverId, tenantId },
            relations: ["user"],
          });

          if (driver?.userId) {
            fastify.io.to(`user:${driver.userId}`).emit("notification-updated", {
              shipmentId: shipmentToEmit.id,
            });
          }
        }
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

      // Phase 1 has been removed - location sharing is no longer required for approval
      // Route simulation will only start when status changes to IN_TRANSIT (Phase 2)
      // Proceed with approval
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

      // Phase 1 has been removed - no route simulation on approval
      // Route simulation will only start when status changes to IN_TRANSIT (Phase 2)

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
      // Add timeout to database query (increased to 10 seconds for slow queries)
      let shipment;
      try {
        shipment = await Promise.race([
          shipmentService.getShipmentById(
            request.params.id,
            tenantId,
            UserRole.OPS_ADMIN, // Admin can view any route
            undefined
          ),
          new Promise<any>((_, reject) =>
            setTimeout(
              () => reject(new Error("Database query timed out")),
              10000
            )
          ),
        ]);
      } catch (error) {
        // Log the error for debugging
        fastify.log.warn(
          { err: error },
          `⚠️ Timeout fetching shipment ${request.params.id}`
        );
        return reply.status(500).send({
          success: false,
          error_code: "TIMEOUT",
          message: "Request timed out while fetching shipment data",
        });
      }

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

      // Get route data with timeout
      const routeSimulation = new RouteSimulationService(
        fastify.redis,
        fastify.io || undefined
      );

      // CRITICAL: If we have driverId, try direct lookup first (faster and more reliable)
      let routeData = null;
      if (shipment.driverId) {
        try {
          // Try direct lookup by driverId first
          const directRouteData = await Promise.race([
            routeSimulation.getRouteData(shipment.driverId, tenantId),
            new Promise<any>((_, reject) =>
              setTimeout(
                () => reject(new Error("Route data fetch timed out")),
                5000
              )
            ),
          ]);

          if (directRouteData && directRouteData.shipmentId === shipment.id) {
            // Found route data - return it with driverId
            routeData = {
              ...directRouteData,
              driverId: shipment.driverId,
            };
            fastify.log.info(
              `✅ Route data found via direct lookup for shipment ${shipment.id}, driver ${shipment.driverId}`
            );
          }
        } catch (error) {
          // Direct lookup failed, try by shipmentId
          fastify.log.warn(
            `⚠️ Direct route lookup failed for driver ${shipment.driverId}, trying by shipmentId`
          );
        }
      }

      // If direct lookup didn't work, try by shipmentId
      if (!routeData) {
        try {
          routeData = await Promise.race([
            routeSimulation.getRouteDataByShipment(request.params.id, tenantId),
            new Promise<any>((_, reject) =>
              setTimeout(
                () => reject(new Error("Route data fetch timed out")),
                10000
              )
            ),
          ]);
          if (routeData) {
            fastify.log.info(
              `✅ Route data found via shipmentId lookup for shipment ${shipment.id}`
            );
          } else {
            fastify.log.warn(
              `⚠️ No route data found for shipment ${shipment.id} (status: ${shipment.status}, driverId: ${shipment.driverId})`
            );
          }
        } catch (error) {
          // If route data fetch times out, return null instead of error
          // This allows the frontend to handle missing route data gracefully
          fastify.log.warn(
            `⚠️ Route data fetch timed out for shipment ${shipment.id}`
          );
          return sendSuccess(reply, null);
        }
      }

      return sendSuccess(reply, routeData);
    }
  );
