# Comprehensive Test Guide - OpsCore

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Data Setup](#test-data-setup)
3. [Admin Side Testing](#admin-side-testing)
4. [Driver Side Testing](#driver-side-testing)
5. [Customer Side Testing](#customer-side-testing)
6. [Multi-Tenant Testing](#multi-tenant-testing)
7. [Status Transition Testing](#status-transition-testing)
8. [Route Simulation Testing](#route-simulation-testing)
9. [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)
10. [API Testing Checklist](#api-testing-checklist)

---

## Prerequisites

### 1. Start Services

```bash
# Start database (PostgreSQL)
# Make sure PostgreSQL is running on port 5432

# Start Redis
redis-server
# OR
docker run -d -p 6379:6379 redis:alpine

# Start backend
cd backend
npm install
npm run dev
# Server should start on http://localhost:3000

# Start frontend (optional, for UI testing)
cd frontend
npm install
npm run dev
# Frontend should start on http://localhost:3001
```

### 2. Initialize Database

```bash
cd backend

# Initialize database schema
npm run db:init

# Seed test data
npm run seed:complete
```

### 3. Test Tools

- **Postman** or **Insomnia** for API testing
- **Browser** for frontend testing
- **WebSocket Client** (optional) for Socket.IO testing

---

## Test Data Setup

### Seeded Users (from seed-complete.ts)

#### Tenant 1 (Acme Corp)

- **Admin**: `admin1@acme.com` / `password123`
- **Driver**: `driver1@acme.com` / `password123`
- **Customer**: `customer1@acme.com` / `password123`

#### Tenant 2 (Tech Solutions)

- **Admin**: `admin2@tech.com` / `password123`
- **Driver**: `driver2@tech.com` / `password123`
- **Customer**: `customer2@tech.com` / `password123`

### Test Shipments

The seeder creates shipments in various statuses:

- `CREATED` - No driver assigned
- `ASSIGNED` - Driver assigned, not started
- `IN_TRANSIT` - Driver en route
- `DELIVERED` - Completed
- `CANCEL_BY_CUSTOMER` - Cancelled by customer
- `CANCEL_BY_DRIVER` - Cancelled by driver

---

## Admin Side Testing

### Test 1: Login as Admin

**Endpoint**: `POST /v1/auth/login`

**Request**:

```json
{
  "email": "admin1@acme.com",
  "password": "password123"
}
```

**Expected Response**:

```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "admin1@acme.com",
    "role": "ops_admin",
    "tenantId": "tenant-1-id"
  }
}
```

**✅ Verify**:

- Status code: 200
- Token is returned
- User role is `ops_admin`
- Tenant ID is correct

---

### Test 2: Create Shipment

**Endpoint**: `POST /v1/shipments`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "pickupAddress": "123 Main St, New York, NY 10001",
  "deliveryAddress": "456 Broadway, New York, NY 10013",
  "customerName": "John Doe",
  "customerPhone": "+1234567890"
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CREATED",
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Broadway, New York, NY 10013",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "driverId": null,
    "tenantId": "..."
  }
}
```

**✅ Verify**:

- Status code: 200
- Status is `CREATED`
- No driver assigned (`driverId: null`)
- Tenant ID matches admin's tenant

---

### Test 3: Get All Shipments

**Endpoint**: `GET /v1/shipments`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**Expected Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "status": "CREATED",
      ...
    },
    ...
  ]
}
```

**✅ Verify**:

- Status code: 200
- Returns array of shipments
- All shipments belong to admin's tenant
- Can see shipments in all statuses

---

### Test 4: Get Shipment by ID

**Endpoint**: `GET /v1/shipments/:id`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**✅ Verify**:

- Status code: 200
- Returns shipment details
- Can access any shipment in their tenant

---

### Test 5: Assign Driver to Shipment

**Endpoint**: `POST /v1/shipments/:id/assign-driver`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "driverId": "<driver-id>"
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "ASSIGNED",
    "driverId": "<driver-id>",
    "assignedAt": "2024-01-14T..."
  }
}
```

**✅ Verify**:

- Status code: 200
- Status changes to `ASSIGNED`
- `driverId` is set
- `assignedAt` timestamp is set

---

### Test 6: Prevent Driver Reassignment

**Scenario**: Try to assign a different driver to an already assigned shipment

**Endpoint**: `POST /v1/shipments/:id/assign-driver`

**Request**:

```json
{
  "driverId": "<different-driver-id>"
}
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot reassign driver. Shipment is already assigned and not cancelled."
}
```

**✅ Verify**:

- Status code: 400
- Error message indicates reassignment not allowed
- Shipment status remains `ASSIGNED`
- Original driver ID unchanged

---

### Test 7: Update Shipment Status (Admin)

**Endpoint**: `PATCH /v1/shipments/:id/status`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "status": "IN_TRANSIT"
}
```

**✅ Verify**:

- Status code: 200
- Status updates successfully
- Admin can update to any valid status

---

### Test 8: Get All Drivers

**Endpoint**: `GET /v1/drivers`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**✅ Verify**:

- Status code: 200
- Returns array of drivers
- All drivers belong to admin's tenant

---

### Test 9: Get Driver by ID

**Endpoint**: `GET /v1/drivers/:id`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**✅ Verify**:

- Status code: 200
- Returns driver details
- Can see driver location if available

---

### Test 10: Dashboard Summary

**Endpoint**: `GET /v1/dashboard/summary`

**Headers**:

```
Authorization: Bearer <admin-token>
x-tenant-id: <tenant-id>
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "totalShipments": 10,
    "activeDrivers": 3,
    "pendingShipments": 2,
    "inTransitShipments": 1,
    "deliveredShipments": 5
  }
}
```

**✅ Verify**:

- Status code: 200
- Returns summary statistics
- All counts are for admin's tenant only

---

### Test 11: Access Other Tenant Data (Should Fail)

**Scenario**: Try to access shipment from different tenant

**Endpoint**: `GET /v1/shipments/:other-tenant-shipment-id`

**Headers**:

```
Authorization: Bearer <admin-tenant1-token>
x-tenant-id: <tenant-1-id>
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Shipment not found"
}
```

**✅ Verify**:

- Status code: 404 or 403
- Cannot access other tenant's data
- Tenant isolation enforced

---

## Driver Side Testing

### Test 12: Login as Driver

**Endpoint**: `POST /v1/auth/login`

**Request**:

```json
{
  "email": "driver1@acme.com",
  "password": "password123"
}
```

**✅ Verify**:

- Status code: 200
- Token is returned
- User role is `driver`
- Tenant ID is correct

---

### Test 13: Get Assigned Shipments Only

**Endpoint**: `GET /v1/shipments`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**✅ Verify**:

- Status code: 200
- Returns only shipments assigned to this driver
- Cannot see unassigned shipments
- Cannot see other drivers' shipments

---

### Test 14: Get Assigned Shipment by ID

**Endpoint**: `GET /v1/shipments/:assigned-shipment-id`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**✅ Verify**:

- Status code: 200
- Can access own assigned shipment
- Returns shipment details

---

### Test 15: Cannot Access Other Driver's Shipment

**Endpoint**: `GET /v1/shipments/:other-driver-shipment-id`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "FORBIDDEN",
  "message": "You can only access shipments assigned to you"
}
```

**✅ Verify**:

- Status code: 403
- Error message indicates access denied
- Cannot see other driver's shipments

---

### Test 16: Update Driver Location

**Endpoint**: `POST /v1/drivers/location`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "latitude": 40.7128,
  "longitude": -74.006
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "latitude": 40.7128,
    "longitude": -74.006,
    "lastLocationUpdate": "2024-01-14T..."
  }
}
```

**✅ Verify**:

- Status code: 200
- Location is updated
- `lastLocationUpdate` timestamp is set
- Location appears on map (if using frontend)

---

### Test 17: Update Status to IN_TRANSIT

**Endpoint**: `PATCH /v1/shipments/:id/status`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "status": "IN_TRANSIT"
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "IN_TRANSIT",
    "inTransitAt": "2024-01-14T..."
  }
}
```

**✅ Verify**:

- Status code: 200
- Status changes to `IN_TRANSIT`
- `inTransitAt` timestamp is set
- **Route simulation should start** (check logs/Redis)

---

### Test 18: Update Status to DELIVERED

**Endpoint**: `PATCH /v1/shipments/:id/status`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**Request**:

```json
{
  "status": "DELIVERED"
}
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "DELIVERED",
    "deliveredAt": "2024-01-14T..."
  }
}
```

**✅ Verify**:

- Status code: 200
- Status changes to `DELIVERED`
- `deliveredAt` timestamp is set
- **Route simulation should stop** (check logs)

---

### Test 19: Cancel Shipment Before IN_TRANSIT

**Endpoint**: `POST /v1/shipments/:id/cancel-by-driver`

**Headers**:

```
Authorization: Bearer <driver-token>
x-tenant-id: <tenant-id>
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CANCEL_BY_DRIVER"
  }
}
```

**✅ Verify**:

- Status code: 200
- Status changes to `CANCEL_BY_DRIVER`
- Can cancel when status is `CREATED` or `ASSIGNED`

---

### Test 20: Cannot Cancel After IN_TRANSIT

**Scenario**: Try to cancel shipment that's already IN_TRANSIT

**Endpoint**: `POST /v1/shipments/:in-transit-shipment-id/cancel-by-driver`

**Expected Response**:

```json
{
  "success": false,
  "error_code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot cancel shipment. Shipment is already IN_TRANSIT or DELIVERED."
}
```

**✅ Verify**:

- Status code: 400
- Error message indicates cancellation not allowed
- Status remains `IN_TRANSIT`

---

### Test 21: Cannot Update to Invalid Status

**Scenario**: Try to update status to something driver can't set

**Endpoint**: `PATCH /v1/shipments/:id/status`

**Request**:

```json
{
  "status": "CREATED"
}
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "INVALID_STATUS_TRANSITION",
  "message": "Drivers can only update status to IN_TRANSIT or DELIVERED"
}
```

**✅ Verify**:

- Status code: 400
- Driver can only set `IN_TRANSIT` or `DELIVERED`
- Cannot set other statuses

---

## Customer Side Testing

### Test 22: Login as Customer

**Endpoint**: `POST /v1/auth/login`

**Request**:

```json
{
  "email": "customer1@acme.com",
  "password": "password123"
}
```

**✅ Verify**:

- Status code: 200
- Token is returned
- User role is `customer`
- Tenant ID is correct

---

### Test 23: Cancel Shipment Before IN_TRANSIT

**Endpoint**: `POST /v1/shipments/:id/cancel-by-customer`

**Headers**:

```
Authorization: Bearer <customer-token>
x-tenant-id: <tenant-id>
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CANCEL_BY_CUSTOMER"
  }
}
```

**✅ Verify**:

- Status code: 200
- Status changes to `CANCEL_BY_CUSTOMER`
- Can cancel when status is `CREATED` or `ASSIGNED`

---

### Test 24: Cannot Cancel After IN_TRANSIT

**Scenario**: Try to cancel shipment that's already IN_TRANSIT

**Endpoint**: `POST /v1/shipments/:in-transit-shipment-id/cancel-by-customer`

**Expected Response**:

```json
{
  "success": false,
  "error_code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot cancel shipment. Shipment is already IN_TRANSIT or DELIVERED."
}
```

**✅ Verify**:

- Status code: 400
- Error message indicates cancellation not allowed
- Status remains `IN_TRANSIT`

---

## Multi-Tenant Testing

### Test 25: Multi-Tenant Login Flow

**Step 1: Login with email in multiple tenants**

**Endpoint**: `POST /v1/auth/login`

**Request**:

```json
{
  "email": "multi@example.com",
  "password": "password123"
}
```

**Expected Response**:

```json
{
  "success": true,
  "requiresTenantSelection": true,
  "tenants": [
    {
      "id": "tenant-1-id",
      "name": "Acme Corp",
      "slug": "acme-corp"
    },
    {
      "id": "tenant-2-id",
      "name": "Tech Solutions",
      "slug": "tech-solutions"
    }
  ],
  "message": "Please select which organization you want to login to"
}
```

**✅ Verify**:

- Status code: 200
- `requiresTenantSelection` is `true`
- Returns array of tenants
- Each tenant has `id`, `name`, `slug`

---

### Test 26: Complete Tenant Selection

**Step 2: Select tenant and complete login**

**Endpoint**: `POST /v1/auth/login`

**Request**:

```json
{
  "email": "multi@example.com",
  "password": "password123",
  "tenantId": "tenant-1-id"
}
```

**Expected Response**:

```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "multi@example.com",
    "role": "...",
    "tenantId": "tenant-1-id"
  }
}
```

**✅ Verify**:

- Status code: 200
- Token is returned
- User's `tenantId` matches selected tenant
- Password is re-verified

---

### Test 27: Cross-Tenant Data Isolation

**Scenario**: Admin from Tenant 1 tries to access Tenant 2 data

**Endpoint**: `GET /v1/shipments/:tenant2-shipment-id`

**Headers**:

```
Authorization: Bearer <tenant1-admin-token>
x-tenant-id: <tenant-1-id>
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Shipment not found"
}
```

**✅ Verify**:

- Status code: 404 or 403
- Cannot access other tenant's data
- Tenant isolation enforced at all levels

---

## Status Transition Testing

### Test 28: Full Status Flow

**Complete flow**: `CREATED` → `ASSIGNED` → `IN_TRANSIT` → `DELIVERED`

**Step 1: Create Shipment**

- Admin creates shipment → Status: `CREATED`

**Step 2: Assign Driver**

- Admin assigns driver → Status: `ASSIGNED`

**Step 3: Start Delivery**

- Driver updates status → Status: `IN_TRANSIT`
- **Verify**: Route simulation starts

**Step 4: Complete Delivery**

- Driver updates status → Status: `DELIVERED`
- **Verify**: Route simulation stops

**✅ Verify**:

- Each transition is valid
- Timestamps are set correctly
- Route simulation starts/stops appropriately

---

### Test 29: Cancellation Flow - Customer

**Flow**: `CREATED` → `CANCEL_BY_CUSTOMER`

**Step 1: Create Shipment**

- Admin creates shipment → Status: `CREATED`

**Step 2: Customer Cancels**

- Customer cancels → Status: `CANCEL_BY_CUSTOMER`

**✅ Verify**:

- Cancellation succeeds
- Status is terminal (cannot change after cancellation)

---

### Test 30: Cancellation Flow - Driver

**Flow**: `ASSIGNED` → `CANCEL_BY_DRIVER`

**Step 1: Assign Driver**

- Admin assigns driver → Status: `ASSIGNED`

**Step 2: Driver Cancels**

- Driver cancels → Status: `CANCEL_BY_DRIVER`

**✅ Verify**:

- Cancellation succeeds
- Status is terminal
- Driver can be reassigned after cancellation

---

### Test 31: Invalid Transitions

**Test invalid status transitions**:

1. **IN_TRANSIT → CANCEL_BY_CUSTOMER**

   - Should fail with 400 error

2. **IN_TRANSIT → CANCEL_BY_DRIVER**

   - Should fail with 400 error

3. **DELIVERED → Any Status**

   - Should fail with 400 error

4. **ASSIGNED → CREATED**
   - Should fail with 400 error

**✅ Verify**:

- All invalid transitions are blocked
- Error messages are clear
- State machine enforces rules

---

## Route Simulation Testing

### Test 32: Route Simulation Starts on IN_TRANSIT

**Prerequisites**:

- Shipment with `ASSIGNED` status
- Driver assigned
- Valid pickup and delivery addresses

**Steps**:

1. Driver updates status to `IN_TRANSIT`
2. Check backend logs for route simulation start
3. Check Redis for simulation data
4. Check Socket.IO events for location updates

**✅ Verify**:

- Route simulation service is called
- OSRM route is fetched
- Location updates start appearing
- Socket.IO emits location updates

---

### Test 33: Route Simulation Stops on DELIVERED

**Steps**:

1. Shipment is `IN_TRANSIT` (simulation running)
2. Driver updates status to `DELIVERED`
3. Check backend logs for simulation stop
4. Check Redis for simulation cleanup

**✅ Verify**:

- Route simulation stops
- Location updates stop
- Simulation data is cleaned up

---

### Test 34: Route Simulation Stops on Cancellation

**Steps**:

1. Shipment is `IN_TRANSIT` (simulation running)
2. Customer or driver cancels shipment
3. Check backend logs for simulation stop

**✅ Verify**:

- Route simulation stops immediately
- Location updates stop
- Simulation data is cleaned up

---

### Test 35: Route Simulation with OSRM

**Verify OSRM Integration**:

1. Check backend logs for OSRM API calls
2. Verify route points are road-based (not straight line)
3. Check distance calculations use Haversine formula
4. Verify delivery threshold detection

**✅ Verify**:

- OSRM API is called with correct coordinates
- Route points follow roads
- Distance calculations are accurate
- Simulation stops when within delivery threshold

---

## Edge Cases & Error Scenarios

### Test 36: Missing Authentication

**Scenario**: Access protected endpoint without token

**Endpoint**: `GET /v1/shipments`

**Expected Response**:

```json
{
  "success": false,
  "error_code": "UNAUTHORIZED",
  "message": "Authorization header is required"
}
```

**✅ Verify**:

- Status code: 401
- Clear error message

---

### Test 37: Invalid Token

**Scenario**: Access with invalid/expired token

**Headers**:

```
Authorization: Bearer invalid-token
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**✅ Verify**:

