import { FastifyInstance } from 'fastify';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from '../controllers/notifications.controller';
import {
  getNotificationsSchema,
  getUnreadCountSchema,
  markAsReadSchema,
  markAllAsReadSchema,
} from '../schemas/notifications.schema';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get all notifications (authenticated users)
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/v1/notifications',
    {
      preHandler: [fastify.authenticate],
      schema: getNotificationsSchema,
    },
    getNotificationsHandler(fastify)
  );

  // Get unread count (authenticated users)
  fastify.get(
    '/v1/notifications/unread-count',
    {
      preHandler: [fastify.authenticate],
      schema: getUnreadCountSchema,
    },
    getUnreadCountHandler(fastify)
  );

  // Mark notification as read (authenticated users)
  fastify.post<{ Params: { id: string } }>(
    '/v1/notifications/:id/read',
    {
      preHandler: [fastify.authenticate],
      schema: markAsReadSchema,
    },
    markAsReadHandler(fastify)
  );

  // Mark all notifications as read (authenticated users)
  fastify.post(
    '/v1/notifications/read-all',
    {
      preHandler: [fastify.authenticate],
      schema: markAllAsReadSchema,
    },
    markAllAsReadHandler(fastify)
  );
}

