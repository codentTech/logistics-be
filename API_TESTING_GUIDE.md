# 🧪 Complete API Testing Guide

This guide walks you through testing all APIs in the OpsCore backend.

## 📋 Prerequisites

1. **Server is running:**

   ```bash
   npm run dev
   ```

2. **Database is seeded:**

   ```bash
   npm run seed
   ```

   > **Important:** Copy the `Tenant ID` from the seed output!

3. **Services are running:**
   - PostgreSQL ✅
   - Redis ✅
   - RabbitMQ ✅ (optional)
   - MQTT/EMQX ✅ (optional)

---

## 🔑 Understanding Idempotency-Key

**Idempotency-Key is a unique identifier YOU generate** to prevent duplicate operations when retrying requests.

### What is it?

- A unique string you create yourself (not provided by the server)
- Used in the `Idempotency-Key` header for POST/PUT/PATCH requests
- Prevents duplicate operations if you retry the same request

### How to Generate?

**Option 1: UUID (Recommended)**

```bash
# Mac/Linux
uuidgen
# Output: 550e8400-e29b-41d4-a716-446655440000

# Windows (PowerShell)
[guid]::NewGuid()
# Output: 550e8400-e29b-41d4-a716-446655440000

# Online generator: https://www.uuidgenerator.net/
```

**Option 2: Timestamp-based**

```javascript
`create-shipment-${Date.now()}`;
// Output: create-shipment-1704110400000
```

**Option 3: Simple unique string**

```
shipment-001
assign-driver-abc123
update-status-xyz789
```

### When to Use?

- ✅ **Same key** = When retrying the exact same request (you'll get cached response)
- ✅ **Different key** = For each new/unique request
- ✅ **Optional but recommended** for POST/PUT/PATCH requests

### Example:

```bash
# First request
Idempotency-Key: shipment-001
→ Creates shipment

# Retry with same key
Idempotency-Key: shipment-001
→ Returns cached response (no duplicate created)

# New request
Idempotency-Key: shipment-002
→ Creates new shipment
```

---

## 🎯 Testing Methods

### Method 1: Swagger UI (Recommended for Beginners)

- **URL:** http://localhost:3000/docs
- **Best for:** Interactive testing, seeing all endpoints, understanding schemas

### Method 2: Postman Collection

- **File:** `postman_collection.json`
- **Best for:** Automated testing, sharing with team, CI/CD

### Method 3: cURL (Command Line)

- **Best for:** Quick tests, scripts, automation

### Method 4: GraphQL Playground

- **URL:** http://localhost:3000/graphql
- **Best for:** GraphQL queries, flexible data fetching

---

## 🔐 Step 1: Authentication

### Login to Get Token

**Endpoint:** `POST /v1/auth/login`

**Request Body:**

```json
{
  "email": "admin@tenant1.com",
  "password": "password123",
  "tenantId": "YOUR_TENANT_ID_FROM_SEED"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "admin@tenant1.com",
    "role": "ops_admin",
    "tenantId": "tenant-uuid"
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tenant1.com",
    "password": "password123",
    "tenantId": "YOUR_TENANT_ID"
  }'
```

**Save the token!** You'll need it for all authenticated requests.

---

## 📦 Step 2: Shipment Management

### 2.1 Create a Shipment

**Endpoint:** `POST /v1/shipments`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
Idempotency-Key: unique-key-123 (optional but recommended)
```

**About Idempotency-Key:**

- **You generate it yourself** - it's a unique identifier you create (UUID, timestamp, or any unique string)
- **Purpose:** Prevents duplicate operations if you retry the same request
- **How to generate:**
  - **UUID:** `uuidgen` (Mac/Linux) or use an online UUID generator
  - **Timestamp-based:** `create-shipment-20240101-123456`
  - **Random string:** `shipment-abc123xyz`
- **Important:** Use the **same key** if you retry the exact same request - you'll get the cached response instead of creating a duplicate
- **Example keys:**
  - `shipment-001`
  - `550e8400-e29b-41d4-a716-446655440000`
  - `create-shipment-${Date.now()}`

**Request Body:**

```json
{
  "pickupAddress": "123 Main St, New York, NY 10001",
  "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
  "customerName": "John Doe",
  "customerPhone": "+1234567890"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "shipment-uuid",
    "tenantId": "tenant-uuid",
    "status": "CREATED",
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "driverId": null,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:3000/v1/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: shipment-001" \
  -d '{
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
    "customerName": "John Doe",
    "customerPhone": "+1234567890"
  }'
```

**Save the shipment ID!** You'll need it for next steps.

---

### 2.2 Assign Driver to Shipment

**Endpoint:** `POST /v1/shipments/:id/assign-driver`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**

```json
{
  "driverId": "DRIVER_ID_FROM_SEED"
}
```

> **Note:** Get the driver ID from the seed output, or check the database.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "shipment-uuid",
    "status": "ASSIGNED",
    "driverId": "driver-uuid",
    "assignedAt": "2024-01-01T12:05:00Z",
    ...
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:3000/v1/shipments/SHIPMENT_ID/assign-driver \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "DRIVER_ID"
  }'
```

---

### 2.3 Update Shipment Status

**Endpoint:** `POST /v1/shipments/:id/status`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**

```json
{
  "status": "PICKED_UP"
}
```

**Valid Status Values:**

- `CREATED` → `ASSIGNED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "shipment-uuid",
    "status": "PICKED_UP",
    "pickedUpAt": "2024-01-01T12:10:00Z",
    ...
  }
}
```

**cURL:**

```bash
curl -X POST http://localhost:3000/v1/shipments/SHIPMENT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PICKED_UP"
  }'
```

**Test the State Machine:**

1. Try invalid transitions (e.g., `CREATED` → `DELIVERED`) - should fail
2. Try valid transitions - should succeed
3. Check status history is recorded

---

## 🚗 Step 3: Driver Location Updates

### 3.1 Update Driver Location (REST)

**Endpoint:** `POST /v1/drivers/:id/location`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
```

**Request Body:**

```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Location updated successfully"
}
```

**cURL:**

```bash
curl -X POST http://localhost:3000/v1/drivers/DRIVER_ID/location \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2024-01-01T12:00:00Z"
  }'