- Status code: 401
- Token validation works

---

### Test 38: Wrong Role Access

**Scenario**: Driver tries to access admin-only endpoint

**Endpoint**: `GET /v1/dashboard/summary`

**Headers**:

```
Authorization: Bearer <driver-token>
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "FORBIDDEN",
  "message": "Access denied. Admin role required."
}
```

**✅ Verify**:

- Status code: 403
- Role guard works correctly

---

### Test 39: Missing Required Fields

**Scenario**: Create shipment without required fields

**Endpoint**: `POST /v1/shipments`

**Request**:

```json
{
  "pickupAddress": "123 Main St"
  // Missing deliveryAddress, customerName, customerPhone
}
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [...]
}
```

**✅ Verify**:

- Status code: 400
- Validation errors are clear
- All required fields are validated

---

### Test 40: Invalid Shipment ID

**Scenario**: Access non-existent shipment

**Endpoint**: `GET /v1/shipments/non-existent-id`

**Expected Response**:

```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Shipment not found"
}
```

**✅ Verify**:

- Status code: 404
- Error message is clear

---

### Test 41: Invalid Driver Assignment

**Scenario**: Assign non-existent driver

**Endpoint**: `POST /v1/shipments/:id/assign-driver`

**Request**:

```json
{
  "driverId": "non-existent-driver-id"
}
```

