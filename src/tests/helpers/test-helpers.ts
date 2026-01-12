import { Tenant } from '../../infra/db/entities/Tenant';
import { User, UserRole } from '../../infra/db/entities/User';
import { Driver } from '../../infra/db/entities/Driver';
import { Shipment, ShipmentStatus } from '../../infra/db/entities/Shipment';
import bcrypt from 'bcrypt';

export const createMockTenant = (overrides?: Partial<Tenant>): Tenant => {
  const tenant = new Tenant();
  tenant.id = overrides?.id || 'tenant-1';
  tenant.name = overrides?.name || 'Test Tenant';
  tenant.isActive = overrides?.isActive !== undefined ? overrides.isActive : true;
  tenant.createdAt = overrides?.createdAt || new Date();
  tenant.updatedAt = overrides?.updatedAt || new Date();
  return tenant;
};

export const createMockUser = async (overrides?: Partial<User>): Promise<User> => {
  const user = new User();
  user.id = overrides?.id || 'user-1';
  user.email = overrides?.email || 'test@example.com';
  user.passwordHash = overrides?.passwordHash || await bcrypt.hash('password123', 10);
  user.role = overrides?.role || UserRole.OPS_ADMIN;
  user.tenantId = overrides?.tenantId || 'tenant-1';
  user.isActive = overrides?.isActive !== undefined ? overrides.isActive : true;
  user.createdAt = overrides?.createdAt || new Date();
  user.updatedAt = overrides?.updatedAt || new Date();
  user.tenant = overrides?.tenant || createMockTenant();
  return user;
};

export const createMockDriver = (overrides?: Partial<Driver>): Driver => {
  const driver = new Driver();
  driver.id = overrides?.id || 'driver-1';
  driver.name = overrides?.name || 'Test Driver';
  driver.phone = overrides?.phone || '+1234567890';
  driver.tenantId = overrides?.tenantId || 'tenant-1';
  driver.isActive = overrides?.isActive !== undefined ? overrides.isActive : true;
  driver.createdAt = overrides?.createdAt || new Date();
  driver.updatedAt = overrides?.updatedAt || new Date();
  return driver;
};

export const createMockShipment = (overrides?: Partial<Shipment>): Shipment => {
  const shipment = new Shipment();
  shipment.id = overrides?.id || 'shipment-1';
  shipment.tenantId = overrides?.tenantId || 'tenant-1';
  shipment.status = overrides?.status || ShipmentStatus.CREATED;
  shipment.pickupAddress = overrides?.pickupAddress || '123 Pickup St';
  shipment.deliveryAddress = overrides?.deliveryAddress || '456 Delivery Ave';
  shipment.customerName = overrides?.customerName || 'John Doe';
  shipment.customerPhone = overrides?.customerPhone || '+1234567890';
  shipment.driverId = overrides?.driverId || null;
  shipment.createdAt = overrides?.createdAt || new Date();
  shipment.updatedAt = overrides?.updatedAt || new Date();
  return shipment;
};

export const createMockJWT = (payload: any): string => {
  // Simple mock JWT - in real tests, use actual JWT library
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
};

export const createMockRequest = (overrides?: any): any => {
  return {
    headers: {
      authorization: 'Bearer mock-token',
      'idempotency-key': 'test-idempotency-key',
      ...overrides?.headers,
    },
    params: overrides?.params || {},
    body: overrides?.body || {},
    query: overrides?.query || {},
    user: overrides?.user || {
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@example.com',
      role: UserRole.OPS_ADMIN,
    },
    jwtVerify: jest.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@example.com',
      role: UserRole.OPS_ADMIN,
    }),
    method: overrides?.method || 'POST',
    ...overrides,
  };
};

export const createMockReply = (): any => {
  const reply: any = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis(),
    statusCode: 200,
  };
  return reply;
};

