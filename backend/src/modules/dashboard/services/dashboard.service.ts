import { DashboardRepository } from '../repositories/dashboard.repository';
import Redis from 'ioredis';

export class DashboardService {
  private dashboardRepository: DashboardRepository;

  constructor() {
    this.dashboardRepository = new DashboardRepository();
  }

  async getSummary(tenantId: string, redis: Redis) {
    const summary = await this.dashboardRepository.getSummary(tenantId, redis);
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

