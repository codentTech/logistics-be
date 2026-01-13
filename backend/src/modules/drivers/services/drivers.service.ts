import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Driver } from '../../../infra/db/entities/Driver';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import Redis from 'ioredis';

export class DriverService {
  private driverRepository: Repository<Driver>;
  private redis: Redis;

  constructor(redis: Redis) {
    this.driverRepository = AppDataSource.getRepository(Driver);
    this.redis = redis;
  }

  async getAllDrivers(tenantId: string): Promise<Driver[]> {
    const drivers = await this.driverRepository.find({
      where: { tenantId, isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Enrich with location data from Redis
    const driversWithLocation = await Promise.all(
      drivers.map(async (driver) => {
        const location = await this.getLocation(tenantId, driver.id);
        return {
          ...driver,
          location,
        };
      })
    );

    return driversWithLocation;
  }

  async getDriverById(driverId: string, tenantId: string): Promise<Driver | null> {
    const driver = await this.driverRepository.findOne({
      where: { id: driverId, tenantId, isActive: true },
      relations: ['user'],
    });

    if (!driver) {
      return null;
    }

    // Get location from Redis
    const location = await this.getLocation(tenantId, driver.id);

    return {
      ...driver,
      location,
    } as any;
  }

  private async getLocation(tenantId: string, driverId: string): Promise<{ latitude: number; longitude: number; timestamp: string } | null> {
    const redisKey = `driver:${tenantId}:${driverId}:location`;
    
    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis get failed - return null
    }

    return null;
  }
}

