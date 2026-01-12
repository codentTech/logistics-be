import { shipmentResolvers } from '../../../graphql/resolvers/shipment.resolver';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { LocationProcessorService } from '../../../modules/drivers/location-processor.service';
import { createMockShipment, createMockDriver } from '../../helpers/test-helpers';
import Redis from 'ioredis';

jest.mock('../../../../infra/db/data-source');
jest.mock('../../../../modules/drivers/location-processor.service');

describe('ShipmentResolver', () => {
  let mockShipmentRepository: any;
  let mockLocationProcessor: jest.Mocked<LocationProcessorService>;
  let mockRedis: jest.Mocked<Redis>;
  let context: any;

  beforeEach(() => {
    mockShipmentRepository = {
      find: jest.fn(),
    };

    mockRedis = {} as any;
    mockLocationProcessor = {
      getLocation: jest.fn(),
    } as any;

    (AppDataSource.getRepository as jest.Mock) = jest.fn().mockReturnValue(mockShipmentRepository);
    (LocationProcessorService as jest.Mock) = jest.fn().mockImplementation(() => mockLocationProcessor);

    context = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      redis: mockRedis,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shipmentDashboard', () => {
    it('should return shipments with driver locations', async () => {
      const mockDriver = createMockDriver();
      const mockShipment1 = createMockShipment({
        id: 'shipment-1',
        driverId: 'driver-1',
        status: ShipmentStatus.IN_TRANSIT,
      });
      const mockShipment2 = createMockShipment({
        id: 'shipment-2',
        status: ShipmentStatus.CREATED,
      });

      mockShipment1.driver = mockDriver;
      mockShipment2.driver = null;

      mockShipmentRepository.find.mockResolvedValue([mockShipment1, mockShipment2]);
      mockLocationProcessor.getLocation.mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      });

      const result = await shipmentResolvers.Query.shipmentDashboard({}, {}, context);

      expect(result).toHaveLength(2);
      expect(result[0].driver?.currentLocation).toBeDefined();
      expect(result[0].driver?.currentLocation?.latitude).toBe(40.7128);
      expect(result[1].driver).toBeNull();
      expect(mockLocationProcessor.getLocation).toHaveBeenCalledWith('tenant-1', 'driver-1');
    });

    it('should filter by status when provided', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.IN_TRANSIT });
      mockShipmentRepository.find.mockResolvedValue([mockShipment]);

      await shipmentResolvers.Query.shipmentDashboard(
        {},
        { status: ShipmentStatus.IN_TRANSIT },
        context
      );

      expect(mockShipmentRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: ShipmentStatus.IN_TRANSIT },
        relations: ['driver'],
        order: { createdAt: 'DESC' },
        take: 100,
      });
    });

    it('should return empty array when no shipments found', async () => {
      mockShipmentRepository.find.mockResolvedValue([]);

      const result = await shipmentResolvers.Query.shipmentDashboard({}, {}, context);

      expect(result).toEqual([]);
    });

    it('should handle shipments without drivers', async () => {
      const mockShipment = createMockShipment({ driverId: null });
      mockShipment.driver = null;
      mockShipmentRepository.find.mockResolvedValue([mockShipment]);

      const result = await shipmentResolvers.Query.shipmentDashboard({}, {}, context);

      expect(result).toHaveLength(1);
      expect(result[0].driver).toBeNull();
      expect(mockLocationProcessor.getLocation).not.toHaveBeenCalled();
    });

    it('should handle Redis location retrieval failure', async () => {
      const mockDriver = createMockDriver();
      const mockShipment = createMockShipment({ driverId: 'driver-1' });
      mockShipment.driver = mockDriver;

      mockShipmentRepository.find.mockResolvedValue([mockShipment]);
      mockLocationProcessor.getLocation.mockResolvedValue(null);

      const result = await shipmentResolvers.Query.shipmentDashboard({}, {}, context);

      expect(result).toHaveLength(1);
      expect(result[0].driver?.currentLocation).toBeNull();
    });
  });
});

