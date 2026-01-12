import { Shipment, ShipmentStatus } from '../../infra/db/entities/Shipment';
import { AppDataSource } from '../../infra/db/data-source';
import { LocationProcessorService } from '../../modules/drivers/location-processor.service';
import Redis from 'ioredis';

export interface GraphQLContext {
  tenantId: string | null;
  userId: string | null;
  redis: Redis;
}

export const shipmentResolvers = {
  Query: {
    shipmentDashboard: async (
      _: any,
      args: { status?: ShipmentStatus },
      context: GraphQLContext
    ) => {
      if (!context.tenantId) {
        throw new Error("Authentication required. Please provide a JWT token in the Authorization header.");
      }
      
      const shipmentRepository = AppDataSource.getRepository(Shipment);
      
      const where: any = { tenantId: context.tenantId };
      if (args.status) {
        where.status = args.status;
      }

      const shipments = await shipmentRepository.find({
        where,
        relations: ['driver'],
        order: { createdAt: 'DESC' },
        take: 100, // Limit for performance
      });

      // Enrich with driver locations from Redis
      const locationProcessor = new LocationProcessorService(context.redis);
      const shipmentsWithLocations = await Promise.all(
        shipments.map(async (shipment) => {
          let driverLocation = null;
          if (shipment.driverId && context.tenantId) {
            driverLocation = await locationProcessor.getLocation(
              context.tenantId,
              shipment.driverId
            );
          }

          return {
            ...shipment,
            driver: shipment.driver
              ? {
                  ...shipment.driver,
                  currentLocation: driverLocation,
                }
              : null,
          };
        })
      );

      return shipmentsWithLocations;
    },
  },
};

