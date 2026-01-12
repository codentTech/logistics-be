import { Repository } from 'typeorm';
import { AppDataSource } from '../../infra/db/data-source';
import { DashboardSummary } from '../../infra/db/entities/DashboardSummary';
import { Shipment, ShipmentStatus } from '../../infra/db/entities/Shipment';
import { Driver } from '../../infra/db/entities/Driver';
import Redis from 'ioredis';

export class DashboardRepository {
  private dashboardRepository: Repository<DashboardSummary>;
  private shipmentRepository: Repository<Shipment>;
  private driverRepository: Repository<Driver>;

  constructor() {
    this.dashboardRepository = AppDataSource.getRepository(DashboardSummary);
    this.shipmentRepository = AppDataSource.getRepository(Shipment);
    this.driverRepository = AppDataSource.getRepository(Driver);
  }

  async getSummary(tenantId: string, redis: Redis): Promise<DashboardSummary> {
    // Try to get from materialized view
    let summary = await this.dashboardRepository.findOne({
      where: { tenantId },
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Refresh if not found or stale (older than 1 minute)
    if (!summary || (now.getTime() - summary.lastUpdated.getTime() > 60000)) {
      summary = await this.refreshSummary(tenantId, redis);
    }

    return summary;
  }

  async refreshSummary(tenantId: string, redis: Redis): Promise<DashboardSummary> {
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

    // Count drivers with recent location updates (online)
    let driversOnline = 0;
    for (const driver of drivers) {
      const locationKey = `driver:${tenantId}:${driver.id}:location`;
      try {
        const location = await redis.get(locationKey);
        if (location) {
          const locationData = JSON.parse(location);
          const locationTime = new Date(locationData.timestamp);
          // Consider online if location updated in last 5 minutes
          if (now.getTime() - locationTime.getTime() < 5 * 60 * 1000) {
            driversOnline++;
          }
        }
      } catch (error) {
        // Ignore Redis errors
        // Failed to check driver location - using fallback
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

