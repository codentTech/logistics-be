import { DashboardSummary } from '../../infra/db/entities/DashboardSummary';
import { AppDataSource } from '../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../infra/db/entities/Shipment';
import { Driver } from '../../infra/db/entities/Driver';
import Redis from 'ioredis';
import { GraphQLContext } from './shipment.resolver';

export const dashboardResolvers = {
  Query: {
    opsSummary: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.tenantId) {
        throw new Error("Authentication required. Please provide a JWT token in the Authorization header.");
      }
      
      const dashboardRepository = AppDataSource.getRepository(DashboardSummary);
      const shipmentRepository = AppDataSource.getRepository(Shipment);
      const driverRepository = AppDataSource.getRepository(Driver);

      // Try to get from materialized view first
      let summary = await dashboardRepository.findOne({
        where: { tenantId: context.tenantId },
      });

      // If not found or stale, calculate fresh
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));

      if (!summary || (now.getTime() - summary.lastUpdated.getTime() > 60000)) {
        // Calculate metrics
        const [totalShipments, activeShipments, deliveredToday, drivers] = await Promise.all([
          shipmentRepository.count({ where: { tenantId: context.tenantId } }),
          shipmentRepository.count({
            where: {
              tenantId: context.tenantId,
              status: ShipmentStatus.IN_TRANSIT,
            },
          }),
          shipmentRepository
            .createQueryBuilder('shipment')
            .where('shipment.tenantId = :tenantId', { tenantId: context.tenantId })
            .andWhere('shipment.status = :status', { status: ShipmentStatus.DELIVERED })
            .andWhere('shipment.deliveredAt >= :todayStart', { todayStart })
            .getCount(),
          driverRepository.find({
            where: { tenantId: context.tenantId, isActive: true },
          }),
        ]);

        // Count drivers with recent location updates (online)
        let driversOnline = 0;
        for (const driver of drivers) {
          const locationKey = `driver:${context.tenantId}:${driver.id}:location`;
          const location = await context.redis.get(locationKey);
          if (location) {
            const locationData = JSON.parse(location);
            const locationTime = new Date(locationData.timestamp);
            // Consider online if location updated in last 5 minutes
            if (now.getTime() - locationTime.getTime() < 5 * 60 * 1000) {
              driversOnline++;
            }
          }
        }

        // Update or create summary
        if (summary) {
          summary.totalShipments = totalShipments;
          summary.activeShipments = activeShipments;
          summary.deliveredToday = deliveredToday;
          summary.driversOnline = driversOnline;
          summary.lastUpdated = now;
          await dashboardRepository.save(summary);
        } else {
          summary = dashboardRepository.create({
            tenantId: context.tenantId,
            totalShipments,
            activeShipments,
            deliveredToday,
            driversOnline,
            lastUpdated: now,
          });
          await dashboardRepository.save(summary);
        }
      }

      return {
        tenantId: summary.tenantId,
        totalShipments: summary.totalShipments,
        activeShipments: summary.activeShipments,
        deliveredToday: summary.deliveredToday,
        driversOnline: summary.driversOnline,
        lastUpdated: summary.lastUpdated.toISOString(),
      };
    },
  },
};

