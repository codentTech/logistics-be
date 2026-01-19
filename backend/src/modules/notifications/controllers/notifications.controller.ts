import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notifications.service';
import { sendSuccess } from '../../../shared/utils/response.util';
import { asyncHandler } from '../../../shared/utils/async-handler.util';

/**
 * Handler for GET /v1/notifications
 */
export const getNotificationsHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
      reply: FastifyReply
    ) => {
      const notificationService = new NotificationService();
      const user = (request as any).user;
      
      if (!user || !user.userId) {
        return reply.status(401).send({
          success: false,
          error_code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

      const result = await notificationService.getUserNotifications(user.userId, limit, offset);
      return sendSuccess(reply, result);
    }
  );

/**
 * Handler for GET /v1/notifications/unread-count
 */
export const getUnreadCountHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const notificationService = new NotificationService();
      const user = (request as any).user;

      const count = await notificationService.getUnreadCount(user.userId);
      return sendSuccess(reply, { count });
    }
  );

/**
 * Handler for POST /v1/notifications/:id/read
 */
export const markAsReadHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const notificationService = new NotificationService();
      const user = (request as any).user;

      const notification = await notificationService.markAsRead(request.params.id, user.userId);
      return sendSuccess(reply, notification);
    }
  );

/**
 * Handler for POST /v1/notifications/read-all
 */
export const markAllAsReadHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const notificationService = new NotificationService();
      const user = (request as any).user;

      await notificationService.markAllAsRead(user.userId);
      return sendSuccess(reply, { message: 'All notifications marked as read' });
    }
  );

