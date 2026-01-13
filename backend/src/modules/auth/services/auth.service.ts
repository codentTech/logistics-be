import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { User } from '../../../infra/db/entities/User';
import { Tenant } from '../../../infra/db/entities/Tenant';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import bcrypt from 'bcrypt';
import { LoginDto, LoginResponseDto } from '../dto/auth.dto';

export class AuthService {
  private userRepository: Repository<User>;
  private tenantRepository: Repository<Tenant>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.tenantRepository = AppDataSource.getRepository(Tenant);
  }

  async login(loginDto: LoginDto, jwt: any): Promise<LoginResponseDto> {
    // Verify tenant exists and is active
    const tenant = await this.tenantRepository.findOne({
      where: { id: loginDto.tenantId, isActive: true },
    });

    if (!tenant) {
      throw new AppError(ErrorCode.TENANT_NOT_FOUND, 'Tenant not found or inactive', 404);
    }

    // Find user by email and tenant
    const user = await this.userRepository.findOne({
      where: {
        email: loginDto.email,
        tenantId: loginDto.tenantId,
        isActive: true,
      },
      relations: ['tenant'],
    });

    if (!user) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password', 401);
    }

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
      },
    };
  }
}

