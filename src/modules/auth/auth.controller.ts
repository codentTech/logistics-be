import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { AppError, ErrorCode } from '../../shared/errors/error-handler';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();

  fastify.post<{ Body: LoginDto }>(
    '/v1/auth/login',
    {
      schema: {
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
      },
    },
    async (request: FastifyRequest<{ Body: LoginDto }>, reply: FastifyReply) => {
      try {
        const result = await authService.login(request.body, fastify.jwt);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send(error.toJSON());
        }
        throw error;
      }
    }
  );
}

