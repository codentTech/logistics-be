import { DashboardRepository } from '../repositories/dashboard.repository';
import Redis from 'ioredis';
import { UserRole } from '../../../infra/db/entities/User';

export class DashboardService {
  private dashboardRepository: DashboardRepository;

  constructor() {
    this.dashboardRepository = new DashboardRepository();
  }

  async getSummary(
    tenantId: string,
    redis: Redis,
    userRole?: UserRole,
    driverId?: string
  ) {
    const summary = await this.dashboardRepository.getSummary(
      tenantId,
      redis,
      userRole,
      driverId
    );
    return {
      tenantId: summary.tenantId,
      totalShipments: summary.totalShipments,
      activeShipments: summary.activeShipments,
      deliveredToday: summary.deliveredToday,
      driversOnline: summary.driversOnline,
      lastUpdated: summary.lastUpdated.toISOString(),
    };
  }

  async refreshSummary(tenantId: string, redis: Redis) {
    const summary = await this.dashboardRepository.refreshSummary(tenantId, redis);
    return {
      tenantId: summary.tenantId,
      totalShipments: summary.totalShipments,
      activeShipments: summary.activeShipments,
      deliveredToday: summary.deliveredToday,
      driversOnline: summary.driversOnline,
      lastUpdated: summary.lastUpdated.toISOString(),
    };
  }
}