```

**What to Test:**

- Location is stored in Redis
- Socket.IO event is emitted (if connected)
- Real-time updates work

---

### 3.2 Update Driver Location (MQTT)

**Topic:** `tenant/{tenantId}/driver/{driverId}/location`

**Note:** The correct topic format is `tenant/{tenantId}/driver/{driverId}/location` (not `drivers/{tenantId}/{driverId}/location`)

**Message:**

```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Using MQTT Client (mosquitto_pub):**

```bash
mosquitto_pub -h your-mqtt-server -p 1883 \
  -t "tenant/TENANT_ID/driver/DRIVER_ID/location" \
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}'
```

**What to Test:**

- MQTT messages are received
- Location is processed same as REST
- Source is marked as "MQTT" vs "REST"

---

## 📊 Step 4: Dashboard (CQRS Read)

### Get Dashboard Summary

**Endpoint:** `GET /v1/dashboard/summary`

**Headers:**

```
Authorization: Bearer YOUR_TOKEN
```

**Response:**

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

**cURL:**

```bash
curl -X GET http://localhost:3000/v1/dashboard/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What to Test:**

- Summary is aggregated correctly
- Data updates after shipments/drivers change
- Multi-tenant isolation (only your tenant's data)

---

## 🔍 Step 5: GraphQL Queries

### Access GraphQL Playground

**URL:** http://localhost:3000/graphql

### Query Shipments

**Query:**

```graphql
query {
  shipments(limit: 10) {
    id
    status
    pickupAddress
    deliveryAddress
    customerName
    driver {
      id
      name
    }
    statusHistory {
      status
      changedAt
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "shipments": [
      {
        "id": "shipment-uuid",
        "status": "ASSIGNED",
        "pickupAddress": "123 Main St",
        "deliveryAddress": "456 Oak Ave",
        "customerName": "John Doe",
        "driver": {
          "id": "driver-uuid",
          "name": "John Driver"
        },
        "statusHistory": [
          {
            "status": "CREATED",
            "changedAt": "2024-01-01T12:00:00Z"
          },
          {
            "status": "ASSIGNED",
            "changedAt": "2024-01-01T12:05:00Z"
          }
        ]
      }
    ]
  }
}
```

### Query Dashboard Summary

**Query:**

```graphql
query {
  dashboardSummary {
    totalShipments
    activeShipments
    deliveredToday
    driversOnline
    lastUpdated
  }
}
```

---

## 🧪 Complete Testing Flow

### End-to-End Test Scenario

1. **Login** → Get token
2. **Create Shipment** → Get shipment ID
3. **Assign Driver** → Shipment status → `ASSIGNED`
4. **Update Status** → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`
5. **Update Driver Location** (multiple times)
6. **Check Dashboard** → Verify counts updated
7. **Query GraphQL** → Verify data consistency

### Test Idempotency

1. Create shipment with `Idempotency-Key: test-123`
2. Create same shipment again with same key
3. Should return same shipment (not create duplicate)

### Test State Machine

1. Try `CREATED` → `DELIVERED` (should fail)
2. Try `CREATED` → `ASSIGNED` (should succeed)
3. Try `ASSIGNED` → `CREATED` (should fail - no rollback)
4. Try valid flow: `CREATED` → `ASSIGNED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED`

### Test Multi-Tenant Isolation

1. Create tenant 2 and user
2. Login as tenant 1 user
3. Create shipment
4. Login as tenant 2 user
5. Query shipments → Should be empty (tenant 2 has no shipments)

### Test Real-Time Updates

1. Connect to Socket.IO (use a client or test tool)
2. Join room: `tenant:YOUR_TENANT_ID`
3. Update driver location
4. Should receive `driver:location` event

---

## 📝 Testing Checklist

### Authentication

- [ ] Login with correct credentials → Success
- [ ] Login with wrong password → 401
- [ ] Login with wrong tenant → 404
- [ ] Use token in authenticated endpoint → Success
- [ ] Use invalid token → 401

### Shipments

- [ ] Create shipment → 201
- [ ] Create with idempotency key → Same result on retry
- [ ] Assign driver → Status changes to ASSIGNED
- [ ] Update status (valid) → Success
- [ ] Update status (invalid) → 400
- [ ] Check status history recorded

### Drivers

- [ ] Update location via REST → Success
- [ ] Update location via MQTT → Success
- [ ] Verify location in Redis
- [ ] Verify Socket.IO event emitted

### Dashboard

- [ ] Get summary → Returns correct counts
- [ ] Summary updates after changes
- [ ] Multi-tenant isolation works

### GraphQL

- [ ] Query shipments → Returns data
- [ ] Query dashboard → Returns summary
- [ ] Nested queries work (driver, statusHistory)

### Error Handling

- [ ] Invalid request body → 400
- [ ] Missing auth token → 401
- [ ] Invalid state transition → 400
- [ ] Non-existent resource → 404

---

## 🛠️ Quick Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
TENANT_ID="YOUR_TENANT_ID"
EMAIL="admin@tenant1.com"
PASSWORD="password123"

echo "🔐 Step 1: Login"
TOKEN=$(curl -s -X POST "$BASE_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"tenantId\":\"$TENANT_ID\"}" \
  | jq -r '.token')

echo "Token: $TOKEN"
echo ""

echo "📦 Step 2: Create Shipment"
SHIPMENT=$(curl -s -X POST "$BASE_URL/v1/shipments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{
    "pickupAddress": "123 Main St, NY",
    "deliveryAddress": "456 Oak Ave, NY",
    "customerName": "Test Customer",
    "customerPhone": "+1234567890"
  }')

SHIPMENT_ID=$(echo $SHIPMENT | jq -r '.data.id')
echo "Shipment ID: $SHIPMENT_ID"
echo ""

echo "📊 Step 3: Get Dashboard"
curl -s -X GET "$BASE_URL/v1/dashboard/summary" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "✅ Test complete!"
```

Make it executable:

```bash
chmod +x test-api.sh
./test-api.sh
```

---

## 🐛 Troubleshooting

### "Unauthorized" errors

- Check token is valid
- Token format: `Bearer YOUR_TOKEN`
- Token might be expired (default: 24 hours)

### "Tenant not found"

- Verify tenant ID from seed output
- Run `npm run seed` again if needed

### "Invalid state transition"

- Check current shipment status
- Follow valid state machine flow

### GraphQL errors

- Check query syntax
- Verify you're authenticated
- Check tenant isolation

---

## 📚 Additional Resources

- **Swagger UI:** http://localhost:3000/docs
- **GraphQL Playground:** http://localhost:3000/graphql
- **Postman Collection:** `postman_collection.json`
- **Login Guide:** `LOGIN_GUIDE.md`

---

## 🎯 Next Steps

After testing all APIs:

1. **Test Real-Time Features:**

   - Socket.IO connections
   - MQTT message publishing
   - Live location updates

2. **Test Resilience:**

   - Retry mechanisms
   - Circuit breakers
   - Error handling

3. **Test Performance:**

   - Load testing
   - Concurrent requests
   - Database queries

4. **Integration Testing:**
   - Full workflow end-to-end
   - Multi-tenant scenarios
   - Event processing

Happy Testing! 🚀
