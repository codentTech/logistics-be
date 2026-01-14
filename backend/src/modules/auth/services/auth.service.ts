import { Repository, In } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { User } from '../../../infra/db/entities/User';
import { Tenant } from '../../../infra/db/entities/Tenant';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import bcrypt from 'bcrypt';
import { LoginDto, LoginResponseDto, TenantOption } from '../dto/auth.dto';

export class AuthService {
  private userRepository: Repository<User>;
  private tenantRepository: Repository<Tenant>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.tenantRepository = AppDataSource.getRepository(Tenant);
  }

  async login(loginDto: LoginDto, jwt: any): Promise<LoginResponseDto> {
    // Step 1: Find all active users with this email
    const users = await this.userRepository.find({
      where: {
        email: loginDto.email,
        isActive: true,
      },
      relations: ['tenant'],
    });

    if (users.length === 0) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
    }

    // Step 2: Verify password against all users (try each until one matches)
    let validUser: User | null = null;
    for (const user of users) {
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
      if (isPasswordValid) {
        validUser = user;
        break;
      }
    }

    if (!validUser) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
    }

    // Step 3: Get all unique tenants for this email (only active tenants)
    const tenantIds = [...new Set(users.map((u) => u.tenantId))];
    const tenants = await this.tenantRepository.find({
      where: {
        id: In(tenantIds),
        isActive: true,
      },
    });

    if (tenants.length === 0) {
      throw new AppError(ErrorCode.TENANT_NOT_FOUND, 'No active tenant found for this user', 404);
    }

    // Step 4: If tenantId is provided, use it directly
    if (loginDto.tenantId) {
      const selectedTenant = tenants.find((t) => t.id === loginDto.tenantId);
      if (!selectedTenant) {
        throw new AppError(ErrorCode.TENANT_NOT_FOUND, 'Selected tenant not found or inactive', 404);
      }

      // Find user for selected tenant
      const userForTenant = users.find((u) => u.tenantId === loginDto.tenantId);
      if (!userForTenant) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid tenant selection', 401);
      }

      // Re-verify password for selected tenant
      const isPasswordValid = await bcrypt.compare(loginDto.password, userForTenant.passwordHash);
      if (!isPasswordValid) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
      }

      return this.completeLogin(userForTenant, jwt);
    }

    // Step 5: If single tenant, login directly
    if (tenants.length === 1) {
      return this.completeLogin(validUser, jwt);
    }

    // Step 6: Multiple tenants - return tenant list for selection
    const tenantOptions: TenantOption[] = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    }));

    return {
      success: true,
      requiresTenantSelection: true,
      tenants: tenantOptions,
      message: 'Please select which organization you want to login to',
    };
  }

  private completeLogin(user: User, jwt: any): LoginResponseDto {
    // Generate JWT token
    const token = jwt.sign({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
      },
    };
  }
}

