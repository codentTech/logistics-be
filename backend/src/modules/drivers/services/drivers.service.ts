import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Driver } from '../../../infra/db/entities/Driver';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';

export class DriverService {
  private driverRepository: Repository<Driver>;
  private redis: Redis;

  constructor(redis: Redis) {
    this.driverRepository = AppDataSource.getRepository(Driver);
    this.redis = redis;
  }

  async getAllDrivers(tenantId: string, io?: SocketIOServer): Promise<any[]> {
    const drivers = await this.driverRepository.find({
      where: { tenantId, isActive: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    // Enrich with location data from Redis and online status from Socket.IO
    const driversWithLocation = await Promise.all(
      drivers.map(async (driver) => {
        const location = await this.getLocation(tenantId, driver.id);
        const isOnline = this.checkDriverOnlineStatus(tenantId, driver.id, io);
        
        // Create plain object with all properties to ensure isOnline is included
        // Use explicit property assignment to avoid serialization issues
        const enrichedDriver: any = {
          id: String(driver.id),
          tenantId: String(driver.tenantId),
          userId: driver.userId ? String(driver.userId) : null,
          name: String(driver.name),
          phone: driver.phone ? String(driver.phone) : null,
          licenseNumber: driver.licenseNumber ? String(driver.licenseNumber) : null,
          isActive: Boolean(driver.isActive),
          createdAt: driver.createdAt instanceof Date ? driver.createdAt.toISOString() : driver.createdAt,
          updatedAt: driver.updatedAt instanceof Date ? driver.updatedAt.toISOString() : driver.updatedAt,
          location: location ? {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            timestamp: String(location.timestamp)
          } : null,
          isOnline: Boolean(isOnline),
        };
        
        // Add user object if it exists
        if (driver.user) {
          enrichedDriver.user = {
            id: String(driver.user.id),
            tenantId: String(driver.user.tenantId),
            email: String(driver.user.email),
            role: String(driver.user.role),
            firstName: driver.user.firstName || null,
            lastName: driver.user.lastName || null,
            isActive: Boolean(driver.user.isActive),
          };
        }
        
        return enrichedDriver;
      })
    );

    return driversWithLocation;
  }

  private checkDriverOnlineStatus(tenantId: string, driverId: string, io?: SocketIOServer): boolean {
    if (!io || !io.sockets || !io.sockets.adapter) {
      return false;
    }

    try {
      const onlineRoom = `driver:online:${tenantId}:${driverId}`;
      const rooms = io.sockets.adapter.rooms;
      
      if (rooms && rooms.has(onlineRoom)) {
        const room = rooms.get(onlineRoom);
        return room ? room.size > 0 : false;
      }
    } catch (error) {
      // If room check fails, default to offline
    }

    return false;
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

