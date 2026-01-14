import { ShipmentService } from '../../../../modules/shipments/services/shipments.service';
import { ShipmentRepository } from '../../../../modules/shipments/repositories/shipments.repository';
import { EventPublisherService } from '../../../../infra/queues/event-publisher.service';
import { AppDataSource } from '../../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../../infra/db/entities/Shipment';
import { Driver } from '../../../../infra/db/entities/Driver';
import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';
import { createMockShipment, createMockDriver } from '../../../helpers/test-helpers';

jest.mock('../../../../modules/shipments/repositories/shipments.repository');
jest.mock('../../../../infra/queues/event-publisher.service');
jest.mock('../../../../infra/db/data-source');

describe('ShipmentService', () => {
  let shipmentService: ShipmentService;
  let mockShipmentRepository: jest.Mocked<ShipmentRepository>;
  let mockEventPublisher: jest.Mocked<EventPublisherService>;
  let mockQueryRunner: any;
  let mockDriverRepository: any;

  beforeEach(() => {
    mockShipmentRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      addStatusHistory: jest.fn(),
    } as any;

    mockEventPublisher = {
      publishEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockDriverRepository = {
      findOne: jest.fn(),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn(),
      },
    };

    (AppDataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === Driver) return mockDriverRepository;
      return null;
    });

    (ShipmentRepository as jest.Mock).mockImplementation(() => mockShipmentRepository);
    (EventPublisherService as jest.Mock).mockImplementation(() => mockEventPublisher);

    shipmentService = new ShipmentService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createShipment', () => {
    it('should create shipment successfully', async () => {
      const mockShipment = createMockShipment();
      const mockHistory = {
        id: 'history-1',
        shipmentId: mockShipment.id,
        status: ShipmentStatus.CREATED,
        changedBy: 'user-1',
        changedAt: new Date(),
        metadata: null,
        shipment: mockShipment,
        changedByUser: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockShipmentRepository.create.mockResolvedValue(mockShipment);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(mockShipment)
        .mockResolvedValueOnce(mockHistory);
      mockShipmentRepository.addStatusHistory.mockResolvedValue(mockHistory);

      const createDto = {
        pickupAddress: '123 Pickup St',
        deliveryAddress: '456 Delivery Ave',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
      };

      const result = await shipmentService.createShipment('tenant-1', createDto, 'user-1');

      expect(result).toBeDefined();
      expect(mockShipmentRepository.create).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockEventPublisher.publishEvent).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Database error');
      mockShipmentRepository.create.mockResolvedValue(createMockShipment());
      mockQueryRunner.manager.save.mockRejectedValue(error);

      const createDto = {
        pickupAddress: '123 Pickup St',
        deliveryAddress: '456 Delivery Ave',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
      };

      await expect(
        shipmentService.createShipment('tenant-1', createDto, 'user-1')
      ).rejects.toThrow(error);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('assignDriver', () => {
    it('should assign driver successfully', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.CREATED });
      const mockDriver = createMockDriver();
      const mockHistory = {
        id: 'history-1',
        shipmentId: mockShipment.id,
        status: ShipmentStatus.ASSIGNED,
        changedBy: 'user-1',
        changedAt: new Date(),
        metadata: null,
        shipment: mockShipment,
        changedByUser: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockShipmentRepository.findById.mockResolvedValue(mockShipment);
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ...mockShipment, driverId: mockDriver.id, status: ShipmentStatus.ASSIGNED })
        .mockResolvedValueOnce(mockHistory);
      mockShipmentRepository.addStatusHistory.mockResolvedValue(mockHistory);

      const assignDto = { driverId: 'driver-1' };
      const result = await shipmentService.assignDriver('shipment-1', 'tenant-1', assignDto, 'user-1');

      expect(result.driverId).toBe('driver-1');
      expect(result.status).toBe(ShipmentStatus.ASSIGNED);
      expect(mockEventPublisher.publishEvent).toHaveBeenCalled();
    });

    it('should throw error when shipment not found', async () => {
      mockShipmentRepository.findById.mockResolvedValue(null);

      const assignDto = { driverId: 'driver-1' };

      await expect(
        shipmentService.assignDriver('non-existent', 'tenant-1', assignDto, 'user-1')
      ).rejects.toThrow(AppError);

      await expect(
        shipmentService.assignDriver('non-existent', 'tenant-1', assignDto, 'user-1')
      ).rejects.toThrow('Shipment not found');
    });

    it('should throw error when driver not found', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.CREATED });
      mockShipmentRepository.findById.mockResolvedValue(mockShipment);
      mockDriverRepository.findOne.mockResolvedValue(null);

      const assignDto = { driverId: 'non-existent' };

      await expect(
        shipmentService.assignDriver('shipment-1', 'tenant-1', assignDto, 'user-1')
      ).rejects.toThrow(AppError);

      await expect(
        shipmentService.assignDriver('shipment-1', 'tenant-1', assignDto, 'user-1')
      ).rejects.toThrow('Driver not found or inactive');
    });

    it('should throw error for invalid state transition', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.DELIVERED });
      mockShipmentRepository.findById.mockResolvedValue(mockShipment);

      const assignDto = { driverId: 'driver-1' };

      await expect(
        shipmentService.assignDriver('shipment-1', 'tenant-1', assignDto, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateStatus', () => {
    it('should update status successfully', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.ASSIGNED });
      const mockHistory = {
        id: 'history-1',
        shipmentId: mockShipment.id,
        status: ShipmentStatus.IN_TRANSIT,
        changedBy: 'user-1',
        changedAt: new Date(),
        metadata: null,
        shipment: mockShipment,
        changedByUser: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockShipmentRepository.findById.mockResolvedValue(mockShipment);
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ...mockShipment, status: ShipmentStatus.IN_TRANSIT })
        .mockResolvedValueOnce(mockHistory);
      mockShipmentRepository.addStatusHistory.mockResolvedValue(mockHistory);

      const updateDto = { status: ShipmentStatus.IN_TRANSIT };
      const result = await shipmentService.updateStatus('shipment-1', 'tenant-1', updateDto, 'user-1');

      expect(result.status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(mockEventPublisher.publishEvent).toHaveBeenCalled();
    });

    it('should throw error for invalid state transition', async () => {
      const mockShipment = createMockShipment({ status: ShipmentStatus.CREATED });
      mockShipmentRepository.findById.mockResolvedValue(mockShipment);

      const updateDto = { status: ShipmentStatus.DELIVERED };

      await expect(
        shipmentService.updateStatus('shipment-1', 'tenant-1', updateDto, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });
});

