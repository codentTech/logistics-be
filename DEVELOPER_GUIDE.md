# 📘 OpsCore Backend - Complete Developer Guide

**Version:** 1.0.0  
**Last Updated:** 2024  
**Tech Stack:** Node.js, TypeScript, Fastify, PostgreSQL, Redis, RabbitMQ, MQTT, GraphQL

---

## 📑 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Local Development Setup](#local-development-setup)
5. [Server Deployment](#server-deployment)
6. [API Documentation](#api-documentation)
7. [Testing Guide](#testing-guide)
8. [Development Workflow](#development-workflow)
9. [Database Schema](#database-schema)
10. [State Machine](#state-machine)
11. [Real-Time Features](#real-time-features)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## 🎯 Project Overview

OpsCore is a production-grade, real-time logistics backend platform featuring:

- **Multi-tenant architecture** with tenant isolation
- **Event-driven system** using RabbitMQ
- **Real-time updates** via Socket.IO and MQTT
- **CQRS pattern** with GraphQL for reads
- **State machine** for shipment lifecycle
- **Idempotency** support for safe retries
- **Resilience patterns** (retry, circuit breaker, DLQ)

---

## 🏗️ Architecture

### System Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Fastify   │────▶│ PostgreSQL  │
│  (Frontend) │     │   (REST)    │     │  (Primary)  │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ├────▶ Redis (Cache/Pub-Sub)
                            │
                            ├────▶ RabbitMQ (Events)
                            │
                            ├────▶ MQTT (Telemetry)
                            │
                            └────▶ GraphQL (Reads)
```

### Technology Stack

| Component         | Technology     | Purpose              |
| ----------------- | -------------- | -------------------- |
| **Runtime**       | Node.js 18+    | JavaScript runtime   |
| **Language**      | TypeScript     | Type safety          |
| **Framework**     | Fastify        | HTTP server          |
| **Database**      | PostgreSQL 15+ | Primary data store   |
| **Cache**         | Redis 7+       | Caching & pub/sub    |
| **Message Queue** | RabbitMQ 3.12+ | Event bus            |
| **MQTT Broker**   | EMQX 5.3+      | Telemetry intake     |
| **GraphQL**       | Mercurius      | Query layer          |
| **ORM**           | TypeORM        | Database abstraction |
| **Auth**          | JWT            | Authentication       |

---

## 📋 Prerequisites

### Required Software

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Git** (for version control)
- **Access to Ubuntu Server** with:
  - PostgreSQL 15+ (running on server)
  - Redis 7+ (running on server)
  - RabbitMQ 3.12+ (running on server)
  - MQTT Broker (EMQX) - optional, for driver location telemetry

### Important

- **All services run on Ubuntu server** - you don't need to install them locally
- **Code runs on your local machine** - connects to server via connection strings
- **Connection strings** are configured in `.env` file

---

## 💻 Local Development Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd opsCore
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with connection strings to your Ubuntu server:

```env
# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database (PostgreSQL on Ubuntu server)
POSTGRES_HOST=your-server-ip-or-domain
POSTGRES_PORT=5432
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=your_db_name

# Redis (on Ubuntu server)
REDIS_HOST=your-server-ip-or-domain
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_if_set

# JWT
JWT_SECRET=your_jwt_secret_key_change_in_production_min_32_chars
JWT_EXPIRES_IN=7d

# RabbitMQ (on Ubuntu server)
RABBITMQ_URL=amqp://your-server-ip-or-domain:5672
RABBITMQ_USER=your_rabbitmq_user
RABBITMQ_PASSWORD=your_rabbitmq_password

# MQTT (on Ubuntu server, optional)
MQTT_BROKER_URL=mqtt://your-server-ip-or-domain:1883
MQTT_USERNAME=your_mqtt_username_if_set
MQTT_PASSWORD=your_mqtt_password_if_set

# Swagger
SWAGGER_ENABLED=true
SWAGGER_HOST=localhost:3000

# Database Sync (development only)
DB_SYNC=false
```

**Important:** Get connection strings from your DevOps team or server administrator.

### Step 4: Configure Connection Strings

**All services run on Ubuntu server.** Configure connection strings in `.env`:

```env
# Database (on Ubuntu server)
POSTGRES_HOST=your-server-ip-or-domain
POSTGRES_PORT=5432
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=your_db_name

# Redis (on Ubuntu server)
REDIS_HOST=your-server-ip-or-domain
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_if_set

# RabbitMQ (on Ubuntu server)
RABBITMQ_URL=amqp://your-server-ip-or-domain:5672
RABBITMQ_USER=your_rabbitmq_user
RABBITMQ_PASSWORD=your_rabbitmq_password

# MQTT (on Ubuntu server, optional)
MQTT_BROKER_URL=mqtt://your-server-ip-or-domain:1883
MQTT_USERNAME=your_mqtt_username_if_set
MQTT_PASSWORD=your_mqtt_password_if_set
```

**Note:** Get these connection details from your server administrator or DevOps team.

### Step 5: Initialize Database

```bash
# Create tables (connects to server database)
npm run db:init

# Seed initial data (tenant, users, drivers)
npm run seed
```

**Important:** Copy the `Tenant ID` and `Driver ID` from seed output - you'll need them for testing!

### Step 6: Start Development Server

```bash
npm run dev
```

Server runs on: `http://localhost:3000` and connects to services on Ubuntu server.

### Step 7: Verify Setup

- **Swagger UI:** http://localhost:3000/docs
- **GraphQL Playground:** http://localhost:3000/graphql
- **Health Check:** http://localhost:3000/health

**Verify connections:**

- Check server logs for connection status
- Health endpoint shows service connectivity

---

## 🔗 Connecting to Services

**All services (PostgreSQL, Redis, RabbitMQ, MQTT) run on a remote server.**

You'll receive connection strings from your team lead or DevOps team. Configure them in your `.env` file as shown in Step 3 above.

**Required Services:**

- PostgreSQL 15+ (database)
- Redis 7+ (cache/pub-sub)
- RabbitMQ 3.12+ (message queue)
- EMQX/MQTT (optional, for telemetry)

**Note:** If you don't have connection strings yet, contact your team lead.

---

## 📚 API Documentation

### Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://your-domain.com`

### API Versioning

All endpoints are versioned: `/v1/...`

### Authentication

Most endpoints require JWT authentication:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Available Endpoints

#### Authentication

**POST** `/v1/auth/login`

- Login and get JWT token
- **Body:**
  ```json
  {
    "email": "admin@tenant1.com",
    "password": "password123",
    "tenantId": "tenant-uuid"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "token": "eyJhbGci...",
    "user": {
      "id": "user-uuid",
      "email": "admin@tenant1.com",
      "role": "ops_admin",
      "tenantId": "tenant-uuid"
    }
  }
  ```

#### Shipments

**POST** `/v1/shipments`

- Create a new shipment
- **Headers:** `Authorization: Bearer TOKEN`, `Idempotency-Key: unique-key` (optional)
- **Body:**
  ```json
  {
    "pickupAddress": "123 Main St, NY",
    "deliveryAddress": "456 Oak Ave, NY",
    "customerName": "John Doe",
    "customerPhone": "+1234567890"
  }
  ```

**POST** `/v1/shipments/:id/assign-driver`

- Assign driver to shipment
- **Body:**
  ```json
  {
    "driverId": "driver-uuid"
  }
  ```

**POST** `/v1/shipments/:id/status`

- Update shipment status
- **Body:**
  ```json
  {
    "status": "PICKED_UP"
  }
  ```
- **Valid Statuses:** `CREATED` → `ASSIGNED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`

#### Drivers

**POST** `/v1/drivers/:id/location`

- Update driver location (REST endpoint)
- **Body:**
  ```json
  {
    "latitude": 40.7128,
    "longitude": -74.006,
    "timestamp": "2024-01-01T12:00:00Z"
  }
  ```

#### Dashboard

**GET** `/v1/dashboard/summary`

- Get operational dashboard summary (CQRS read)
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "tenantId": "tenant-uuid",
      "totalShipments": 10,
      "activeShipments": 5,
      "deliveredToday": 3,
      "driversOnline": 2,
      "lastUpdated": "2024-01-01T12:00:00Z"
    }
  }
  ```

### GraphQL API

**Endpoint:** `POST /graphql`

**Authentication:** Required via `Authorization: Bearer TOKEN` header

**Available Queries:**

```graphql
# Get dashboard summary
query {
  opsSummary {
    tenantId
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
    lastUpdated
  }
}

# Get shipments
query {
  shipmentDashboard {
    id
    status
    pickupAddress
    deliveryAddress
    customerName
    driver {
      id
      name
      phone
      currentLocation {
        latitude
        longitude
        timestamp
      }
    }
  }
}

# Get shipments by status
query {
  shipmentDashboard(status: ASSIGNED) {
    id
    status
    customerName
  }
}
```

---

## 🧪 Testing Guide

### Quick Start Testing

1. **Get Test Credentials:**

   ```bash
   npm run seed
   ```

   Copy `Tenant ID` and `Driver ID` from output.

2. **Login:**

   ```bash
   POST /v1/auth/login
   {
     "email": "admin@tenant1.com",
     "password": "password123",
     "tenantId": "YOUR_TENANT_ID"
   }
   ```

   Copy the `token`.

3. **Test Endpoints:**
   - Use Swagger UI: http://localhost:3000/docs
   - Or use Postman collection: `postman_collection.json`
   - Or use automated script: `./test-all-apis.sh`

### Complete Test Flow

See `API_TESTING_GUIDE.md` for detailed testing instructions.

**Basic Flow:**

1. Login → Get token
2. Create shipment → Get shipment ID
3. Assign driver → Status becomes `ASSIGNED`
4. Update status → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`
5. Update driver location
6. Check dashboard summary
7. Query GraphQL

### Automated Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

---

## 🔄 Development Workflow

### Project Structure

```
opsCore/
├── src/
│   ├── app.ts                 # Main application entry
│   ├── config/                # Configuration
│   ├── domain/                # Business logic
│   │   ├── events/            # Event definitions
│   │   └── stateMachines/     # State machines
│   ├── graphql/               # GraphQL schema & resolvers
│   ├── infra/                 # Infrastructure
│   │   ├── db/                # Database entities
│   │   ├── mqtt/              # MQTT subscriber
│   │   ├── queues/            # RabbitMQ client
│   │   └── resilience/       # Retry, circuit breaker
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication
│   │   ├── shipments/         # Shipment management
│   │   ├── drivers/          # Driver management
│   │   └── dashboard/        # Dashboard (CQRS)
│   ├── plugins/               # Fastify plugins
│   ├── scripts/               # Utility scripts
│   ├── shared/                # Shared utilities
│   └── tests/                 # Test files
├── .env.example               # Environment template
├── docker-compose.yml         # Local services
├── package.json
└── tsconfig.json
```

### Code Organization

- **Modules:** Feature-based (auth, shipments, drivers, dashboard)
- **Domain:** Business logic, state machines, events
- **Infrastructure:** External services (DB, Redis, RabbitMQ, MQTT)
- **Plugins:** Fastify plugins (auth, swagger, graphql, etc.)
- **Shared:** Common utilities, errors, decorators

### Adding New Features

1. **Create Module:**

   ```
   src/modules/your-feature/
   ├── your-feature.controller.ts
   ├── your-feature.service.ts
   ├── your-feature.repository.ts
   └── your-feature.dto.ts
   ```

2. **Register Routes:**

   ```typescript
   // In app.ts
   import { yourFeatureRoutes } from "./modules/your-feature/your-feature.controller";
   await app.register(yourFeatureRoutes);
   ```

3. **Add Tests:**
   ```
   src/tests/
   ├── unit/modules/your-feature/
   └── integration/modules/your-feature/
   ```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

---

## 🗄️ Database Schema

### Core Entities

#### Tenants

- `id` (UUID, PK)
- `name` (string)
- `slug` (string, unique)
- `isActive` (boolean)
- `createdAt`, `updatedAt`

#### Users

- `id` (UUID, PK)
- `tenantId` (UUID, FK → Tenants)
- `email` (string, unique per tenant)
- `passwordHash` (string)
- `role` (enum: ops_admin, dispatcher, driver)
- `firstName`, `lastName`
- `isActive` (boolean)
- `createdAt`, `updatedAt`

#### Drivers

- `id` (UUID, PK)
- `tenantId` (UUID, FK → Tenants)
- `userId` (UUID, FK → Users, nullable)
- `name` (string)
- `phone` (string)
- `licenseNumber` (string)
- `isActive` (boolean)
- `createdAt`, `updatedAt`

#### Shipments

- `id` (UUID, PK)
- `tenantId` (UUID, FK → Tenants)
- `driverId` (UUID, FK → Drivers, nullable)
- `status` (enum: CREATED, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED)
- `pickupAddress` (text)
- `deliveryAddress` (text)
- `customerName` (string)
- `customerPhone` (string)
- `assignedAt`, `pickedUpAt`, `deliveredAt` (timestamps)
- `createdAt`, `updatedAt`

#### ShipmentStatusHistory

- `id` (UUID, PK)
- `shipmentId` (UUID, FK → Shipments)
- `status` (enum)
- `changedBy` (UUID, FK → Users, nullable)
- `changedAt` (timestamp)
- `metadata` (JSONB)

#### EventOutbox

- `id` (UUID, PK)
- `tenantId` (UUID, FK → Tenants)
- `eventType` (string)
- `aggregateId` (UUID)
- `payload` (JSONB)
- `status` (enum: PENDING, PROCESSED, FAILED, DEAD_LETTER)
- `processedAt` (timestamp, nullable)
- `retryCount` (integer)
- `errorMessage` (text, nullable)
- `createdAt`, `updatedAt`

#### DashboardSummary

- `tenantId` (UUID, PK)
- `totalShipments` (integer)
- `activeShipments` (integer)
- `deliveredToday` (integer)
- `driversOnline` (integer)
- `lastUpdated` (timestamp)

### Relationships

- **Tenant** → **Users** (1:N)
- **Tenant** → **Drivers** (1:N)
- **Tenant** → **Shipments** (1:N)
- **User** → **Driver** (1:1, optional)
- **Shipment** → **Driver** (N:1, optional)
- **Shipment** → **ShipmentStatusHistory** (1:N)

---

## 🔄 State Machine

### Shipment Status Flow

```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

### Valid Transitions

| From         | To           | Method                                 |
| ------------ | ------------ | -------------------------------------- |
| `CREATED`    | `ASSIGNED`   | `POST /v1/shipments/:id/assign-driver` |
| `ASSIGNED`   | `PICKED_UP`  | `POST /v1/shipments/:id/status`        |
| `PICKED_UP`  | `IN_TRANSIT` | `POST /v1/shipments/:id/status`        |
| `IN_TRANSIT` | `DELIVERED`  | `POST /v1/shipments/:id/status`        |

### Invalid Transitions

- ❌ Cannot go backwards
- ❌ Cannot skip states
- ❌ `DELIVERED` is terminal (no further transitions)

See `STATE_MACHINE.md` for complete details.

---

## 📡 Real-Time Features

### Socket.IO

**Connection:**

```javascript
const socket = io("http://localhost:3000", {
  auth: {
    token: "YOUR_JWT_TOKEN",
  },
});

// Join tenant room
socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

// Listen for driver location updates
socket.on("driver:location", (data) => {
  console.log("Driver location:", data);
});
```

**Events:**

- `driver:location` - Real-time driver location updates

### MQTT

**Topic Format:**

```
tenant/{tenantId}/driver/{driverId}/location
```

**Message Format:**

```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Publish Example:**

```bash
mosquitto_pub -h localhost -p 1883 \
  -t "tenant/TENANT_ID/driver/DRIVER_ID/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060}'
```

See `MQTT_SETUP.md` for details.

---

## 🔧 Troubleshooting

### Common Issues

#### "Database connection failed"

- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env`
- Check firewall: `sudo ufw status`

#### "Redis connection failed"

- Check Redis is running: `sudo systemctl status redis`
- Test connection: `redis-cli ping`
- Verify port in `.env`

#### "RabbitMQ connection failed"

- Check RabbitMQ is running: `sudo systemctl status rabbitmq-server`
- Verify credentials in `.env`
- Check management UI: http://localhost:15672

#### "Invalid state transition"

- Check current shipment status
- Follow valid state flow (see State Machine section)
- Use correct endpoint (`assign-driver` for CREATED → ASSIGNED)

#### "Authentication required" (GraphQL)

- Add `Authorization: Bearer TOKEN` header
- Verify token is valid (not expired)
- Check token format: `Bearer YOUR_TOKEN` (with space)

#### "Table does not exist"

- Run: `npm run db:init`
- Or use migrations: `npm run migration:run`

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm run dev

# Check logs
pm2 logs opscore-backend  # If using PM2
```

---

## ✅ Best Practices

### Code Style

- Use TypeScript strict mode
- Follow existing module structure
- Write tests for new features
- Use DTOs for request/response validation
- Handle errors with `AppError` class

### Security

- Never commit `.env` file
- Use strong JWT secrets (32+ characters)
- Validate all inputs via DTOs
- Use parameterized queries (TypeORM handles this)
- Implement rate limiting (already configured)

### Performance

- Use Redis for caching
- Implement pagination for large datasets
- Use database indexes (already configured)
- Monitor query performance
- Use connection pooling (already configured)

### Testing

- Write unit tests for business logic
- Write integration tests for APIs
- Test error cases
- Test state machine transitions
- Test multi-tenant isolation

---

## 📖 Additional Resources

### Documentation Files

- **`API_TESTING_GUIDE.md`** - Complete API testing guide
- **`LOGIN_GUIDE.md`** - Authentication guide
- **`STATE_MACHINE.md`** - State machine documentation
- **`MQTT_SETUP.md`** - MQTT configuration guide
- **`GRAPHQL_AUTH.md`** - GraphQL authentication guide

### External Links

- **Fastify Docs:** https://www.fastify.io/
- **TypeORM Docs:** https://typeorm.io/
- **Mercurius Docs:** https://mercurius.dev/
- **RabbitMQ Docs:** https://www.rabbitmq.com/documentation.html
- **Redis Docs:** https://redis.io/docs/

---

## 🆘 Getting Help

### Check Logs

```bash
# Development
npm run dev  # View console logs

# Production (PM2)
pm2 logs opscore-backend

# Production (Systemd)
sudo journalctl -u opscore -f
```

### Common Commands

```bash
# Start development
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Initialize database
npm run db:init

# Seed data
npm run seed

# Run migrations
npm run migration:run
```

---

## 📝 Quick Reference

### Test Credentials (After Seed)

- **Email:** `admin@tenant1.com`
- **Password:** `password123`
- **Tenant ID:** (from seed output)
- **Driver ID:** (from seed output)

### Important URLs

- **API:** http://localhost:3000
- **Swagger:** http://localhost:3000/docs
- **GraphQL:** http://localhost:3000/graphql
- **Health:** http://localhost:3000/health
- **RabbitMQ UI:** http://localhost:15672 (guest/guest)
- **EMQX Dashboard:** http://localhost:18083 (admin/public)

### Key Files

- **Main Entry:** `src/app.ts`
- **Config:** `src/config/index.ts`
- **Database:** `src/infra/db/data-source.ts`
- **State Machine:** `src/domain/stateMachines/shipment.state-machine.ts`
- **Error Handler:** `src/shared/errors/error-handler.ts`

---

**Last Updated:** 2024  
**Maintained By:** Development Team
