# 📦 Shipment Management Guide

## How to Create Shipments and Assign Drivers

### Method 1: Using the Frontend UI (Easiest)

#### Step 1: Create a Shipment

1. **Navigate to Create Shipment Page:**
   - Go to: `http://localhost:3000/shipments/create`
   - Or click "Create Shipment" button from the shipments list page

2. **Fill in the Form:**
   - **Customer Name**: Enter customer's full name
   - **Customer Phone**: Enter phone number (e.g., +1234567890)
   - **Pickup Address**: Enter the pickup location
   - **Delivery Address**: Enter the delivery location

3. **Submit:**
   - Click "Create Shipment" button
   - You'll be redirected to the shipments list
   - The shipment will be created with status `CREATED`

#### Step 2: Assign a Driver

1. **View Shipment Details:**
   - Go to shipments list: `http://localhost:3000/shipments`
   - Click "View" on any shipment with status `CREATED`

2. **Assign Driver:**
   - On the shipment details page, you'll see an "Assign Driver" section
   - Select a driver from the dropdown
   - Click "Assign Driver" button
   - The shipment status will change to `ASSIGNED`

---

### Method 2: Using API (cURL/Postman)

#### Step 1: Get Your Token

First, login to get your JWT token:

```bash
curl -X POST http://localhost:5000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tenant1.com",
    "password": "password123",
    "tenantId": "YOUR_TENANT_ID"
  }'
```

**Save the token** from the response.

#### Step 2: Get Driver IDs

List all available drivers:

```bash
curl -X GET http://localhost:5000/v1/drivers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Save a driver ID** from the response.

#### Step 3: Create a Shipment

```bash
curl -X POST http://localhost:5000/v1/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: shipment-$(date +%s)" \
  -d '{
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
    "customerName": "John Doe",
    "customerPhone": "+1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "shipment-uuid",
    "status": "CREATED",
    "pickupAddress": "123 Main St, New York, NY 10001",
    "deliveryAddress": "456 Oak Ave, Brooklyn, NY 11201",
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "driverId": null,
    ...
  }
}
```

**Save the shipment ID** from the response.

#### Step 4: Assign Driver to Shipment

```bash
curl -X POST http://localhost:5000/v1/shipments/SHIPMENT_ID/assign-driver \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "DRIVER_ID"
  }'
```

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

---

### Method 3: Using Swagger UI

1. **Open Swagger:**
   - Navigate to: `http://localhost:5000/docs`

2. **Authorize:**
   - Click "Authorize" button (top right)
   - Enter your JWT token: `Bearer YOUR_TOKEN`
   - Click "Authorize"

3. **Create Shipment:**
   - Find `POST /v1/shipments`
   - Click "Try it out"
   - Fill in the request body
   - Add `Idempotency-Key` header (optional but recommended)
   - Click "Execute"

4. **Assign Driver:**
   - Find `POST /v1/shipments/{id}/assign-driver`
   - Click "Try it out"
   - Enter the shipment ID in the path parameter
   - Fill in `driverId` in the request body
   - Click "Execute"

---

## Shipment Status Flow

```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

### Status Transitions:

- **CREATED**: New shipment, no driver assigned
- **ASSIGNED**: Driver has been assigned (via assign-driver endpoint)
- **PICKED_UP**: Driver has picked up the shipment
- **IN_TRANSIT**: Shipment is on the way
- **DELIVERED**: Shipment completed (terminal state)

### Important Notes:

1. **You can only assign a driver to a shipment with status `CREATED`**
2. **You can reassign a driver to an already `ASSIGNED` shipment** (changes driver without changing status)
3. **Status transitions must follow the flow** - you cannot skip states
4. **Use the `/v1/shipments/{id}/status` endpoint** to update status after assignment

---

## Quick Reference

### Frontend Routes:
- **Create Shipment**: `/shipments/create`
- **View Shipments**: `/shipments`
- **Shipment Details**: `/shipments/{id}`

### API Endpoints:
- **Create**: `POST /v1/shipments`
- **List All**: `GET /v1/shipments`
- **Get By ID**: `GET /v1/shipments/{id}`
- **Assign Driver**: `POST /v1/shipments/{id}/assign-driver`
- **Update Status**: `POST /v1/shipments/{id}/status`

### Required Headers:
- `Authorization: Bearer YOUR_TOKEN` (for all authenticated endpoints)
- `Idempotency-Key: unique-key` (optional but recommended for POST requests)

---

## Example Workflow

1. **Create shipment** → Status: `CREATED`
2. **Assign driver** → Status: `ASSIGNED`
3. **Update status to PICKED_UP** → Status: `PICKED_UP`
4. **Update status to IN_TRANSIT** → Status: `IN_TRANSIT`
5. **Update status to DELIVERED** → Status: `DELIVERED` (final)

---

## Getting Driver IDs

### From Seed Output:
When you run `npm run seed` in the backend, it prints:
```
🚗 Driver ID: f9195272-0849-46ba-b138-63ad01bb054c
```

### From API:
```bash
curl -X GET http://localhost:5000/v1/drivers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### From Frontend:
- Go to: `http://localhost:3000/drivers`
- View the drivers list to see all available driver IDs

---

## Troubleshooting

### "Driver not found"
- Make sure the driver ID is correct
- Verify the driver belongs to your tenant
- Check if the driver is active

### "Cannot transition from X to Y"
- Follow the status flow: CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
- You cannot skip states or go backwards

### "Shipment not found"
- Verify the shipment ID is correct
- Make sure the shipment belongs to your tenant

