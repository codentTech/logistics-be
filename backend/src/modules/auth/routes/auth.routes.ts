import { FastifyInstance } from 'fastify';
import { loginSchema } from '../schemas/auth.schema';
import { loginHandler } from '../controllers/auth.controller';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: any }>(
    '/v1/auth/login',
    {
      schema: loginSchema,
    },
    loginHandler(fastify)
  );
}

