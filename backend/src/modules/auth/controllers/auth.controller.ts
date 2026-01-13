import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/auth.dto';
import { AppError } from '../../../shared/errors/error-handler';

/**
 * Handler for POST /v1/auth/login
 */
export const loginHandler =
  (fastify: FastifyInstance) =>
  async (
    request: FastifyRequest<{ Body: LoginDto }>,
    reply: FastifyReply
  ) => {
    try {
      const authService = new AuthService();
      const result = await authService.login(request.body, fastify.jwt);
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      throw error;
    }
  };
