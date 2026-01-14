# Detailed Test Scenarios

This document provides detailed step-by-step scenarios for testing all features.

## Scenario 1: Complete Shipment Lifecycle (Admin + Driver)

### Setup
1. Login as Admin (Tenant 1)
2. Get admin token
3. Get driver ID from drivers list

### Steps

**Step 1: Create Shipment (Admin)**
```
POST /v1/shipments
Headers: Authorization: Bearer <admin-token>, x-tenant-id: <tenant-id>
Body: {
  "pickupAddress": "Times Square, New York, NY",
  "deliveryAddress": "Central Park, New York, NY",
  "customerName": "Alice Johnson",
  "customerPhone": "+1234567890"
}
Expected: Status CREATED, driverId: null
```

**Step 2: Assign Driver (Admin)**
```
POST /v1/shipments/<shipment-id>/assign-driver
Headers: Authorization: Bearer <admin-token>, x-tenant-id: <tenant-id>
Body: { "driverId": "<driver-id>" }
Expected: Status ASSIGNED, driverId set, assignedAt timestamp
```

**Step 3: Login as Driver**
```
POST /v1/auth/login
Body: { "email": "driver1@acme.com", "password": "password123" }
Expected: Driver token
```

**Step 4: Driver Starts Delivery**
```
PATCH /v1/shipments/<shipment-id>/status
Headers: Authorization: Bearer <driver-token>, x-tenant-id: <tenant-id>
Body: { "status": "IN_TRANSIT" }
Expected: Status IN_TRANSIT, inTransitAt timestamp, route simulation starts
```

**Step 5: Verify Route Simulation**
- Check backend logs: "Route simulation started"
- Check Redis for simulation data
- Check Socket.IO events for location updates
- Verify driver location updates on map

**Step 6: Driver Completes Delivery**
```
PATCH /v1/shipments/<shipment-id>/status
Headers: Authorization: Bearer <driver-token>, x-tenant-id: <tenant-id>
Body: { "status": "DELIVERED" }
Expected: Status DELIVERED, deliveredAt timestamp, route simulation stops
```

**Step 7: Verify Completion**
- Check backend logs: "Route simulation stopped"
- Verify shipment status is DELIVERED
- Verify all timestamps are set correctly

---

## Scenario 2: Customer Cancellation Flow

### Setup
1. Admin creates shipment (Status: CREATED)
2. Admin assigns driver (Status: ASSIGNED)
3. Customer logs in

### Steps

**Step 1: Customer Cancels Before IN_TRANSIT**
```
POST /v1/shipments/<shipment-id>/cancel-by-customer
Headers: Authorization: Bearer <customer-token>, x-tenant-id: <tenant-id>
Expected: Status CANCEL_BY_CUSTOMER
```

**Step 2: Verify Cancellation**
- Status is CANCEL_BY_CUSTOMER
- Cannot update status after cancellation
- Driver can be reassigned to new shipment

**Step 3: Try to Cancel After IN_TRANSIT (Should Fail)**
- Driver updates status to IN_TRANSIT
- Customer tries to cancel
- Expected: 400 error, cancellation not allowed

---

## Scenario 3: Driver Cancellation Flow

### Setup
1. Admin creates shipment
2. Admin assigns driver to shipment
3. Driver logs in

### Steps

**Step 1: Driver Cancels Before IN_TRANSIT**
```
POST /v1/shipments/<shipment-id>/cancel-by-driver
Headers: Authorization: Bearer <driver-token>, x-tenant-id: <tenant-id>
Expected: Status CANCEL_BY_DRIVER
```

**Step 2: Verify Cancellation**
- Status is CANCEL_BY_DRIVER
- Admin can assign new driver to shipment
- Cannot update status after cancellation

**Step 3: Try to Cancel After IN_TRANSIT (Should Fail)**
- Driver updates status to IN_TRANSIT
- Driver tries to cancel
- Expected: 400 error, cancellation not allowed