**Expected Response**:

```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Driver not found"
}
```

**✅ Verify**:

- Status code: 404
- Driver validation works

---

### Test 42: Duplicate Driver Assignment

**Scenario**: Try to assign driver to already assigned shipment

**Endpoint**: `POST /v1/shipments/:assigned-shipment-id/assign-driver`

**Expected Response**:

```json
{
  "success": false,
  "error_code": "INVALID_STATUS_TRANSITION",
  "message": "Cannot reassign driver. Shipment is already assigned and not cancelled."
}
```

**✅ Verify**:

- Status code: 400
- Reassignment prevention works

---

## API Testing Checklist

### Authentication & Authorization

- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Access protected endpoint without token
- [ ] Access with invalid token
- [ ] Access with expired token
- [ ] Wrong role access (driver accessing admin endpoint)

### Multi-Tenant

- [ ] Single tenant login
- [ ] Multi-tenant selection
- [ ] Tenant selection completion
- [ ] Cross-tenant data isolation
- [ ] Tenant ID validation

### Admin Operations

- [ ] Create shipment
- [ ] Get all shipments
- [ ] Get shipment by ID
- [ ] Assign driver
- [ ] Prevent driver reassignment
- [ ] Update shipment status
- [ ] Get all drivers
- [ ] Get driver by ID
- [ ] Dashboard summary
- [ ] Cannot access other tenant data

