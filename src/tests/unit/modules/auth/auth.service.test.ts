import { AuthService } from '../../../../modules/auth/auth.service';
import { AppDataSource } from '../../../../infra/db/data-source';
import { User } from '../../../../infra/db/entities/User';
import { Tenant } from '../../../../infra/db/entities/Tenant';
import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';
import { createMockUser, createMockTenant } from '../../../helpers/test-helpers';
import bcrypt from 'bcrypt';

jest.mock('../../../../infra/db/data-source');
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: any;
  let mockTenantRepository: any;
  let mockJwt: any;

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
    };

    mockTenantRepository = {
      findOne: jest.fn(),
    };

    mockJwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === User) return mockUserRepository;
      if (entity === Tenant) return mockTenantRepository;
      return null;
    });

    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockTenant = createMockTenant();
      const mockUser = await createMockUser({ tenant: mockTenant });

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto = {
        tenantId: 'tenant-1',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await authService.login(loginDto, mockJwt);

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockJwt.sign).toHaveBeenCalledWith({
        userId: mockUser.id,
        tenantId: mockUser.tenantId,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should throw error when tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      const loginDto = {
        tenantId: 'non-existent-tenant',
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow(AppError);
      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow('Tenant not found or inactive');
    });

    it('should throw error when user not found', async () => {
      const mockTenant = createMockTenant();
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockUserRepository.findOne.mockResolvedValue(null);

      const loginDto = {
        tenantId: 'tenant-1',
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow(AppError);
      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error when password is incorrect', async () => {
      const mockTenant = createMockTenant();
      const mockUser = await createMockUser({ tenant: mockTenant });

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const loginDto = {
        tenantId: 'tenant-1',
        email: 'test@example.com',
        password: 'wrong-password',
      };

      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow(AppError);
      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error when tenant is inactive', async () => {
      const mockTenant = createMockTenant({ isActive: false });
      mockTenantRepository.findOne.mockResolvedValue(null); // Inactive tenant not found

      const loginDto = {
        tenantId: 'tenant-1',
        email: 'test@example.com',
        password: 'password123',
      };

      await expect(authService.login(loginDto, mockJwt)).rejects.toThrow(AppError);
    });
  });
});

