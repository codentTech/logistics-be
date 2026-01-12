import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import mercurius from 'mercurius';
import { graphQLConfig } from '../graphql/mercurius.config';

const graphQLPlugin: FastifyPluginAsync = async (fastify) => {
  // Add authentication hook BEFORE registering mercurius
  // This ensures the hook runs before GraphQL requests are processed
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only handle /graphql route
    if (request.url !== '/graphql') {
      return;
    }

    // Skip authentication for GraphiQL UI (GET requests)
    if (request.method === 'GET') {
      return;
    }

    // Authenticate all POST requests to /graphql
    if (request.method === 'POST') {
      await fastify.authenticate(request);
    }
  });

  // Register mercurius after hook is set up
  await fastify.register(mercurius, {
    schema: graphQLConfig.schema,
    resolvers: graphQLConfig.resolvers as any, // Type assertion for custom context
    context: graphQLConfig.context,
    graphiql: process.env.NODE_ENV === 'development',
    path: '/graphql',
  });

  fastify.log.info('✅ GraphQL plugin registered');
};

export default fp(graphQLPlugin, {
  name: 'graphql',
  dependencies: ['@fastify/jwt'],
});

