import { DashboardRepository } from '../repositories/dashboard.repository';
import Redis from 'ioredis';
import { UserRole } from '../../../infra/db/entities/User';
import { Server as SocketIOServer } from 'socket.io';

export class DashboardService {
  private dashboardRepository: DashboardRepository;

  constructor() {
    this.dashboardRepository = new DashboardRepository();
  }

  async getSummary(
    tenantId: string,
    redis: Redis,
    userRole?: UserRole,
    driverId?: string,
    io?: SocketIOServer
  ) {
    const summary = await this.dashboardRepository.getSummary(
      tenantId,
      redis,
      userRole,
      driverId,
      io
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

  async refreshSummary(tenantId: string, redis: Redis, io?: SocketIOServer) {
    const summary = await this.dashboardRepository.refreshSummary(tenantId, redis, io);
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

