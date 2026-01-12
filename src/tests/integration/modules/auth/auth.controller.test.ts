import { buildApp } from '../../../../app';
import { createMockUser, createMockTenant } from '../../../helpers/test-helpers';
import { AppDataSource } from '../../../../infra/db/data-source';
import { User } from '../../../../infra/db/entities/User';
import { Tenant } from '../../../../infra/db/entities/Tenant';
import bcrypt from 'bcrypt';

jest.mock('../../../../infra/db/data-source');

describe('AuthController Integration', () => {
  let app: any;
  let mockUserRepository: any;
  let mockTenantRepository: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
    };

    mockTenantRepository = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === User) return mockUserRepository;
      if (entity === Tenant) return mockTenantRepository;
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockTenant = createMockTenant();
      const mockUser = await createMockUser({ tenant: mockTenant });

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock) = jest.fn().mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          tenantId: 'tenant-1',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe('test@example.com');
    });

    it('should return 404 for non-existent tenant', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          tenantId: 'non-existent',
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error_code).toBe('TENANT_NOT_FOUND');
    });

    it('should return 401 for invalid credentials', async () => {
      const mockTenant = createMockTenant();
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          tenantId: 'tenant-1',
          email: 'wrong@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error_code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'test@example.com',
          // Missing tenantId and password
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

