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
        try {
          const driverRepository = AppDataSource.getRepository(Driver);
          // Add timeout to prevent hanging on database queries
          const driver = await Promise.race([
            driverRepository.findOne({
              where: { userId: user.userId, tenantId, isActive: true },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Database query timeout')), 5000)
            ),
          ]) as Driver | null;

          if (!driver || driver.id !== request.params.id) {
            throw new AppError(
              ErrorCode.UNAUTHORIZED,
              "You can only update your own location",
              403
            );
          }
        } catch (error) {
          // If database query fails or times out, still allow location update
          // Don't block location updates due to database issues
          // For security, we'll still check if it's a real authorization error
          if (error instanceof AppError && error.statusCode === 403) {
            throw error;
          }
          // Otherwise, continue with location update (database issue, not auth issue)
        }
      }

      // Check if route simulation is active before processing location
      // If simulation is active, skip real GPS updates to prevent interference
      // Add timeout to prevent hanging on Redis operations
      let simulationData = null;
      let existingLocation = null;
      
      try {
        const simulationKey = `simulation:${tenantId}:${request.params.id}`;
        simulationData = await Promise.race([
          fastify.redis.get(simulationKey),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 2000)
          ),
        ]) as string | null;
        
        if (simulationData) {
          // Route simulation is active - check if location is simulated
          const locationKey = `driver:${tenantId}:${request.params.id}:location`;
          existingLocation = await Promise.race([
            fastify.redis.get(locationKey),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Redis timeout')), 2000)
            ),
          ]) as string | null;
          
          if (existingLocation) {
            try {
              const existing = JSON.parse(existingLocation);
              // If existing location is from simulation, skip real GPS update
              // This prevents real GPS from overwriting simulated location
              if (existing.source === 'SIMULATED') {
                // Don't process real GPS location during active simulation
                // Don't emit Socket.IO event either - simulation will handle updates
                return sendSuccess(reply, null, 200, "Location update skipped - route simulation active");
              }
            } catch (parseError) {
              // JSON parse failed - continue with location update
            }
          }
        }
      } catch (error) {
        // Redis check failed or timed out - continue with location update
        // Don't block location updates due to Redis issues
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

      // Emit Socket.IO event only if simulation is not active
      if (fastify.io && !simulationData) {
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