---

## Scenario 4: Multi-Tenant Login Flow

### Setup
1. User exists in multiple tenants (same email)

### Steps

**Step 1: Initial Login (No Tenant Selected)**
```
POST /v1/auth/login
Body: {
  "email": "multi@example.com",
  "password": "password123"
}
Expected: {
  "requiresTenantSelection": true,
  "tenants": [
    { "id": "tenant-1", "name": "Acme Corp", "slug": "acme-corp" },
    { "id": "tenant-2", "name": "Tech Solutions", "slug": "tech-solutions" }
  ]
}
```

**Step 2: Select Tenant and Complete Login**
```
POST /v1/auth/login
Body: {
  "email": "multi@example.com",
  "password": "password123",
  "tenantId": "tenant-1"
}
Expected: {
  "token": "...",
  "user": { "tenantId": "tenant-1", ... }
}
```

**Step 3: Verify Tenant Isolation**
- Try to access Tenant 2 data with Tenant 1 token
- Expected: 404 or 403 error

---

## Scenario 5: Driver Reassignment Prevention

### Setup
1. Admin creates shipment
2. Admin assigns Driver 1

### Steps

**Step 1: Try to Reassign Driver (Should Fail)**
```
POST /v1/shipments/<shipment-id>/assign-driver
Headers: Authorization: Bearer <admin-token>, x-tenant-id: <tenant-id>
Body: { "driverId": "<different-driver-id>" }
Expected: 400 error, "Cannot reassign driver"
```

**Step 2: Cancel Shipment**
```
POST /v1/shipments/<shipment-id>/cancel-by-customer
Headers: Authorization: Bearer <customer-token>, x-tenant-id: <tenant-id>
Expected: Status CANCEL_BY_CUSTOMER
```

**Step 3: Now Can Reassign (After Cancellation)**
- After cancellation, admin can assign new driver
- Or create new shipment and assign different driver

---

## Scenario 6: Route Simulation with Real Addresses

### Setup
1. Use real addresses for pickup and delivery
2. Ensure OSRM service is accessible

### Steps

**Step 1: Create Shipment with Real Addresses**
```
POST /v1/shipments
Body: {
  "pickupAddress": "Empire State Building, New York, NY",
  "deliveryAddress": "Statue of Liberty, New York, NY",
  "customerName": "Tourist",
  "customerPhone": "+1234567890"
}
```

**Step 2: Assign Driver and Start Delivery**
- Assign driver
- Driver updates to IN_TRANSIT

**Step 3: Monitor Route Simulation**
- Check backend logs for OSRM API calls
- Verify route points follow roads (not straight line)
- Check distance calculations
- Verify location updates in real-time

**Step 4: Verify Delivery Threshold**
- Simulation should stop when driver is close to delivery location
- Check logs for "Delivery threshold reached"

---

## Scenario 7: Cross-Tenant Data Isolation

### Setup
1. Login as Admin Tenant 1
2. Create shipment in Tenant 1
3. Login as Admin Tenant 2

### Steps

**Step 1: Tenant 1 Admin Creates Shipment**
```
POST /v1/shipments
Headers: Authorization: Bearer <tenant1-admin-token>, x-tenant-id: <tenant-1-id>
Body: { ... }
Expected: Shipment created in Tenant 1
```

**Step 2: Tenant 2 Admin Tries to Access Tenant 1 Shipment**
```
GET /v1/shipments/<tenant1-shipment-id>
Headers: Authorization: Bearer <tenant2-admin-token>, x-tenant-id: <tenant-2-id>
Expected: 404 or 403 error
```

**Step 3: Verify Isolation**
- Tenant 2 admin cannot see Tenant 1 shipments
- Tenant 2 admin cannot modify Tenant 1 shipments
- All queries are filtered by tenantId

---

## Scenario 8: Error Handling and Validation

### Steps

**Step 1: Missing Required Fields**
```
POST /v1/shipments
Body: { "pickupAddress": "123 Main St" }
Expected: 400 error with validation details
```