### Driver Operations

- [ ] Get assigned shipments only
- [ ] Cannot access other drivers' shipments
- [ ] Update location
- [ ] Update status to IN_TRANSIT
- [ ] Update status to DELIVERED
- [ ] Cancel before IN_TRANSIT
- [ ] Cannot cancel after IN_TRANSIT
- [ ] Cannot update to invalid status

### Customer Operations

- [ ] Cancel before IN_TRANSIT
- [ ] Cannot cancel after IN_TRANSIT

### Status Transitions

- [ ] CREATED → ASSIGNED
- [ ] ASSIGNED → IN_TRANSIT
- [ ] IN_TRANSIT → DELIVERED
- [ ] CREATED → CANCEL_BY_CUSTOMER
- [ ] ASSIGNED → CANCEL_BY_CUSTOMER
- [ ] ASSIGNED → CANCEL_BY_DRIVER
- [ ] Invalid transitions blocked

### Route Simulation

- [ ] Starts on IN_TRANSIT
- [ ] Stops on DELIVERED
- [ ] Stops on cancellation
- [ ] OSRM integration
- [ ] Location updates via Socket.IO
- [ ] Distance calculations
- [ ] Delivery threshold detection

### Error Handling

- [ ] Missing required fields
- [ ] Invalid shipment ID
- [ ] Invalid driver ID
- [ ] Invalid status transition
- [ ] Validation errors
- [ ] Not found errors
- [ ] Forbidden errors

