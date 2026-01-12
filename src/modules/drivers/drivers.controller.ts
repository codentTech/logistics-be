import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LocationProcessorService } from './location-processor.service';
import { UpdateDriverLocationDto } from './drivers.dto';
import { AppError } from '../../shared/errors/error-handler';
import { getTenantId } from '../tenants/tenant.decorator';

export async function driverRoutes(fastify: FastifyInstance) {
  const locationProcessor = new LocationProcessorService(fastify.redis);

  // Update driver location
  fastify.post<{ Params: { id: string }; Body: UpdateDriverLocationDto }>(
    '/v1/drivers/:id/location',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: `Update driver location via REST API.

**Alternative: MQTT**
You can also update driver location via MQTT by publishing to:
- **Topic:** \`tenant/{tenantId}/driver/{driverId}/location\`
- **Message Format:**
\`\`\`json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-01T12:00:00Z"
}
\`\`\`

**Example (mosquitto_pub):**
\`\`\`bash
mosquitto_pub -h your-mqtt-server -p 1883 \\
  -t "tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location" \\
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}'
\`\`\`

Both REST and MQTT store location in Redis and broadcast via Socket.IO.`,
        tags: ['drivers'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['latitude', 'longitude'],
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateDriverLocationDto }>,
      reply: FastifyReply
    ) => {
      try {
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
          fastify.io.to(`tenant:${tenantId}`).emit('driver:location', {
            driverId: request.params.id,
            latitude: request.body.latitude,
            longitude: request.body.longitude,
            timestamp: request.body.timestamp || new Date().toISOString(),
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
    }
  );
}

