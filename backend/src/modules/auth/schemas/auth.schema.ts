import { FastifySchema } from 'fastify';

/**
 * Schema for POST /v1/auth/login
 */
export const loginSchema: FastifySchema = {
  description: 'User login endpoint',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
      tenantId: { type: 'string', format: 'uuid' }, // Optional - only required if multiple tenants
    },
  },
  response: {
    200: {
      description: 'Successful login or tenant selection required',
      type: 'object',
      oneOf: [
        {
          description: 'Direct login success (single tenant)',
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
                firstName: { type: ['string', 'null'] },
                lastName: { type: ['string', 'null'] },
              },
            },
          },
        },
        {
          description: 'Tenant selection required (multiple tenants)',
          properties: {
            success: { type: 'boolean' },
            requiresTenantSelection: { type: 'boolean' },
            tenants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
              },
            },
            message: { type: 'string' },
          },
        },
      ],
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

