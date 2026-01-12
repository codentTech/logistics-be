import { LocationProcessorService } from '../../../../modules/drivers/location-processor.service';
import { AppDataSource } from '../../../../infra/db/data-source';
import { Driver } from '../../../../infra/db/entities/Driver';
import { AppError, ErrorCode } from '../../../../shared/errors/error-handler';
import { createMockDriver } from '../../../helpers/test-helpers';
import Redis from 'ioredis';

jest.mock('../../../../infra/db/data-source');

describe('LocationProcessorService', () => {
  let locationProcessor: LocationProcessorService;
  let mockRedis: jest.Mocked<Redis>;
  let mockDriverRepository: any;

  beforeEach(() => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
    } as any;

    mockDriverRepository = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn().mockReturnValue(mockDriverRepository);

    locationProcessor = new LocationProcessorService(mockRedis);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processLocation', () => {
    it('should process location successfully', async () => {
      const mockDriver = createMockDriver();
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);

      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      };

      await locationProcessor.processLocation('tenant-1', 'driver-1', location, 'REST');

      expect(mockDriverRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'driver-1', tenantId: 'tenant-1', isActive: true },
      });
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'driver:tenant-1:driver-1:location',
        3600,
        expect.stringContaining('"latitude":40.7128')
      );
    });

    it('should throw error when driver not found', async () => {
      mockDriverRepository.findOne.mockResolvedValue(null);

      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      };

      await expect(
        locationProcessor.processLocation('tenant-1', 'non-existent', location, 'REST')
      ).rejects.toThrow(AppError);

      await expect(
        locationProcessor.processLocation('tenant-1', 'non-existent', location, 'REST')
      ).rejects.toThrow('Driver not found or does not belong to tenant');
    });

    it('should throw error for invalid latitude', async () => {
      const mockDriver = createMockDriver();
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);

      const location = {
        latitude: 100, // Invalid (> 90)
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      };

      await expect(
        locationProcessor.processLocation('tenant-1', 'driver-1', location, 'REST')
      ).rejects.toThrow(AppError);

      await expect(
        locationProcessor.processLocation('tenant-1', 'driver-1', location, 'REST')
      ).rejects.toThrow('Invalid latitude or longitude values');
    });

    it('should throw error for invalid longitude', async () => {
      const mockDriver = createMockDriver();
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);

      const location = {
        latitude: 40.7128,
        longitude: 200, // Invalid (> 180)
        timestamp: '2024-01-01T12:00:00Z',
      };

      await expect(
        locationProcessor.processLocation('tenant-1', 'driver-1', location, 'REST')
      ).rejects.toThrow(AppError);
    });

    it('should handle Redis failure gracefully', async () => {
      const mockDriver = createMockDriver();
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      };

      // Should not throw, just log warning
      await expect(
        locationProcessor.processLocation('tenant-1', 'driver-1', location, 'REST')
      ).resolves.not.toThrow();
    });

    it('should include source in location data', async () => {
      const mockDriver = createMockDriver();
      mockDriverRepository.findOne.mockResolvedValue(mockDriver);

      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
      };

      await locationProcessor.processLocation('tenant-1', 'driver-1', location, 'MQTT');

      const setexCall = mockRedis.setex.mock.calls[0];
      const storedData = JSON.parse(setexCall[2] as string);
      expect(storedData.source).toBe('MQTT');
    });
  });

  describe('getLocation', () => {
    it('should retrieve location from Redis', async () => {
      const locationData = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: '2024-01-01T12:00:00Z',
        source: 'REST',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(locationData));

      const result = await locationProcessor.getLocation('tenant-1', 'driver-1');

      expect(result).toEqual(locationData);
      expect(mockRedis.get).toHaveBeenCalledWith('driver:tenant-1:driver-1:location');
    });

    it('should return null when location not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await locationProcessor.getLocation('tenant-1', 'driver-1');

      expect(result).toBeNull();
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await locationProcessor.getLocation('tenant-1', 'driver-1');

      expect(result).toBeNull();
    });
  });
});

