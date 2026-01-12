import { buildApp } from '../../../../app';
import { createMockShipment, createMockDriver, createMockUser, createMockJWT } from '../../../helpers/test-helpers';
import { AppDataSource } from '../../../../infra/db/data-source';
import { Shipment } from '../../../../infra/db/entities/Shipment';
import { Driver } from '../../../../infra/db/entities/Driver';
import { ShipmentStatus } from '../../../../infra/db/entities/Shipment';
import { ShipmentRepository } from '../../../../modules/shipments/shipments.repository';
import { EventPublisherService } from '../../../../infra/queues/event-publisher.service';

jest.mock('../../../../infra/db/data-source');
jest.mock('../../../../modules/shipments/shipments.repository');
jest.mock('../../../../infra/queues/event-publisher.service');

describe('ShipmentsController Integration', () => {
  let app: any;
  let mockShipmentRepository: any;
  let mockDriverRepository: any;
  let mockEventPublisher: any;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create mock JWT token
    authToken = createMockJWT({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockShipmentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      addStatusHistory: jest.fn(),
    };

    mockDriverRepository = {
      findOne: jest.fn(),
    };

    mockEventPublisher = {
      publishEvent: jest.fn().mockResolvedValue(undefined),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === Shipment) return mockShipmentRepository;
      if (entity === Driver) return mockDriverRepository;
      return null;
    });

    (ShipmentRepository as jest.Mock).mockImplementation(() => mockShipmentRepository);
    (EventPublisherService as jest.Mock).mockImplementation(() => mockEventPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/shipments', () => {
    it('should create shipment successfully with idempotency key', async () => {
      const mockShipment = createMockShipment();
      mockShipmentRepository.create.mockResolvedValue(mockShipment);
      mockShipmentRepository.addStatusHistory.mockReturnValue({
        id: 'history-1',
        shipmentId: mockShipment.id,
        status: ShipmentStatus.CREATED,
      });

      // Mock query runner
      const mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue(mockShipment),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shipments',
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': 'test-key-123',
        },
        payload: {
          pickupAddress: '123 Pickup St',
          deliveryAddress: '456 Delivery Ave',
          customerName: 'John Doe',
          customerPhone: '+1234567890',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/shipments',
        payload: {
          pickupAddress: '123 Pickup St',
          deliveryAddress: '456 Delivery Ave',
          customerName: 'John Doe',
          customerPhone: '+1234567890',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /v1/shipments/:id/assign-driver', () => {
    it('should assign driver successfully', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.CREATED });
      const mockDriver = createMockDriver();

      mockShipmentRepository.findById.mockResolvedValue(mockShipment);
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);

      const mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue({
            ...mockShipment,
            driverId: mockDriver.id,
            status: ShipmentStatus.ASSIGNED,
          }),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${mockShipment.id}/assign-driver`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': 'assign-key-123',
        },
        payload: {
          driverId: mockDriver.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 for non-existent shipment', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shipments/non-existent/assign-driver',
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': 'assign-key-123',
        },
        payload: {
          driverId: 'driver-1',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /v1/shipments/:id/status', () => {
    it('should update status successfully', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.ASSIGNED });

      mockShipmentRepository.findById.mockResolvedValue(mockShipment);

      const mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue({
            ...mockShipment,
            status: ShipmentStatus.PICKED_UP,
          }),
        },
      };
      (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${mockShipment.id}/status`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': 'status-key-123',
        },
        payload: {
          status: ShipmentStatus.PICKED_UP,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid state transition', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.CREATED });
      mockShipmentRepository.findById.mockResolvedValue(mockShipment);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${mockShipment.id}/status`,
        headers: {
          authorization: `Bearer ${authToken}`,
          'idempotency-key': 'status-key-123',
        },
        payload: {
          status: ShipmentStatus.DELIVERED, // Invalid: can't go from CREATED to DELIVERED
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error_code).toBe('INVALID_SHIPMENT_STATE');
    });
  });
});