**Step 2: Invalid Status Transition**
```
PATCH /v1/shipments/<id>/status
Body: { "status": "INVALID_STATUS" }
Expected: 400 error, "Invalid status"
```

**Step 3: Invalid Driver Assignment**
```
POST /v1/shipments/<id>/assign-driver
Body: { "driverId": "non-existent-id" }
Expected: 404 error, "Driver not found"
```

**Step 4: Unauthorized Access**
```
GET /v1/shipments
Headers: (no Authorization header)
Expected: 401 error, "Authorization header is required"
```

**Step 5: Wrong Role Access**
```
GET /v1/dashboard/summary
Headers: Authorization: Bearer <driver-token>
Expected: 403 error, "Admin role required"
```

---

## Scenario 9: Real-Time Location Updates

### Setup
1. Driver is assigned to shipment
2. Status is IN_TRANSIT
3. Route simulation is running

### Steps

**Step 1: Monitor Socket.IO Events**
- Connect to Socket.IO server
- Join tenant room: `tenant:<tenant-id>`
- Listen for `driver-location-update` events

**Step 2: Verify Location Updates**
- Location updates should arrive in real-time
- Each update contains: driverId, latitude, longitude, timestamp
- Updates follow the route path

**Step 3: Verify Map Updates**
- If using frontend, verify map updates in real-time
- Driver marker moves along route
- Route line is displayed

---

## Scenario 10: Dashboard Summary

### Setup
1. Create multiple shipments in different statuses
2. Assign drivers to some shipments
3. Complete some deliveries

### Steps

**Step 1: Get Dashboard Summary**
```
GET /v1/dashboard/summary
Headers: Authorization: Bearer <admin-token>, x-tenant-id: <tenant-id>
Expected: {
  "totalShipments": 10,
  "activeDrivers": 3,
  "pendingShipments": 2,
  "inTransitShipments": 1,
  "deliveredShipments": 5
}
```

**Step 2: Verify Counts**
- Total shipments matches database count
- Active drivers are drivers with recent location updates
- Status counts match actual shipment statuses
- All counts are for admin's tenant only

---

## Quick Reference: Test Data

### Valid Test Addresses (New York)
- **Pickup**: "Times Square, New York, NY 10036"
- **Delivery**: "Central Park, New York, NY 10024"
- **Pickup**: "Empire State Building, New York, NY 10118"
- **Delivery**: "Statue of Liberty, New York, NY 10004"

### Test Coordinates
- **Times Square**: 40.7580, -73.9855
- **Central Park**: 40.7829, -73.9654
- **Empire State Building**: 40.7484, -73.9857
- **Statue of Liberty**: 40.6892, -74.0445

### Test Phone Numbers
- +1234567890
- +1987654321
- +1555123456

---

## Testing Best Practices

1. **Test in Isolation**: Each scenario should be independent
2. **Clean State**: Reset database between major test runs
3. **Verify Logs**: Always check backend logs for errors
4. **Test Edge Cases**: Don't just test happy paths
5. **Verify Data**: Check database directly to verify changes
6. **Monitor Performance**: Check response times
7. **Test Concurrency**: Test multiple users simultaneously
8. **Verify Security**: Test authentication and authorization thoroughly

---

## Common Issues and Solutions

### Issue: Route simulation not starting
**Solution**: 
- Verify driver is assigned
- Check OSRM service is accessible
- Check Redis is running
- Verify pickup/delivery addresses are valid

### Issue: Cannot access other tenant data
**Solution**: This is expected behavior - tenant isolation is working correctly

### Issue: Status transition fails
**Solution**: 
- Check current status
- Verify transition is valid according to state machine
- Check user role has permission for transition

### Issue: Token expired
**Solution**: 
- Login again to get new token
- Tokens expire after 7 days (default)

---

**Use these scenarios to thoroughly test all features! 🧪**

