import { FastifySchema } from 'fastify';

/**
 * Schema for GET /v1/notifications
 */
export const getNotificationsSchema: FastifySchema = {
  summary: 'Get notifications',
  description: `
Get paginated list of notifications for the authenticated user.

**Access:** All authenticated users

**Query Parameters:**
- \`limit\` (optional): Number of notifications to return (default: 50, max: 100)
- \`offset\` (optional): Number of notifications to skip for pagination (default: 0)

**Response:**
Returns an object with:
- \`notifications\`: Array of notification objects
- \`total\`: Total number of notifications (for pagination)

**Notifications are ordered by creation date (newest first).**
  `,
  tags: ['notifications'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'string',
        description: 'Number of notifications to return (default: 50, max: 100)',
      },
      offset: {
        type: 'string',
        description: 'Number of notifications to skip (default: 0)',
      },
    },
  },
  response: {
    200: {
      description: 'Notifications retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            notifications: {
              type: 'array',
              items: { type: 'object' },
            },
            total: {
              type: 'number',
              description: 'Total number of notifications',
              example: 150,
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
 * Schema for GET /v1/notifications/unread-count
 */
export const getUnreadCountSchema: FastifySchema = {
  summary: 'Get unread notification count',
  description: `
Get the count of unread notifications for the authenticated user.

**Access:** All authenticated users

**Use Case:**
Useful for displaying a badge or indicator showing the number of unread notifications.

**Response:**
Returns an object with \`count\` property indicating the number of unread notifications.
  `,
  tags: ['notifications'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'Unread count retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description: 'Number of unread notifications',
              example: 5,
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
 * Schema for POST /v1/notifications/:id/read
 */
export const markAsReadSchema: FastifySchema = {
  summary: 'Mark notification as read',
  description: `
Mark a specific notification as read.

**Access:** All authenticated users (can only mark own notifications)

**Response:**
Returns the updated notification with \`status: "READ\`.
  `,
  tags: ['notifications'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Notification ID',
      },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Notification marked as read successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
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
    404: {
      description: 'Notification not found',
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
 * Schema for POST /v1/notifications/read-all
 */
export const markAllAsReadSchema: FastifySchema = {
  summary: 'Mark all notifications as read',
  description: `
Mark all unread notifications for the authenticated user as read.

**Access:** All authenticated users

**Response:**
Returns success message indicating all notifications have been marked as read.
  `,
  tags: ['notifications'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'All notifications marked as read successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: {
          type: 'string',
          example: 'All notifications marked as read',
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

