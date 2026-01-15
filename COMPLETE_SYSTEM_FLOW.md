# OpsCore - Complete System Flow Documentation

**Purpose**: Comprehensive guide to understand the entire OpsCore system flow for technical presentations and explanations.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Overview](#architecture-overview)
3. [Authentication Flow](#authentication-flow)
4. [Backend Request Flow](#backend-request-flow)
5. [Shipment Lifecycle](#shipment-lifecycle)
6. [Driver Location Tracking](#driver-location-tracking)
7. [Real-Time Updates](#real-time-updates)
8. [Frontend State Management](#frontend-state-management)
9. [Database Structure](#database-structure)
10. [API Endpoints Flow](#api-endpoints-flow)
11. [Key Features Explained](#key-features-explained)

---

## 🎯 System Overview

**OpsCore** is a real-time logistics management platform that enables:

- Multi-tenant shipment management
- Real-time driver location tracking
- State machine-based shipment lifecycle
- Event-driven architecture
- CQRS pattern for reads

### Core Technologies

**Backend:**

- Node.js + TypeScript
- Fastify (web framework)
- PostgreSQL (primary database)
- Redis (caching + real-time data)
- RabbitMQ (message queue)
- Socket.IO (real-time communication)
- MQTT (IoT device communication)

**Frontend:**

- Next.js 15 + React 19
- Redux Toolkit (state management)
- Socket.IO Client (real-time updates)
- React-Leaflet (maps)
- Tailwind CSS (styling)

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │────────▶│   Fastify   │────────▶│ PostgreSQL  │
│  (Frontend) │  HTTP   │   Backend   │         │  (Primary)  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ├──▶ Redis (Cache + Real-time data)
                              ├──▶ RabbitMQ (Events)
                              ├──▶ Socket.IO (WebSocket)
                              └──▶ MQTT (IoT devices)
```

### Module Organization (Backend)

Each module follows a clean architecture pattern:

```
modules/
├── auth/
│   ├── controllers/    # Request handlers
│   ├── routes/         # Route definitions
│   ├── schemas/        # Validation schemas
│   ├── services/       # Business logic
│   └── dto/            # Data transfer objects
├── shipments/
│   ├── controllers/
│   ├── routes/
│   ├── schemas/
│   ├── services/
│   ├── repositories/   # Data access layer
│   └── dto/
├── drivers/
│   └── [same structure]
└── dashboard/
    └── [same structure]
```

---

## 🔐 Authentication Flow

### Step-by-Step Flow

```
1. User submits login form (Frontend)
   ↓
2. POST /v1/auth/login
   Body: { email, password, tenantId }
   ↓
3. AuthService.login()
   - Validates tenant exists
   - Finds user by email + tenantId
   - Compares password hash (bcrypt)
   ↓
4. If valid:
   - Generates JWT token (contains: userId, tenantId, role)
   - Returns: { success: true, token, user: {...} }
   ↓
5. Frontend stores token in localStorage
   - Format: { id, email, role, tenantId, token }
   ↓
6. All subsequent requests include:
   Header: Authorization: Bearer <token>
   ↓
7. Backend validates token on every request:
   - authPlugin.authenticate() hook
   - Verifies JWT signature
   - Extracts user info
   - Attaches to request object
```

### JWT Token Structure

```json
{
  "userId": "user-123",
  "tenantId": "tenant-1",
  "role": "ops_admin",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Authentication Middleware

**Location**: `backend/src/plugins/auth.ts`

- Runs on `preHandler` hook for protected routes
- Extracts token from `Authorization` header
- Verifies JWT signature
- Attaches user to `request.user`
- Throws `UNAUTHORIZED` error if invalid

---

## 🔄 Backend Request Flow

### Complete Request Journey

```
1. HTTP Request arrives
   ↓
2. Fastify receives request
   ↓
3. CORS middleware (if needed)
   ↓
4. Rate limiting check
   ↓
5. Authentication (if route protected)
   - authPlugin.authenticate()
   - Validates JWT token
   ↓
6. Idempotency check (if POST/PUT/DELETE)
   - Checks Redis for Idempotency-Key
   - Returns cached response if found
   ↓
7. Route handler execution
   - Routes defined in: modules/*/routes/*.routes.ts
   - Handler in: modules/*/controllers/*.controller.ts
   ↓
8. Schema validation
   - Fastify validates request against schema
   - Defined in: modules/*/schemas/*.schema.ts
   ↓
9. Service layer
   - Business logic in: modules/*/services/*.service.ts
   - May call repositories for data access
   ↓
10. Repository layer (if needed)
    - Data access in: modules/*/repositories/*.repository.ts
    - TypeORM queries to PostgreSQL
    ↓
11. Response sent back
    - Success: { success: true, data: {...} }
    - Error: { success: false, error_code: "...", message: "..." }
```

### Example: Creating a Shipment

```
POST /v1/shipments
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-key-123
Body: { pickupAddress, deliveryAddress, customerName, customerPhone }

Flow:
1. Authentication validates token → extracts tenantId
2. Idempotency check → Redis lookup for "unique-key-123"
3. If not found, proceed:
   a. ShipmentService.createShipment()
   b. Validates input
   c. Creates shipment with status: CREATED
   d. Creates status history record
   e. Publishes event to RabbitMQ
   f. Stores idempotency key in Redis (5 min TTL)
   g. Returns shipment
4. If found in Redis → return cached response
```

---

## 📦 Shipment Lifecycle

### State Machine

**Valid States:**

- `CREATED` → Initial state
- `ASSIGNED` → Driver assigned
- `PICKED_UP` → Driver picked up shipment
- `IN_TRANSIT` → On the way to delivery
- `DELIVERED` → Successfully delivered

**Valid Transitions:**

```
CREATED → ASSIGNED
ASSIGNED → PICKED_UP
PICKED_UP → IN_TRANSIT
IN_TRANSIT → DELIVERED
```

**Invalid transitions throw error**: `INVALID_SHIPMENT_STATE`

### Shipment Flow Example

```
1. Create Shipment
   POST /v1/shipments
   → Status: CREATED
   → Creates status history
   → Publishes ShipmentEventType.CREATED

2. Assign Driver
   POST /v1/shipments/{id}/assign-driver
   Body: { driverId }
   → Validates: CREATED → ASSIGNED transition
   → Updates shipment.driverId
   → Sets shipment.assignedAt
   → Status: ASSIGNED
   → Publishes ShipmentEventType.ASSIGNED
   → Emits Socket.IO: shipment-status-update

3. Mark as Picked Up
   POST /v1/shipments/{id}/status
   Body: { status: "PICKED_UP" }
   → Validates: ASSIGNED → PICKED_UP transition
   → Sets shipment.pickedUpAt
   → Status: PICKED_UP
   → Publishes ShipmentEventType.PICKED_UP
   → Emits Socket.IO: shipment-status-update

4. Mark as In Transit
   POST /v1/shipments/{id}/status
   Body: { status: "IN_TRANSIT" }
   → Validates: PICKED_UP → IN_TRANSIT transition
   → Status: IN_TRANSIT
   → Publishes ShipmentEventType.IN_TRANSIT
   → Emits Socket.IO: shipment-status-update

5. Mark as Delivered
   POST /v1/shipments/{id}/status
   Body: { status: "DELIVERED" }
   → Validates: IN_TRANSIT → DELIVERED transition
   → Sets shipment.deliveredAt
   → Status: DELIVERED
   → Publishes ShipmentEventType.DELIVERED
   → Emits Socket.IO: shipment-status-update
```

### State Machine Validation

**Location**: `backend/src/domain/stateMachines/shipment.state-machine.ts`

```typescript
VALID_TRANSITIONS = {
  CREATED: ['ASSIGNED'],
  ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [] // Terminal state
}

validateTransition(currentStatus, newStatus) {
  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw AppError(INVALID_SHIPMENT_STATE, ...)
  }
}
```

---

## 🚗 Driver Location Tracking

### Three Input Sources

#### 1. REST API (Web Interface)

```
Driver opens /driver-location page
↓
Browser geolocation API gets GPS coordinates
↓
POST /v1/drivers/{driverId}/location
Body: { latitude, longitude, timestamp }
↓
LocationProcessorService.processLocation()
↓
- Validates driver exists and belongs to tenant
- Validates coordinates (range checks)
- Stores in Redis: driver:{tenantId}:{driverId}:location
  TTL: 1 hour
- Emits Socket.IO: driver-location-update
```

#### 2. MQTT (IoT Devices)

```
IoT device publishes to MQTT broker
Topic: tenant/{tenantId}/driver/{driverId}/location
Payload: { latitude, longitude, timestamp }
↓
MQTTSubscriber receives message
↓
LocationProcessorService.processLocation()
↓
Same flow as REST API
```

#### 3. Frontend Web Interface

**Component**: `frontend/src/components/drivers/driver-location-share.component.jsx`

```
1. User clicks "Start Sharing Location"
2. navigator.geolocation.watchPosition() starts
3. On each position update:
   - Gets coordinates
   - Calls driversService.updateLocation()
   - Sends to backend REST API
4. Backend processes and broadcasts via Socket.IO
```

### Location Storage

**Redis Key Format**: `driver:{tenantId}:{driverId}:location`

**Value Structure**:

```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "REST" | "MQTT"
}
```

**TTL**: 3600 seconds (1 hour)

---

## ⚡ Real-Time Updates

### Socket.IO Architecture

#### Backend Setup

**Location**: `backend/src/plugins/socket.ts`

```
1. Socket.IO server initialized
2. Redis adapter configured (for multi-server support)
3. Authentication middleware:
   - Validates JWT token from handshake
   - Extracts tenantId
   - Joins room: tenant:{tenantId}
4. Events emitted:
   - driver-location-update
   - shipment-status-update
```

#### Frontend Connection

**Location**: `frontend/src/common/hooks/use-socket.hook.js`

```
1. Single global Socket.IO instance
2. Connects on first use
3. Authentication: token in handshake
4. Joins room: tenant:{tenantId}
5. Listens for events:
   - driver-location-update → Updates Redux state
   - shipment-status-update → Updates Redux state
6. Automatic reconnection on disconnect
```

### Event Flow

#### Driver Location Update

```
Backend:
LocationProcessorService.processLocation()
↓
Stores in Redis
↓
fastify.io.to(`tenant:${tenantId}`).emit('driver-location-update', {
  driverId: 'driver-123',
  location: { latitude, longitude, timestamp },
  source: 'REST' | 'MQTT'
})
↓
Frontend:
useSocket hook receives event
↓
Dispatches Redux action: updateDriverLocation
↓
Redux state updated: drivers.locations[driverId] = location
↓
React components re-render
↓
Maps update markers in real-time
```

#### Shipment Status Update

```
Backend:
ShipmentService.updateStatus()
↓
Validates state transition
↓
Updates database
↓
fastify.io.to(`tenant:${tenantId}`).emit('shipment-status-update', {
  shipmentId: 'shipment-123',
  newStatus: 'ASSIGNED',
  driverId: 'driver-123'
})
↓
Frontend:
useSocket hook receives event
↓
Dispatches Redux action (if needed)
↓
UI updates automatically
```

---

## 🎨 Frontend State Management

### Redux Store Structure

```javascript
{
  auth: {
    login: {
      isLoading: false,
      isSuccess: false,
      isError: false,
      data: { user: {...}, token: "..." }
    }
  },
  shipments: {
    list: [...],
    current: {...},
    isLoading: false
  },
  drivers: {
    list: [...],
    current: {...},
    locations: {
      "driver-1": { latitude, longitude, timestamp },
      "driver-2": { latitude, longitude, timestamp }
    },
    isLoading: false
  },
  dashboard: {
    summary: {
      totalShipments: 100,
      activeShipments: 25,
      deliveredToday: 10,
      driversOnline: 5
    },
    isLoading: false
  }
}
```

### Data Flow Example: Loading Shipments

```
1. Component dispatches action
   dispatch(getAllShipments())
   ↓
2. Redux Thunk executes
   - Calls shipmentsService.getAllShipments()
   - Makes API call: GET /v1/shipments
   ↓
3. API response received
   { success: true, data: [...] }
   ↓
4. Redux reducer updates state
   shipments.list = response.data
   shipments.isLoading = false
   ↓
5. Component re-renders
   - useSelector reads updated state
   - UI displays shipments
```

### Real-Time State Updates

```
Socket.IO event received
↓
useSocket hook dispatches action
↓
Redux reducer updates state
↓
useSelector in component detects change
↓
Component re-renders
↓
Map markers update (via React-Leaflet)
```

---

## 🗄️ Database Structure

### Core Entities

#### Tenant

```typescript
{
  id: UUID(PK);
  name: string;
  isActive: boolean;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

#### User

```typescript
{
  id: UUID (PK)
  tenantId: UUID (FK → Tenant)
  email: string (unique per tenant)
  passwordHash: string
  role: enum ('ops_admin', 'driver')
  firstName: string
  lastName: string
  isActive: boolean
}
```

#### Driver

```typescript
{
  id: UUID (PK)
  tenantId: UUID (FK → Tenant)
  userId: UUID (FK → User, nullable)
  name: string
  phone: string
  licenseNumber: string
  isActive: boolean
}
```

#### Shipment

```typescript
{
  id: UUID (PK)
  tenantId: UUID (FK → Tenant)
  driverId: UUID (FK → Driver, nullable)
  status: enum ('CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED')
  pickupAddress: text
  deliveryAddress: text
  customerName: string
  customerPhone: string
  assignedAt: timestamp (nullable)
  pickedUpAt: timestamp (nullable)
  deliveredAt: timestamp (nullable)
}
```

#### ShipmentStatusHistory

```typescript
{
  id: UUID (PK)
  shipmentId: UUID (FK → Shipment)
  status: enum
  changedBy: UUID (FK → User)
  changedAt: timestamp
  metadata: JSON (nullable)
}
```

### Relationships

```
Tenant (1) ──< (N) User
Tenant (1) ──< (N) Driver
Tenant (1) ──< (N) Shipment
User (1) ──< (0..1) Driver
Driver (1) ──< (N) Shipment
Shipment (1) ──< (N) ShipmentStatusHistory
```

---

## 🌐 API Endpoints Flow

### Authentication

```
POST /v1/auth/login
Body: { email, password, tenantId }
Response: { success: true, token, user: {...} }
```

### Shipments

```
GET /v1/shipments
Query: ?status=ASSIGNED (optional)
Headers: Authorization: Bearer <token>
Response: { success: true, data: [shipments] }

GET /v1/shipments/:id
Headers: Authorization: Bearer <token>
Response: { success: true, data: shipment }

POST /v1/shipments
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-key
Body: { pickupAddress, deliveryAddress, customerName, customerPhone }
Response: { success: true, data: shipment }

POST /v1/shipments/:id/assign-driver
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-key
Body: { driverId }
Response: { success: true, data: shipment }

POST /v1/shipments/:id/status
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: unique-key
Body: { status: "PICKED_UP" }
Response: { success: true, data: shipment }
```

### Drivers

```
GET /v1/drivers
Headers: Authorization: Bearer <token>
Response: { success: true, data: [drivers with locations] }

GET /v1/drivers/:id
Headers: Authorization: Bearer <token>
Response: { success: true, data: driver with location }

POST /v1/drivers/:id/location
Headers: Authorization: Bearer <token>
Body: { latitude, longitude, timestamp }
Response: { success: true, message: "Location updated successfully" }
```

### Dashboard

```
GET /v1/dashboard/summary
Headers: Authorization: Bearer <token>
Response: {
  success: true,
  data: {
    totalShipments: 100,
    activeShipments: 25,
    deliveredToday: 10,
    driversOnline: 5
  }
}
```

---

## 🔑 Key Features Explained

### 1. Multi-Tenant Architecture

**How it works:**

- Every request includes JWT token with `tenantId`
- All database queries filter by `tenantId`
- Users can only access their tenant's data
- Complete data isolation between tenants

**Implementation:**

- `getTenantId()` decorator extracts tenantId from JWT
- All repositories filter by tenantId
- Socket.IO rooms: `tenant:{tenantId}`

### 2. Idempotency

**Purpose**: Prevent duplicate operations on retries

**How it works:**

```
1. Client sends request with Idempotency-Key header
2. Backend checks Redis: idempotency:{key}
3. If found → return cached response
4. If not found:
   - Process request
   - Store response in Redis (5 min TTL)
   - Return response
```

**Key**: `idempotency:{Idempotency-Key}`
**TTL**: 300 seconds (5 minutes)

### 3. Event-Driven Architecture

**RabbitMQ Events:**

- Shipment created/assigned/status changed
- Events stored in `event_outbox` table (transactional)
- Background process publishes to RabbitMQ
- Ensures at-least-once delivery

**Event Types:**

- `shipment.created`
- `shipment.assigned`
- `shipment.picked_up`
- `shipment.in_transit`
- `shipment.delivered`

### 4. CQRS Pattern

**Read Model**: Dashboard summary

- Aggregated data stored in `dashboard_summary` table
- Updated on shipment/driver changes
- Fast reads without complex queries

**Write Model**: Shipments, Drivers

- Normalized tables
- Transactional updates
- Event publishing

### 5. Real-Time Location Tracking

**Three Layers:**

1. **Input**: REST API, MQTT, Web Geolocation
2. **Storage**: Redis (fast, TTL-based)
3. **Broadcast**: Socket.IO (real-time to frontend)

**Why Redis?**

- Fast reads (sub-millisecond)
- TTL automatically removes stale data
- No database load for frequent reads

### 6. State Machine

**Benefits:**

- Prevents invalid state transitions
- Clear business rules
- Audit trail via status history
- Type-safe status values

**Validation:**

- Every status change validated
- Throws error if invalid transition
- Status history records all changes

---

## 📊 Complete Data Flow Diagram

### Creating and Tracking a Shipment

```
┌──────────┐
│  Admin   │
│ (Frontend)│
└────┬─────┘
     │ 1. Create Shipment
     ▼
┌─────────────────┐
│ POST /shipments │
│ + JWT Token     │
│ + Idempotency   │
└────┬────────────┘
     │
     ▼
┌──────────────────┐
│ Auth Middleware  │──▶ Validates JWT, extracts tenantId
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ Idempotency Check│──▶ Redis lookup
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ ShipmentService  │──▶ Creates shipment (status: CREATED)
└────┬─────────────┘
     │
     ├──▶ PostgreSQL: Insert shipment
     ├──▶ PostgreSQL: Insert status history
     ├──▶ RabbitMQ: Publish event
     └──▶ Redis: Store idempotency response
     │
     ▼
┌──────────────────┐
│ Response to Admin│
└──────────────────┘

┌──────────┐
│  Admin   │
│ (Frontend)│
└────┬─────┘
     │ 2. Assign Driver
     ▼
┌──────────────────────┐
│ POST /assign-driver  │
└────┬─────────────────┘
     │
     ▼
┌──────────────────┐
│ ShipmentService  │──▶ Validates: CREATED → ASSIGNED
└────┬─────────────┘
     │
     ├──▶ PostgreSQL: Update shipment
     ├──▶ PostgreSQL: Insert status history
     ├──▶ RabbitMQ: Publish event
     └──▶ Socket.IO: Emit to tenant room
     │
     ▼
┌──────────────────┐
│ Frontend receives│──▶ Updates UI in real-time
│ Socket.IO event  │
└──────────────────┘

┌──────────┐
│  Driver  │
│ (Frontend)│
└────┬─────┘
     │ 3. Share Location
     ▼
┌──────────────────────┐
│ Browser Geolocation  │──▶ Gets GPS coordinates
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ POST /drivers/:id/   │
│ location             │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ LocationProcessor    │──▶ Validates driver, coordinates
└────┬─────────────────┘
     │
     ├──▶ Redis: Store location (TTL: 1 hour)
     └──▶ Socket.IO: Emit to tenant room
     │
     ▼
┌──────────────────┐
│ Admin Dashboard  │──▶ Map updates in real-time
│ receives update  │
└──────────────────┘
```

---

## 🎓 Key Concepts Summary

### 1. **Tenant Isolation**

Every operation is scoped to a tenant. Users can only access their tenant's data.

### 2. **State Machine**

Shipments follow strict state transitions. Invalid transitions are rejected.

### 3. **Idempotency**

Duplicate requests with same Idempotency-Key return cached response.

### 4. **Real-Time Updates**

Socket.IO broadcasts changes instantly to all connected clients in the tenant.

### 5. **Multi-Source Location**

Driver locations can come from REST API, MQTT, or web browser geolocation.

### 6. **Event-Driven**

All state changes publish events to RabbitMQ for downstream processing.

### 7. **CQRS**

Dashboard uses read-optimized model for fast aggregations.

### 8. **Clean Architecture**

Backend modules organized by concern (controllers, services, repositories).

---

## 📝 Quick Reference

### Important Files

**Backend:**

- `src/app.ts` - Application entry point
- `src/plugins/auth.ts` - Authentication middleware
- `src/plugins/socket.ts` - Socket.IO setup
- `src/domain/stateMachines/shipment.state-machine.ts` - State machine
- `src/modules/*/routes/*.routes.ts` - Route definitions
- `src/modules/*/controllers/*.controller.ts` - Request handlers
- `src/modules/*/services/*.service.ts` - Business logic

**Frontend:**

- `src/common/hooks/use-socket.hook.js` - Socket.IO connection
- `src/common/utils/api.js` - Axios instance with interceptors
- `src/provider/store.js` - Redux store
- `src/provider/features/*/` - Redux slices

### Common Error Codes

- `UNAUTHORIZED` - Invalid or missing JWT token
- `INVALID_SHIPMENT_STATE` - Invalid state transition
- `SHIPMENT_NOT_FOUND` - Shipment doesn't exist
- `DRIVER_NOT_FOUND` - Driver doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `IDEMPOTENCY_KEY_REQUIRED` - Missing Idempotency-Key header

---

## 🚀 Deployment Flow

### Backend

1. Code runs locally
2. Connects to remote services via `.env`:
   - PostgreSQL (Ubuntu server)
   - Redis (Ubuntu server)
   - RabbitMQ (Ubuntu server)
   - MQTT (Ubuntu server)
3. No code deployment on server

### Frontend

1. Build: `npm run build`
2. Start: `npm run start`
3. Connects to backend via `NEXT_PUBLIC_MAIN_URL`

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**For**: Technical presentations and senior developer explanations
