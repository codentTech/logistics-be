import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { LocationProcessorService } from "../services/location-processor.service";
import { DriverService } from "../services/drivers.service";
import { UpdateDriverLocationDto } from "../dto/drivers.dto";
import { getTenantId } from "../../tenants/tenant.decorator";
import { UserRole } from "../../../infra/db/entities/User";
import { AppError, ErrorCode } from "../../../shared/errors/error-handler";
import { sendSuccess } from "../../../shared/utils/response.util";
import { asyncHandler } from "../../../shared/utils/async-handler.util";
import { AppDataSource } from "../../../infra/db/data-source";
import { Driver } from "../../../infra/db/entities/Driver";

/**
 * Handler for GET /v1/drivers
 */
export const getAllDriversHandler = (fastify: FastifyInstance) =>
  asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const driverService = new DriverService(fastify.redis);
    const tenantId = getTenantId(request);
    const drivers = await driverService.getAllDrivers(tenantId);
    return sendSuccess(reply, drivers);
  });

/**
 * Handler for GET /v1/drivers/:id
 */
export const getDriverByIdHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const driverService = new DriverService(fastify.redis);
      const tenantId = getTenantId(request);
      const driver = await driverService.getDriverById(
        request.params.id,
        tenantId
      );
      if (!driver) {
        return reply.status(404).send({
          success: false,
          error_code: "DRIVER_NOT_FOUND",
          message: "Driver not found",
        });
      }
      return sendSuccess(reply, driver);
    }
  );

/**
 * Handler for POST /v1/drivers/:id/location
 */
export const updateDriverLocationHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateDriverLocationDto;
      }>,
      reply: FastifyReply
    ) => {
      const locationProcessor = new LocationProcessorService(fastify.redis);
      const tenantId = getTenantId(request);
      const user = (request as any).user;

      // If user is a driver, verify they can only update their own location
      if (user.role === UserRole.DRIVER) {
        const driverRepository = AppDataSource.getRepository(Driver);
        const driver = await driverRepository.findOne({
          where: { userId: user.userId, tenantId, isActive: true },
        });

        if (!driver || driver.id !== request.params.id) {
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            "You can only update your own location",
            403
          );
        }
      }

      await locationProcessor.processLocation(
        tenantId,
        request.params.id,
        {
          latitude: request.body.latitude,
          longitude: request.body.longitude,
          timestamp: request.body.timestamp || new Date().toISOString(),
        },
        "REST"
      );

      // Emit Socket.IO event
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit("driver-location-update", {
          driverId: request.params.id,
          location: {
            latitude: request.body.latitude,
            longitude: request.body.longitude,
            timestamp: request.body.timestamp || new Date().toISOString(),
          },
          source: "REST",
        });
      }

      return sendSuccess(reply, null, 200, "Location updated successfully");
    }
  );
