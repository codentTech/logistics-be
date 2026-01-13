import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LocationProcessorService } from '../services/location-processor.service';
import { DriverService } from '../services/drivers.service';
import { UpdateDriverLocationDto } from '../dto/drivers.dto';
import { AppError } from '../../../shared/errors/error-handler';
import { getTenantId } from '../../tenants/tenant.decorator';

/**
 * Handler for GET /v1/drivers
 */
export const getAllDriversHandler =
  (fastify: FastifyInstance) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const driverService = new DriverService(fastify.redis);
      const tenantId = getTenantId(request);
      const drivers = await driverService.getAllDrivers(tenantId);
      return reply.status(200).send({
        success: true,
        data: drivers,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for GET /v1/drivers/:id
 */
export const getDriverByIdHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const driverService = new DriverService(fastify.redis);
      const tenantId = getTenantId(request);
      const driver = await driverService.getDriverById(
        request.params.id,
        tenantId
      );
      if (!driver) {
        return reply.status(404).send({
          success: false,
          error_code: 'DRIVER_NOT_FOUND',
          message: 'Driver not found',
        });
      }
      return reply.status(200).send({
        success: true,
        data: driver,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };

/**
 * Handler for POST /v1/drivers/:id/location
 */
export const updateDriverLocationHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: UpdateDriverLocationDto;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const locationProcessor = new LocationProcessorService(fastify.redis);
      const tenantId = getTenantId(request);

      await locationProcessor.processLocation(
        tenantId,
        request.params.id,
        {
          latitude: request.body.latitude,
          longitude: request.body.longitude,
          timestamp: request.body.timestamp || new Date().toISOString(),
        },
        'REST'
      );

      // Emit Socket.IO event
      if (fastify.io) {
        fastify.io.to(`tenant:${tenantId}`).emit('driver-location-update', {
          driverId: request.params.id,
          location: {
            latitude: request.body.latitude,
            longitude: request.body.longitude,
            timestamp: request.body.timestamp || new Date().toISOString(),
          },
          source: 'REST',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Location updated successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };
