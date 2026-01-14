import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../services/auth.service";
import { LoginDto } from "../dto/auth.dto";
import { asyncHandler } from "../../../shared/utils/async-handler.util";

/**
 * Handler for POST /v1/auth/login
 */
export const loginHandler = (fastify: FastifyInstance) =>
  asyncHandler(
    async (
      request: FastifyRequest<{ Body: LoginDto }>,
      reply: FastifyReply
    ) => {
      const authService = new AuthService();
      const result = await authService.login(request.body, fastify.jwt);
      return reply.status(200).send(result);
    }
  );
