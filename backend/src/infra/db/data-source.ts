import { DataSource } from 'typeorm';
import { dbConfig } from '../../config';
import { Tenant } from './entities/Tenant';
import { User } from './entities/User';
import { Driver } from './entities/Driver';
import { Shipment } from './entities/Shipment';
import { ShipmentStatusHistory } from './entities/ShipmentStatusHistory';
import { EventOutbox } from './entities/EventOutbox';
import { DashboardSummary } from './entities/DashboardSummary';
import { Notification } from './entities/Notification';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  entities: [
    Tenant,
    User,
    Driver,
    Shipment,
    ShipmentStatusHistory,
    EventOutbox,
    DashboardSummary,
    Notification,
  ],
  migrations: ['src/infra/db/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'development' && process.env.DB_SYNC === 'true',
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 10, // Maximum number of connections in pool
    min: 2, // Minimum number of connections in pool
    idleTimeoutMillis: 30000,
  },
});

