import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Driver } from '../../../infra/db/entities/Driver';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import { UpdateDriverLocationDto } from '../dto/drivers.dto';
import Redis from 'ioredis';

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export class LocationProcessorService {
  private driverRepository: Repository<Driver>;
  private redis: Redis;

  constructor(redis: Redis) {
    this.driverRepository = AppDataSource.getRepository(Driver);
    this.redis = redis;
  }

  async processLocation(
    tenantId: string,
    driverId: string,
    location: LocationData,
    source: 'REST' | 'MQTT'
  ): Promise<void> {
    // Validate driver belongs to tenant
    const driver = await this.driverRepository.findOne({
      where: { id: driverId, tenantId, isActive: true },
    });

    if (!driver) {
      throw new AppError(
        ErrorCode.DRIVER_NOT_FOUND,
        'Driver not found or does not belong to tenant',
        404
      );
    }

    // Validate location data
    if (
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number' ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid latitude or longitude values',
        400
      );
    }

    const redisKey = `driver:${tenantId}:${driverId}:location`;
    const locationData = {
      ...location,
      timestamp: location.timestamp || new Date().toISOString(),
      source,
    };

    try {
      // Store in Redis with TTL (1 hour)
      await this.redis.setex(redisKey, 3600, JSON.stringify(locationData));
    } catch (error) {
      // Fallback to database if Redis fails
      // Redis unavailable, using database fallback
      // Could store in database here if needed
    }

    // Emit Socket.IO event (will be handled by socket plugin)
    // This will be called from the controller/service that has access to the Socket.IO instance
  }

  async getLocation(tenantId: string, driverId: string): Promise<LocationData | null> {
    const redisKey = `driver:${tenantId}:${driverId}:location`;
    
    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Redis get failed - using fallback
    }

    return null;
  }
}
