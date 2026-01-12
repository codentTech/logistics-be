import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { swaggerConfig } from '../config';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  if (!swaggerConfig.enabled) {
    return;
  }

  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'OpsCore API',
        description: 'Production-grade logistics backend API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${swaggerConfig.host}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              error_code: { type: 'string', example: 'INVALID_SHIPMENT_STATE' },
              message: { type: 'string', example: 'Cannot transition from CREATED to DELIVERED' },
            },
            required: ['success', 'error_code', 'message'],
          },
          Success: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object' },
            },
          },
        },
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'shipments', description: 'Shipment management' },
        { name: 'drivers', description: 'Driver management' },
        { name: 'dashboard', description: 'Dashboard and analytics' },
      ],
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
