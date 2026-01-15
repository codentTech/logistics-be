# Test Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Start services
cd backend && npm run dev

# 2. Seed database
npm run seed:complete

# 3. Test endpoints
# Use Postman or curl commands below
```

---

## 🔐 Test Users

### Tenant 1 (Acme Corp)
- **Admin**: `admin1@acme.com` / `password123`
- **Driver**: `driver1@acme.com` / `password123`
- **Customer**: `customer1@acme.com` / `password123`

### Tenant 2 (Tech Solutions)
- **Admin**: `admin2@tech.com` / `password123`
- **Driver**: `driver2@tech.com` / `password123`
- **Customer**: `customer2@tech.com` / `password123`

---

## 📋 Essential Endpoints

### Authentication
```bash
# Login
POST /v1/auth/login
Body: { "email": "...", "password": "..." }
```

### Shipments (Admin)
```bash
# Create
POST /v1/shipments
Headers: Authorization: Bearer <token>, x-tenant-id: <id>
Body: { "pickupAddress": "...", "deliveryAddress": "...", "customerName": "...", "customerPhone": "..." }

# Get All
GET /v1/shipments
Headers: Authorization: Bearer <token>, x-tenant-id: <id>

# Assign Driver
POST /v1/shipments/:id/assign-driver
Body: { "driverId": "..." }

# Update Status
PATCH /v1/shipments/:id/status
Body: { "status": "IN_TRANSIT" }
```

### Shipments (Driver)
```bash
# Get Assigned Only
GET /v1/shipments
Headers: Authorization: Bearer <driver-token>, x-tenant-id: <id>

# Update Location
POST /v1/drivers/location
Body: { "latitude": 40.7128, "longitude": -74.0060 }

# Update Status
PATCH /v1/shipments/:id/status
Body: { "status": "IN_TRANSIT" }

# Cancel
POST /v1/shipments/:id/cancel-by-driver
```

### Shipments (Customer)
```bash
# Cancel
POST /v1/shipments/:id/cancel-by-customer
Headers: Authorization: Bearer <customer-token>, x-tenant-id: <id>
```

---

## ✅ Status Flow

```
CREATED → ASSIGNED → IN_TRANSIT → DELIVERED
   ↓          ↓
CANCEL    CANCEL
(Customer) (Driver)
```

**Rules**:
- ✅ Can cancel before `IN_TRANSIT`
- ❌ Cannot cancel after `IN_TRANSIT`
- ✅ Route simulation starts on `IN_TRANSIT`
- ✅ Route simulation stops on `DELIVERED` or cancellation

---

## 🧪 Quick Test Scenarios

### 1. Full Lifecycle (5 min)
1. Admin creates shipment
2. Admin assigns driver
3. Driver updates to IN_TRANSIT
4. Driver updates to DELIVERED
5. ✅ Verify route simulation started/stopped

### 2. Cancellation (2 min)
1. Admin creates shipment
2. Customer cancels
3. ✅ Verify status is CANCEL_BY_CUSTOMER

### 3. Multi-Tenant (3 min)
1. Login with multi-tenant email
2. Select tenant
3. ✅ Verify tenant isolation

### 4. Driver Access (2 min)
1. Driver gets shipments
2. ✅ Verify only assigned shipments shown

---

## 🔍 What to Verify

### Admin
- [ ] Can create shipments
- [ ] Can assign drivers
- [ ] Cannot reassign (when already assigned)
- [ ] Can see all shipments
- [ ] Cannot access other tenant data

### Driver
- [ ] Can see only assigned shipments
- [ ] Can update location
- [ ] Can update status (IN_TRANSIT, DELIVERED)
- [ ] Can cancel before IN_TRANSIT
- [ ] Cannot cancel after IN_TRANSIT
- [ ] Cannot access other drivers' shipments

### Customer
- [ ] Can cancel before IN_TRANSIT
- [ ] Cannot cancel after IN_TRANSIT

### Route Simulation
- [ ] Starts when status → IN_TRANSIT
- [ ] Stops when status → DELIVERED
- [ ] Stops on cancellation
- [ ] Location updates in real-time

---

## 🚨 Common Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `UNAUTHORIZED` | No/missing token | Add Authorization header |
| `FORBIDDEN` | Wrong role | Use correct role token |
| `NOT_FOUND` | Resource doesn't exist | Check ID, verify tenant |
| `INVALID_STATUS_TRANSITION` | Invalid status change | Check current status |
| `VALIDATION_ERROR` | Missing/invalid fields | Check request body |

---

## 📊 Test Checklist

### Authentication
- [ ] Login works
- [ ] Multi-tenant selection works
- [ ] Token required for protected routes
- [ ] Invalid token rejected

### Admin
- [ ] Create shipment
- [ ] Assign driver
- [ ] Prevent reassignment
- [ ] Update status
- [ ] Dashboard access

### Driver
- [ ] See assigned shipments only
- [ ] Update location
- [ ] Update status
- [ ] Cancel before IN_TRANSIT

### Customer
- [ ] Cancel before IN_TRANSIT
- [ ] Cannot cancel after IN_TRANSIT

### Status Transitions
- [ ] CREATED → ASSIGNED → IN_TRANSIT → DELIVERED
- [ ] Cancellation flows work
- [ ] Invalid transitions blocked

### Route Simulation
- [ ] Starts on IN_TRANSIT
- [ ] Stops on DELIVERED
- [ ] Stops on cancellation

### Tenant Isolation
- [ ] Cannot access other tenant data
- [ ] All queries filtered by tenantId

---

## 🛠️ Useful Commands

```bash
# Check backend logs
tail -f backend/logs/app.log

# Check Redis
redis-cli
> KEYS *
> GET driver:location:<driver-id>

# Check database
psql -U postgres -d opscore
> SELECT * FROM shipments;
> SELECT * FROM users;
```

---

## 📚 Full Documentation

- **Complete Test Guide**: `TEST_GUIDE.md`
- **Detailed Scenarios**: `backend/TEST_SCENARIOS.md`
- **Test Report**: `backend/TEST_REPORT.md`
- **API Docs**: http://localhost:3000/docs

---

## 💡 Pro Tips

1. **Use Postman Collections**: Save all requests for easy reuse
2. **Environment Variables**: Store tokens and IDs in Postman env
3. **Check Logs**: Always monitor backend logs during testing
4. **Test Edge Cases**: Don't just test happy paths
5. **Verify Database**: Check database directly to verify changes

---

**Happy Testing! 🎯**

