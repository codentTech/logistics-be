import { FastifySchema } from 'fastify';

/**
 * Schema for POST /v1/auth/login
 */
export const loginSchema: FastifySchema = {
  description: 'User login endpoint',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['email', 'password', 'tenantId'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
      tenantId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Successful login',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string' },
            tenantId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Tenant not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

