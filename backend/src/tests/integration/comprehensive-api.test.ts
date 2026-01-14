import { buildApp } from '../../app';
import { AppDataSource } from '../../infra/db/data-source';
import { User, UserRole } from '../../infra/db/entities/User';
import { Tenant } from '../../infra/db/entities/Tenant';
import { Driver } from '../../infra/db/entities/Driver';
import { Shipment, ShipmentStatus } from '../../infra/db/entities/Shipment';
import bcrypt from 'bcrypt';
import { createMockJWT } from '../helpers/test-helpers';

// Mock all external dependencies
jest.mock('../../infra/db/data-source');
jest.mock('../../plugins/redis');
jest.mock('../../plugins/socket');
jest.mock('../../infra/queues/event-publisher.service');
jest.mock('../../infra/mqtt/mqtt.subscriber');
jest.mock('../../modules/shipments/services/route-simulation.service');

describe('Comprehensive API Integration Tests', () => {
  let app: any;
  let adminTokenTenant1: string;
  let adminTokenTenant2: string;
  let driverTokenTenant1: string;
  let customerTokenTenant1: string;
  let tenant1Id: string;
  let tenant2Id: string;
  let driver1Id: string;
  let driver2Id: string;
  let shipment1Id: string;
  let shipment2Id: string;

  // Mock repositories
  let mockUserRepository: any;
  let mockTenantRepository: any;
  let mockDriverRepository: any;
  let mockShipmentRepository: any;

  beforeAll(async () => {
    // Mock Redis
    const mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    jest.doMock('../../plugins/redis', () => ({
      default: jest.fn().mockImplementation((fastify: any) => {
        fastify.decorate('redis', mockRedis);
      }),
    }));

    // Mock Socket.IO
    jest.doMock('../../plugins/socket', () => ({
      default: jest.fn().mockImplementation((fastify: any) => {
        fastify.decorate('io', {
          to: jest.fn().mockReturnValue({
            emit: jest.fn(),
          }),
        });
      }),
    }));

    // Mock Event Publisher
    jest.doMock('../../infra/queues/event-publisher.service', () => ({
      EventPublisherService: jest.fn().mockImplementation(() => ({
        publishEvent: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    // Mock MQTT
    jest.doMock('../../infra/mqtt/mqtt.subscriber', () => ({
      MQTTSubscriber: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
      })),
    }));

    // Mock Route Simulation
    jest.doMock('../../modules/shipments/services/route-simulation.service', () => ({
      RouteSimulationService: jest.fn().mockImplementation(() => ({
        startSimulation: jest.fn().mockResolvedValue(undefined),
        stopSimulationByShipment: jest.fn().mockResolvedValue(undefined),
        hasActiveSimulation: jest.fn().mockReturnValue(false),
      })),
    }));

    app = await buildApp();
    await app.ready();

    // Setup test data IDs
    tenant1Id = 'tenant-1-test';
    tenant2Id = 'tenant-2-test';
    driver1Id = 'driver-1-test';
    driver2Id = 'driver-2-test';
    shipment1Id = 'shipment-1-test';
    shipment2Id = 'shipment-2-test';
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    // Initialize mock repositories
    mockUserRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockTenantRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockDriverRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockShipmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      addStatusHistory: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity) => {
      if (entity === User) return mockUserRepository;
      if (entity === Tenant) return mockTenantRepository;
      if (entity === Driver) return mockDriverRepository;
      if (entity === Shipment) return mockShipmentRepository;
      return null;
    });

    // Create test tokens using mock JWT helper
    adminTokenTenant1 = createMockJWT({ userId: 'admin-1', tenantId: tenant1Id, email: 'admin1@test.com', role: UserRole.OPS_ADMIN });
    adminTokenTenant2 = createMockJWT({ userId: 'admin-2', tenantId: tenant2Id, email: 'admin2@test.com', role: UserRole.OPS_ADMIN });
    driverTokenTenant1 = createMockJWT({ userId: 'driver-user-1', tenantId: tenant1Id, email: 'driver1@test.com', role: UserRole.DRIVER });
    customerTokenTenant1 = createMockJWT({ userId: 'customer-1', tenantId: tenant1Id, email: 'customer1@test.com', role: UserRole.CUSTOMER });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Tenant Login Flow', () => {
    it('should return tenant list when email exists in multiple tenants', async () => {
      const tenant1 = { id: tenant1Id, name: 'Tenant 1', slug: 'tenant-1', isActive: true };
      const tenant2 = { id: tenant2Id, name: 'Tenant 2', slug: 'tenant-2', isActive: true };

      const user1 = {
        id: 'user-1',
        email: 'multi@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        tenantId: tenant1Id,
        role: UserRole.OPS_ADMIN,
        isActive: true,
        tenant: tenant1,
      };

      const user2 = {
        id: 'user-2',
        email: 'multi@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        tenantId: tenant2Id,
        role: UserRole.OPS_ADMIN,
        isActive: true,
        tenant: tenant2,
      };

      mockUserRepository.find.mockResolvedValue([user1, user2]);
      mockTenantRepository.find.mockResolvedValue([tenant1, tenant2]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'multi@test.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.requiresTenantSelection).toBe(true);
      expect(body.tenants).toHaveLength(2);
      expect(body.tenants[0].name).toBe('Tenant 1');
      expect(body.tenants[1].name).toBe('Tenant 2');
    });

    it('should login directly when email exists in single tenant', async () => {
      const tenant1 = { id: tenant1Id, name: 'Tenant 1', slug: 'tenant-1', isActive: true };
      const user1 = {
        id: 'user-1',
        email: 'single@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        tenantId: tenant1Id,
        role: UserRole.OPS_ADMIN,
        isActive: true,
        tenant: tenant1,
      };

      mockUserRepository.find.mockResolvedValue([user1]);
      mockTenantRepository.find.mockResolvedValue([tenant1]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'single@test.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe('single@test.com');
    });

    it('should complete login after tenant selection', async () => {
      const tenant1 = { id: tenant1Id, name: 'Tenant 1', slug: 'tenant-1', isActive: true };
      const user1 = {
        id: 'user-1',
        email: 'multi@test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        tenantId: tenant1Id,
        role: UserRole.OPS_ADMIN,
        isActive: true,
        tenant: tenant1,
      };

      mockUserRepository.find.mockResolvedValue([user1]);
      mockTenantRepository.findOne.mockResolvedValue(tenant1);
      mockUserRepository.findOne.mockResolvedValue(user1);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'multi@test.com',
          password: 'password123',
          tenantId: tenant1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.tenantId).toBe(tenant1Id);
    });
  });

  describe('Admin Role - Shipment Management', () => {
    it('should create shipment as admin', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.CREATED,
        pickupAddress: '123 Pickup St',
        deliveryAddress: '456 Delivery Ave',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockShipmentRepository.create.mockReturnValue(shipment);
      mockShipmentRepository.save.mockResolvedValue(shipment);
      mockShipmentRepository.addStatusHistory.mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/v1/shipments',
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          pickupAddress: '123 Pickup St',
          deliveryAddress: '456 Delivery Ave',
          customerName: 'John Doe',
          customerPhone: '+1234567890',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.CREATED);
    });

    it('should assign driver to shipment as admin', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.CREATED,
        driverId: null,
      };

      const driver = {
        id: driver1Id,
        tenantId: tenant1Id,
        isActive: true,
      };

      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockDriverRepository.findOne.mockResolvedValue(driver);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/assign-driver`,
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          driverId: driver1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.ASSIGNED);
      expect(body.data.driverId).toBe(driver1Id);
    });

    it('should prevent reassignment when shipment is already assigned', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      };

      mockShipmentRepository.findOne.mockResolvedValue(shipment);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/assign-driver`,
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          driverId: driver2Id,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should update shipment status as admin', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      };

      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.IN_TRANSIT,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          status: ShipmentStatus.IN_TRANSIT,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should get all shipments as admin', async () => {
      const shipments = [
        {
          id: shipment1Id,
          tenantId: tenant1Id,
          status: ShipmentStatus.CREATED,
        },
        {
          id: shipment2Id,
          tenantId: tenant1Id,
          status: ShipmentStatus.ASSIGNED,
        },
      ];

      mockShipmentRepository.find = jest.fn().mockResolvedValue(shipments);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shipments',
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('Driver Role - Operations', () => {
    it('should only see assigned shipments as driver', async () => {
      const assignedShipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.find = jest.fn().mockResolvedValue([assignedShipment]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/shipments',
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.every((s: any) => s.driverId === driver1Id)).toBe(true);
    });

    it('should update driver location', async () => {
      const driver = {
        id: driver1Id,
        tenantId: tenant1Id,
        isActive: true,
      };

      mockDriverRepository.findOne.mockResolvedValue(driver);
      mockDriverRepository.save.mockResolvedValue({
        ...driver,
        latitude: 40.7128,
        longitude: -74.0060,
        lastLocationUpdate: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/drivers/location',
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          latitude: 40.7128,
          longitude: -74.0060,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should update shipment status to IN_TRANSIT as driver', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.IN_TRANSIT,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          status: ShipmentStatus.IN_TRANSIT,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.IN_TRANSIT);
    });

    it('should update shipment status to DELIVERED as driver', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.IN_TRANSIT,
        driverId: driver1Id,
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.DELIVERED,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          status: ShipmentStatus.DELIVERED,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.DELIVERED);
    });

    it('should not access other drivers shipments', async () => {
      const otherDriverShipment = {
        id: shipment2Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver2Id, // Different driver
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.findOne.mockResolvedValue(otherDriverShipment);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/shipments/${shipment2Id}`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Customer Role - Operations', () => {
    it('should cancel shipment before IN_TRANSIT as customer', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.CREATED,
        customerName: 'John Doe',
        customerPhone: '+1234567890',
      };

      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.CANCEL_BY_CUSTOMER,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/cancel-by-customer`,
        headers: {
          authorization: `Bearer ${customerTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.CANCEL_BY_CUSTOMER);
    });

    it('should not cancel shipment after IN_TRANSIT as customer', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.IN_TRANSIT,
        customerName: 'John Doe',
        customerPhone: '+1234567890',
      };

      mockShipmentRepository.findOne.mockResolvedValue(shipment);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/cancel-by-customer`,
        headers: {
          authorization: `Bearer ${customerTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Shipment Status Transitions', () => {
    it('should transition CREATED -> ASSIGNED -> IN_TRANSIT -> DELIVERED', async () => {
      let shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.CREATED,
        driverId: null,
      };

      // Step 1: Assign driver
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      });

      let response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/assign-driver`,
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: { driverId: driver1Id },
      });

      expect(response.statusCode).toBe(200);
      shipment = JSON.parse(response.body).data;

      // Step 2: Update to IN_TRANSIT
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.IN_TRANSIT,
      });

      response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: { status: ShipmentStatus.IN_TRANSIT },
      });

      expect(response.statusCode).toBe(200);
      shipment = JSON.parse(response.body).data;
      expect(shipment.status).toBe(ShipmentStatus.IN_TRANSIT);

      // Step 3: Update to DELIVERED
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.DELIVERED,
      });

      response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: { status: ShipmentStatus.DELIVERED },
      });

      expect(response.statusCode).toBe(200);
      shipment = JSON.parse(response.body).data;
      expect(shipment.status).toBe(ShipmentStatus.DELIVERED);
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    it('should not allow admin from tenant1 to access tenant2 shipments', async () => {
      const tenant2Shipment = {
        id: shipment2Id,
        tenantId: tenant2Id,
        status: ShipmentStatus.CREATED,
      };

      mockShipmentRepository.findOne.mockResolvedValue(tenant2Shipment);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/shipments/${shipment2Id}`,
        headers: {
          authorization: `Bearer ${adminTokenTenant1}`,
          'x-tenant-id': tenant1Id, // Wrong tenant
        },
      });

      // Should return 404 or 403 depending on implementation
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should allow admin from tenant2 to access tenant2 shipments', async () => {
      const tenant2Shipment = {
        id: shipment2Id,
        tenantId: tenant2Id,
        status: ShipmentStatus.CREATED,
      };

      mockShipmentRepository.findOne.mockResolvedValue(tenant2Shipment);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/shipments/${shipment2Id}`,
        headers: {
          authorization: `Bearer ${adminTokenTenant2}`,
          'x-tenant-id': tenant2Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(tenant2Id);
    });
  });

  describe('Route Simulation Trigger', () => {
    it('should trigger route simulation when status changes to IN_TRANSIT', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
        pickupAddress: '123 Pickup St',
        deliveryAddress: '456 Delivery Ave',
      };

      const { RouteSimulationService } = require('../../modules/shipments/services/route-simulation.service');
      const mockRouteSimulation = {
        startSimulation: jest.fn().mockResolvedValue(undefined),
        hasActiveSimulation: jest.fn().mockReturnValue(false),
      };
      RouteSimulationService.mockImplementation(() => mockRouteSimulation);

      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.IN_TRANSIT,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/shipments/${shipment1Id}/status`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
        payload: {
          status: ShipmentStatus.IN_TRANSIT,
        },
      });

      expect(response.statusCode).toBe(200);
      // Verify route simulation was called
      expect(mockRouteSimulation.startSimulation).toHaveBeenCalledWith(
        shipment1Id,
        driver1Id,
        tenant1Id,
        shipment.pickupAddress,
        shipment.deliveryAddress
      );
    });
  });

  describe('Cancellation Flows', () => {
    it('should allow driver to cancel before IN_TRANSIT', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.ASSIGNED,
        driverId: driver1Id,
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.findOne.mockResolvedValue(shipment);
      mockShipmentRepository.save.mockResolvedValue({
        ...shipment,
        status: ShipmentStatus.CANCEL_BY_DRIVER,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/cancel-by-driver`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(ShipmentStatus.CANCEL_BY_DRIVER);
    });

    it('should not allow driver to cancel after IN_TRANSIT', async () => {
      const shipment = {
        id: shipment1Id,
        tenantId: tenant1Id,
        status: ShipmentStatus.IN_TRANSIT,
        driverId: driver1Id,
      };

      mockDriverRepository.findOne.mockResolvedValue({ id: driver1Id, tenantId: tenant1Id });
      mockShipmentRepository.findOne.mockResolvedValue(shipment);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/shipments/${shipment1Id}/cancel-by-driver`,
        headers: {
          authorization: `Bearer ${driverTokenTenant1}`,
          'x-tenant-id': tenant1Id,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

