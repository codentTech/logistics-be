# OpsCore Reference Backend Slice

Production-grade reference implementation demonstrating real-time logistics backend capabilities.

## 📘 Documentation

**👉 [Complete Developer Guide](DEVELOPER_GUIDE.md)** - Start here for comprehensive documentation

**Quick Links:**
- [API Testing Guide](API_TESTING_GUIDE.md) - How to test all APIs
- [Login Guide](LOGIN_GUIDE.md) - Authentication instructions
- [State Machine](STATE_MACHINE.md) - Shipment state transitions
- [MQTT Setup](MQTT_SETUP.md) - MQTT configuration
- [GraphQL Auth](GRAPHQL_AUTH.md) - GraphQL authentication

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- **Access to Ubuntu Server** with:
  - PostgreSQL 15+ (running on server)
  - Redis 7+ (running on server)
  - RabbitMQ 3.12+ (running on server)
  - MQTT Broker (EMQX) - optional

### Setup

1. **Clone and install dependencies**
```bash
npm install
```

2. **Configure environment variables**

**Important:** All services (PostgreSQL, Redis, RabbitMQ) run on Ubuntu server. You'll connect to them via connection strings.
```bash
cp .env.example .env
```

Edit `.env` with connection strings to your Ubuntu server:

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
REDIS_PASSWORD=your_redis_password

# RabbitMQ (on Ubuntu server)
RABBITMQ_URL=amqp://your-server-ip-or-domain:5672
RABBITMQ_USER=your_rabbitmq_user
RABBITMQ_PASSWORD=your_rabbitmq_password

# MQTT (on Ubuntu server, optional)
MQTT_BROKER_URL=mqtt://your-server-ip-or-domain:1883
```

**Get connection details from your DevOps team or server administrator.**

3. **Initialize database and seed data**
```bash
# The app will auto-sync schema in development mode
# Or run migrations in production:
# npm run migration:run

# Seed initial data (tenant, users, drivers, sample shipments)
npm run seed
```

**Note:** After running seed, copy the `Tenant ID` from the output - you'll need it for login.

4. **Start the server**
```bash
npm run dev
```

Server runs on `http://localhost:3000`

5. **Access Swagger UI**
```
http://localhost:3000/docs
```

6. **Access GraphQL Playground (Development)**
```
http://localhost:3000/graphql
```

## Demo Flow

### 1. Authentication

**Login as Ops Admin**
```bash
POST /v1/auth/login
{
  "email": "admin@tenant1.com",
  "password": "password123",
  "tenantId": "tenant-1"
}
```

Response includes JWT token. Use this token in `Authorization: Bearer <token>` header for subsequent requests.

### 2. Create Shipment

**Create a new shipment**
```bash
POST /v1/shipments
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-request-id-1
Body:
{
  "pickupAddress": "123 Main St, City",
  "deliveryAddress": "456 Oak Ave, City",
  "customerName": "John Doe",
  "customerPhone": "+1234567890"
}
```

Returns shipment with status `CREATED`.

### 3. Assign Driver

**Assign driver to shipment**
```bash
POST /v1/shipments/{shipmentId}/assign-driver
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-request-id-2
Body:
{
  "driverId": "driver-123"
}
```

Shipment status transitions to `ASSIGNED`.

### 4. Update Shipment Status

**Mark shipment as picked up**
```bash
POST /v1/shipments/{shipmentId}/status
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-request-id-3
Body:
{
  "status": "PICKED_UP"
}
```

**Continue state transitions:**
- `PICKED_UP` → `IN_TRANSIT`
- `IN_TRANSIT` → `DELIVERED`

### 5. Update Driver Location (Real-Time)

**Option A: Via REST API**
```bash
POST /v1/drivers/{driverId}/location
Headers:
  Authorization: Bearer <token>
Body:
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Option B: Via MQTT**
```bash
# Publish to MQTT topic
Topic: tenant/{tenantId}/driver/{driverId}/location
Payload:
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Both sources store location in Redis with TTL and broadcast via Socket.IO to connected clients.

### 6. Dashboard Summary (CQRS Read)

**Get operational summary**
```bash
GET /v1/dashboard/summary
Headers:
  Authorization: Bearer <token>
```

Returns aggregated metrics from CQRS read model.

### 7. GraphQL Dashboard

**Query shipment dashboard**
```graphql
query ShipmentDashboard {
  shipments(status: IN_TRANSIT) {
    id
    status
    driver {
      id
      name
      currentLocation {
        latitude
        longitude
        lastUpdated
      }
    }
    pickupAddress
    deliveryAddress
  }
}
```

**Query ops summary**
```graphql
query OpsSummary {
  summary {
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
  }
}
```

### 8. Real-Time Updates (Socket.IO)

Connect to Socket.IO endpoint:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: '<jwt-token>' // Get from login endpoint
  }
});

