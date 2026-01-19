import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { DashboardSummary } from '../../../infra/db/entities/DashboardSummary';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { Driver } from '../../../infra/db/entities/Driver';
import { UserRole } from '../../../infra/db/entities/User';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';

export class DashboardRepository {
  private dashboardRepository: Repository<DashboardSummary>;
  private shipmentRepository: Repository<Shipment>;
  private driverRepository: Repository<Driver>;

  constructor() {
    this.dashboardRepository = AppDataSource.getRepository(DashboardSummary);
    this.shipmentRepository = AppDataSource.getRepository(Shipment);
    this.driverRepository = AppDataSource.getRepository(Driver);
  }

  async getSummary(
    tenantId: string,
    redis: Redis,
    userRole?: UserRole,
    driverId?: string,
    io?: SocketIOServer
  ): Promise<DashboardSummary> {
    // For drivers, calculate real-time summary filtered by driverId
    // For admin/customer, use cached summary
    if (userRole === UserRole.DRIVER && driverId) {
      return await this.getDriverSummary(tenantId, redis, driverId);
    }

    // Try to get from materialized view
    let summary = await this.dashboardRepository.findOne({
      where: { tenantId },
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Refresh if not found or stale (older than 2 seconds to match frontend polling)
    // Frontend polls every 3 seconds, so 2 seconds ensures fresh data on each request
    if (!summary || (now.getTime() - summary.lastUpdated.getTime() > 2000)) {
      summary = await this.refreshSummary(tenantId, redis, io);
    }

    return summary;
  }

  async getDriverSummary(tenantId: string, redis: Redis, driverId: string): Promise<DashboardSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Calculate metrics for driver's shipments only
    const [totalShipments, activeShipments, deliveredShipments] = await Promise.all([
      this.shipmentRepository.count({ where: { tenantId, driverId } }),
      this.shipmentRepository.count({
        where: {
          tenantId,
          driverId,
          status: ShipmentStatus.IN_TRANSIT,
        },
      }),
      this.shipmentRepository
        .createQueryBuilder('shipment')
        .where('shipment.tenantId = :tenantId', { tenantId })
        .andWhere('shipment.driverId = :driverId', { driverId })
        .andWhere('shipment.status = :status', { status: ShipmentStatus.DELIVERED })
        .andWhere('shipment.deliveredAt >= :todayStart', { todayStart })
        .getCount(),
    ]);

    // Drivers don't see "drivers online" metric
    const driversOnline = 0;

    // Create a DashboardSummary instance (not saved to DB, just for response)
    const summary = this.dashboardRepository.create({
      tenantId,
      totalShipments,
      activeShipments,
      deliveredToday: deliveredShipments,
      driversOnline,
      lastUpdated: now,
    });

    return summary;
  }

  async refreshSummary(tenantId: string, redis: Redis, io?: SocketIOServer): Promise<DashboardSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Calculate metrics
    const [totalShipments, activeShipments, deliveredShipments, drivers] = await Promise.all([
      this.shipmentRepository.count({ where: { tenantId } }),
      this.shipmentRepository.count({
        where: {
          tenantId,
          status: ShipmentStatus.IN_TRANSIT,
        },
      }),
      this.shipmentRepository
        .createQueryBuilder('shipment')
        .where('shipment.tenantId = :tenantId', { tenantId })
        .andWhere('shipment.status = :status', { status: ShipmentStatus.DELIVERED })
        .andWhere('shipment.deliveredAt >= :todayStart', { todayStart })
        .getCount(),
      this.driverRepository.find({
        where: { tenantId, isActive: true },
      }),
    ]);

    // Count drivers who are online (connected via Socket.IO)
    // Driver is considered online if they are in the driver:online:{tenantId}:{driverId} Socket.IO room
    let driversOnline = 0;
    
    if (io && io.sockets && io.sockets.adapter) {
      try {
        const rooms = io.sockets.adapter.rooms;
        
        for (const driver of drivers) {
          const onlineRoom = `driver:online:${tenantId}:${driver.id}`;
          
          if (rooms && rooms.has(onlineRoom)) {
            const room = rooms.get(onlineRoom);
            if (room && room.size > 0) {
              driversOnline++;
            }
          }
        }
      } catch (error) {
        driversOnline = 0;
      }
    }

    // Update or create summary
    let summary = await this.dashboardRepository.findOne({
      where: { tenantId },
    });

    if (summary) {
      summary.totalShipments = totalShipments;
      summary.activeShipments = activeShipments;
      summary.deliveredToday = deliveredShipments;
      summary.driversOnline = driversOnline;
      summary.lastUpdated = now;
    } else {
      summary = this.dashboardRepository.create({
        tenantId,
        totalShipments,
        activeShipments,
        deliveredToday: deliveredShipments,
        driversOnline,
        lastUpdated: now,
      });
    }

    return await this.dashboardRepository.save(summary);
  }
}

