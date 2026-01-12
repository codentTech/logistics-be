import { buildApp } from '../../app';
import Redis from 'ioredis';

jest.mock('../../infra/db/data-source');
jest.mock('../../plugins/redis');

describe('Health Check', () => {
  let app: any;
  let mockRedis: jest.Mocked<Redis>;

  beforeAll(async () => {
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    } as any;

    // Mock redis plugin to return mockRedis
    jest.doMock('../../plugins/redis', () => ({
      default: jest.fn().mockImplementation((fastify: any) => {
        fastify.decorate('redis', mockRedis);
      }),
    }));

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.services).toBeDefined();
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('unhealthy');
    });
  });
});

