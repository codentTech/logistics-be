import { FastifySchema } from 'fastify';

/**
 * Schema for GET /v1/shipments
 */
export const getAllShipmentsSchema: FastifySchema = {
  description: 'Get all shipments for the authenticated tenant',
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
        description: 'Filter by status (optional)',
      },
    },
  },
  response: {
    200: {
      description: 'List of shipments',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              tenantId: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              pickupAddress: { type: 'string' },
              deliveryAddress: { type: 'string' },
              customerName: { type: 'string' },
              customerPhone: { type: 'string' },
              driverId: { type: ['string', 'null'], format: 'uuid' },
              assignedAt: { type: ['string', 'null'], format: 'date-time' },
              cancelledAt: { type: ['string', 'null'], format: 'date-time' },
              deliveredAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for GET /v1/shipments/:id
 */
export const getShipmentByIdSchema: FastifySchema = {
  description: 'Get a shipment by ID',
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Shipment details',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            pickupAddress: { type: 'string' },
            deliveryAddress: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            driverId: { type: ['string', 'null'], format: 'uuid' },
            assignedAt: { type: ['string', 'null'], format: 'date-time' },
            pickedUpAt: { type: ['string', 'null'], format: 'date-time' },
            deliveredAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments
 */
export const createShipmentSchema: FastifySchema = {
  description:
    'Create a new shipment. Requires Idempotency-Key header for idempotent requests.',
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  headers: {
    type: 'object',
    properties: {
      'Idempotency-Key': {
        type: 'string',
        description: 'Unique key for idempotent requests (optional but recommended)',
      },
    },
  },
  body: {
    type: 'object',
    required: ['pickupAddress', 'deliveryAddress', 'customerName', 'customerPhone'],
    properties: {
      pickupAddress: {
        type: 'string',
        description: 'Pickup address',
      },
      deliveryAddress: {
        type: 'string',
        description: 'Delivery address',
      },
      customerName: { type: 'string' },
      customerPhone: { type: 'string' },
    },
  },
  response: {
    201: {
      description: 'Shipment created successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
            },
            pickupAddress: { type: 'string' },
            deliveryAddress: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            driverId: { type: ['string', 'null'], format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/assign-driver
 */
export const assignDriverSchema: FastifySchema = {
  description: 'Assign a driver to a shipment',
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['driverId'],
    properties: {
      driverId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Driver assigned successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            driverId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/status
 */
export const updateStatusSchema: FastifySchema = {
  description: 'Update shipment status (state machine)',
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
      },
    },
  },
  response: {
    200: {
      description: 'Status updated successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

