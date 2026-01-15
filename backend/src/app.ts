import 'reflect-metadata';
import Fastify, { FastifyInstance } from 'fastify';
import { appConfig } from './config';
import { AppDataSource } from './infra/db/data-source';
import { errorHandler } from './shared/errors/error-handler';
import authPlugin from './plugins/auth';
import swaggerPlugin from './plugins/swagger';
import { authRoutes } from './modules/auth/routes/auth.routes';
import { shipmentRoutes } from './modules/shipments/routes/shipments.routes';
import { driverRoutes } from './modules/drivers/routes/drivers.routes';
import { dashboardRoutes } from './modules/dashboard/routes/dashboard.routes';
import { notificationRoutes } from './modules/notifications/routes/notifications.routes';
import idempotencyPlugin from './plugins/idempotency';
import redisPlugin from './plugins/redis';
import socketPlugin from './plugins/socket';
import graphQLPlugin from './plugins/graphql';
import { EventPublisherService } from './infra/queues/event-publisher.service';
import { MQTTSubscriber } from './infra/mqtt/mqtt.subscriber';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: appConfig.nodeEnv === 'production' ? 'info' : 'debug',
      transport:
        appConfig.nodeEnv === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register plugins
  await app.register(require('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  await app.register(require('@fastify/rate-limit'), {
    max: 200, // Increased for real-time systems (was 100)
    timeWindow: '1 minute',
    // Exclude health check from rate limiting
    skipOnError: false,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  // Register custom plugins
  await app.register(swaggerPlugin);
  await app.register(redisPlugin); // Redis must be first
  await app.register(idempotencyPlugin); // Depends on redis
  await app.register(authPlugin);
  await app.register(socketPlugin); // Depends on redis and auth
  await app.register(graphQLPlugin); // Depends on auth

  // Initialize RabbitMQ and MQTT (after Redis is available via idempotency plugin)
  // Make these optional - don't crash if services aren't available
  const eventPublisher = new EventPublisherService();
  try {
    await eventPublisher.initialize();
    app.log.info('✅ RabbitMQ connected');
  } catch (error) {
    app.log.warn({ err: error }, '⚠️  RabbitMQ not available - continuing without it');
    app.log.warn('   Start RabbitMQ with: docker-compose up -d rabbitmq');
  }

  try {
    const mqttSubscriber = new MQTTSubscriber(app.redis, app.io);
    mqttSubscriber.connect();
    app.log.info('✅ MQTT subscriber connected');
  } catch (error) {
    app.log.warn({ err: error }, '⚠️  MQTT not available - continuing without it');
    app.log.warn('   Start MQTT with: docker-compose up -d emqx');
  }

  // Start processing event outbox (in background)
  const outboxInterval = setInterval(async () => {
    try {
      await eventPublisher.processOutboxEvents();
    } catch (error) {
      app.log.error({ err: error }, 'Error processing outbox events');
    }
  }, 5000); // Process every 5 seconds

  // Store interval for cleanup
  (app as any).outboxInterval = outboxInterval;

  // Register routes
  await app.register(authRoutes);
  await app.register(shipmentRoutes);
  await app.register(driverRoutes);
  await app.register(dashboardRoutes);
  await app.register(notificationRoutes);

  // Health check
  const { HealthCheckService } = await import('./infra/resilience/health-check.service');
  const healthCheckService = new HealthCheckService(app.redis);
  
  app.get('/health', async (request, reply) => {
    const health = await healthCheckService.checkHealth();
    return reply.status(health.status === 'healthy' ? 200 : 503).send(health);
  });

  // Set error handler
  app.setErrorHandler(errorHandler);

  return app;
}

async function start() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();

    // Build and start Fastify app
    const app = await buildApp();

    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    app.log.info(`Server running on http://${appConfig.host}:${appConfig.port}`);
    app.log.info(`Swagger docs: http://${appConfig.host}:${appConfig.port}/docs`);

    // Graceful shutdown
    const shutdown = async () => {
      app.log.info('Shutting down gracefully...');
      if ((app as any).outboxInterval) {
        clearInterval((app as any).outboxInterval);
      }
      await app.close();
      await AppDataSource.destroy();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  start();
}

export { buildApp };
