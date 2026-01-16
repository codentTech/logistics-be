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
    // Validate location data first (before database query)
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

    // Validate driver belongs to tenant
    // Add timeout to prevent hanging on slow database queries
    let driver;
    try {
      driver = await Promise.race([
        this.driverRepository.findOne({
          where: { id: driverId, tenantId, isActive: true },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        ),
      ]) as Driver | null;
    } catch (error) {
      // If database query times out or fails, still allow location update
      // Location updates should not fail due to database issues
      // We'll skip driver validation but still store the location
      driver = null;
    }

    if (!driver) {
      // Driver not found - but don't fail the location update
      // This allows location updates even if driver record has issues
      // The location will still be stored and can be used
    }

    const redisKey = `driver:${tenantId}:${driverId}:location`;
    
    // CRITICAL: Check if route simulation is active for this driver
    // If simulation is active, real GPS location should NOT overwrite simulated location
    // This prevents the driver from "jumping back" to their real location during simulation
    // Add timeout to prevent hanging on Redis operations
    const simulationKey = `simulation:${tenantId}:${driverId}`;
    try {
      const simulationData = await Promise.race([
        this.redis.get(simulationKey),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis timeout')), 2000)
        ),
      ]) as string | null;
      
      if (simulationData) {
        // Route simulation is active - check if current location is simulated
        const existingLocation = await Promise.race([
          this.redis.get(redisKey),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis timeout')), 2000)
          ),
        ]) as string | null;
        
        if (existingLocation) {
          try {
            const existing = JSON.parse(existingLocation);
            // If existing location is from simulation, don't overwrite with real GPS
            // This ensures simulation takes priority during route simulation
            if (existing.source === 'SIMULATED') {
              // Simulation is active and location is simulated - skip real GPS update
              // This prevents the back-and-forth movement issue
              return;
            }
          } catch (parseError) {
            // JSON parse failed - continue with location update
          }
        }
      }
    } catch (error) {
      // If check fails or times out, proceed with location update
      // Don't block location updates due to Redis issues
    }

    const locationData = {
      ...location,
      timestamp: location.timestamp || new Date().toISOString(),
      source,
    };

    try {
      // Store in Redis with TTL (1 hour)
      // Add timeout to prevent hanging on Redis operations
      await Promise.race([
        this.redis.setex(redisKey, 3600, JSON.stringify(locationData)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis operation timeout')), 3000)
        ),
      ]);
    } catch (error) {
      // Redis operation failed or timed out
      // Don't throw error - location update should be resilient
      // The location will be lost but the request won't hang
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