---

## Testing Tips

### 1. Use Postman Collections

Create a Postman collection with all endpoints and use environment variables for tokens and tenant IDs.

### 2. Test in Order

Follow the test order as some tests depend on previous ones (e.g., need to create shipment before assigning driver).

### 3. Check Logs

Monitor backend logs to verify:

- Route simulation starts/stops
- Socket.IO events are emitted
- Database queries are correct

### 4. Use Frontend

Test through the frontend UI to verify:

- Real-time location updates on map
- Status changes reflect immediately
- Multi-tenant login flow works

### 5. Test Edge Cases

Don't just test happy paths. Test:

- Invalid inputs
- Missing data
- Boundary conditions
- Error scenarios

### 6. Verify Data Isolation

Always verify that:

- Users can only see their tenant's data
- Drivers can only see their assigned shipments
- Cross-tenant access is blocked

---

## Quick Test Commands

```bash
# Start services
cd backend && npm run dev

# Seed database
cd backend && npm run seed:complete

# Run automated tests
cd backend && npm test

# Check API docs
# Open http://localhost:3000/docs
```

---

## Test Results Template

Use this template to track your test results:

```
Test #: [Number]
Test Name: [Name]
Endpoint: [Endpoint]
Status: [PASS/FAIL]
Notes: [Any observations]
```

---

## Support

If you encounter issues:

1. Check backend logs
2. Verify database is seeded
3. Verify services are running
4. Check API documentation at `/docs`
5. Review error messages carefully

---

**Happy Testing! 🚀**