// Listen for driver location updates
socket.on('driver:location', (data) => {
  console.log('Driver location:', data);
  // {
  //   driverId: 'driver-123',
  //   latitude: 40.7128,
  //   longitude: -74.0060,
  //   timestamp: '2024-01-15T10:30:00Z',
  //   source: 'REST' or 'MQTT'
  // }
});

// Listen for shipment status changes
socket.on('shipment:status', (data) => {
  console.log('Shipment status:', data);
});
```

### 9. GraphQL Queries

**Shipment Dashboard:**
```graphql
query ShipmentDashboard {
  shipmentDashboard(status: IN_TRANSIT) {
    id
    status
    pickupAddress
    deliveryAddress
    driver {
      id
      name
      currentLocation {
        latitude
        longitude
        timestamp
        source
      }
    }
  }
}
```

**Ops Summary:**
```graphql
query OpsSummary {
  opsSummary {
    tenantId
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
    lastUpdated
  }
}
```

**Note:** GraphQL requires authentication. Include JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Testing with Postman

1. **Import Collection**
   - Open Postman
   - Click Import
   - Select `postman_collection.json`

2. **Set Variables**
   - After importing, the collection will have default variables
   - After running seed script, update `tenantId` variable with the tenant ID from seed output

3. **Run Demo Flow**
   - Start with "Login - Ops Admin" request
   - Token will be automatically saved
   - Continue with other requests in order

4. **Test Idempotency**
   - Run "Create Shipment" twice with the same `Idempotency-Key`
   - Second request should return cached response instantly

## Architecture

```
src/
├── app.ts                 # Main application entry
├── config/                # Configuration management
├── plugins/               # Fastify plugins (auth, swagger, redis, socket)
├── modules/               # Feature modules
│   ├── auth/             # Authentication
│   ├── tenants/          # Tenant management
│   ├── drivers/          # Driver operations
│   ├── shipments/        # Shipment lifecycle
│   └── dashboard/        # Dashboard/CQRS reads
├── domain/                # Domain logic
│   ├── stateMachines/    # State machine definitions
│   └── events/           # Event definitions
├── infra/                 # Infrastructure
│   ├── db/               # Database client/migrations
│   ├── redis/            # Redis client
│   └── queues/           # Queue stubs
├── graphql/               # GraphQL schema & resolvers
└── tests/                 # Test suites
```

## Key Features Demonstrated

- ✅ Versioned REST APIs (`/v1/*`)
- ✅ Tenant isolation
- ✅ Idempotent commands (Idempotency-Key header)
- ✅ State machine with validation
- ✅ Redis-backed real-time location tracking
- ✅ Socket.IO for live updates
- ✅ GraphQL for complex reads (CQRS)
- ✅ Swagger/OpenAPI documentation
- ✅ Postman collection

## Development

```bash
# Development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Database migrations
npm run migration:generate -- -n MigrationName
npm run migration:run
npm run migration:revert

# Seed database
npm run seed

# Lint code
npm run lint
npm run lint:fix

# Type check
npm run typecheck
```

## API Endpoints Summary

### Authentication
- `POST /v1/auth/login` - Login and get JWT token

### Shipments
- `POST /v1/shipments` - Create shipment (idempotent)
- `POST /v1/shipments/:id/assign-driver` - Assign driver (idempotent)
- `POST /v1/shipments/:id/status` - Update status (state machine, idempotent)

### Drivers
- `POST /v1/drivers/:id/location` - Update driver location (REST)

### Dashboard
- `GET /v1/dashboard/summary` - Get operational summary (CQRS read)

### GraphQL
- `POST /graphql` - GraphQL endpoint
- `GET /graphql` - GraphiQL playground (development)

### System
- `GET /health` - Health check endpoint

## Key Features

✅ **Multi-Tenant Architecture** - Complete tenant isolation  
✅ **State Machine** - Shipment lifecycle with strict validation  
✅ **Idempotency** - Redis-backed duplicate request prevention  
✅ **Dual Input** - REST API + MQTT for driver locations  
✅ **Event-Driven** - RabbitMQ with transactional outbox pattern  
✅ **Real-Time** - Socket.IO for live updates  
✅ **CQRS** - Dashboard read models for performance  
✅ **GraphQL** - Complex queries with Mercurius  
✅ **Retry Mechanisms** - Exponential backoff for resilience  
✅ **Circuit Breaker** - Failure tolerance patterns  
✅ **Health Checks** - Service monitoring  

## Error Response Format

All errors follow this unified format:

```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "Human readable error message"
}
```

Common error codes:
- `INVALID_SHIPMENT_STATE` - Invalid state transition
- `TENANT_NOT_FOUND` - Tenant doesn't exist
- `DRIVER_NOT_FOUND` - Driver doesn't exist
- `UNAUTHORIZED` - Invalid or missing token
- `IDEMPOTENCY_KEY_REQUIRED` - Idempotency key missing
- `VALIDATION_ERROR` - Request validation failed

## License

Proprietary - All rights reserved

