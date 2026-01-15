# Application Segregation & Seeder Plan

## Overview
Segregate the application into three distinct sides with role-based access control and create comprehensive seeders for complete flow testing.

---

## Three Sides Architecture

### 1. **Admin Side** (OPS_ADMIN, DISPATCHER)
**Access Level:** Full Management

**Features:**
- ✅ Create shipments
- ✅ View all shipments (all statuses)
- ✅ Assign drivers to shipments
- ✅ Update shipment status (all transitions)
- ✅ View all drivers
- ✅ Manage drivers (create, update, deactivate)
- ✅ Dashboard with full statistics
- ✅ Real-time driver location tracking
- ✅ View shipment details

**Routes:**
- `GET /v1/shipments` - All shipments
- `GET /v1/shipments/:id` - Shipment details
- `POST /v1/shipments` - Create shipment
- `POST /v1/shipments/:id/assign-driver` - Assign driver
- `POST /v1/shipments/:id/status` - Update status
- `GET /v1/drivers` - All drivers
- `GET /v1/drivers/:id` - Driver details
- `GET /v1/dashboard/summary` - Dashboard stats

---

### 2. **Driver Side** (DRIVER)
**Access Level:** Limited - Assigned Shipments Only

**Features:**
- ✅ View assigned shipments only
- ✅ Update shipment status (PICKED_UP → IN_TRANSIT → DELIVERED)
- ✅ Share location (real-time)
- ✅ View shipment details (assigned only)
- ❌ Cannot create shipments
- ❌ Cannot assign drivers
- ❌ Cannot view other drivers
- ❌ Cannot view all shipments

**Routes:**
- `GET /v1/shipments` - Only assigned shipments (filtered)
- `GET /v1/shipments/:id` - Only if assigned to driver
- `POST /v1/shipments/:id/status` - Only status updates (PICKED_UP, IN_TRANSIT, DELIVERED)
- `POST /v1/drivers/:id/location` - Update own location (driverId must match)

---

### 3. **Customer Side** (Public or CUSTOMER role)
**Access Level:** Read-Only - Own Shipments

**Features:**
- ✅ Track shipment by tracking number/phone
- ✅ View shipment status
- ✅ View shipment details (pickup/delivery address, status, driver info)
- ❌ Cannot create shipments (via API - admin creates)
- ❌ Cannot update anything

**Routes:**
- `GET /v1/shipments/track/:trackingNumber` - Track by tracking number
- `GET /v1/shipments/track/phone/:phone` - Track by phone number
- `GET /v1/shipments/:id` - View shipment (public or with tracking code)

**Note:** Customer side might be public (no auth) or have a CUSTOMER role. We'll implement public tracking first.

---

## Implementation Plan

### Phase 1: Role-Based Access Control (RBAC)

1. **Create Role Guard/Middleware**
   - `requireRole(roles: UserRole[])` - Check if user has required role
   - Apply to routes based on access level

2. **Update Routes with Role Guards**
   - Admin routes: `requireRole([UserRole.OPS_ADMIN, UserRole.DISPATCHER])`
   - Driver routes: `requireRole([UserRole.DRIVER])`
   - Customer routes: Public (no auth required)

3. **Update Services**
   - Filter shipments by driver assignment for DRIVER role
   - Filter shipments by customer phone for CUSTOMER role

---

### Phase 2: Comprehensive Seeder

**Seeder Structure:**

```
Tenant 1: "Acme Logistics" (slug: acme-logistics)
├── Admin Users (2)
│   ├── admin@acme.com (OPS_ADMIN)
│   └── dispatcher@acme.com (DISPATCHER)
├── Drivers (5)
│   ├── driver1@acme.com (DRIVER) + Driver entity
│   ├── driver2@acme.com (DRIVER) + Driver entity
│   ├── driver3@acme.com (DRIVER) + Driver entity
│   ├── driver4@acme.com (DRIVER) + Driver entity
│   └── driver5@acme.com (DRIVER) + Driver entity
└── Shipments (10)
    ├── 2x CREATED (unassigned)
    ├── 2x ASSIGNED (assigned to drivers)
    ├── 2x PICKED_UP (in progress)
    ├── 2x IN_TRANSIT (on the way)
    └── 2x DELIVERED (completed)

Tenant 2: "Global Shipping" (slug: global-shipping)
├── Admin Users (2)
├── Drivers (3)
└── Shipments (6)
    └── Various statuses
```

**Seeder Data:**
- Realistic names, emails, phone numbers
- Different addresses for shipments
- Complete status history for shipments
- Drivers linked to User accounts

---

## File Structure

```
backend/src/
├── shared/
│   └── guards/
│       └── role.guard.ts          # Role-based access control
├── modules/
│   ├── shipments/
│   │   └── services/
│   │       └── shipments.service.ts  # Add role-based filtering
│   └── drivers/
│       └── services/
│           └── drivers.service.ts    # Add role-based filtering
└── scripts/
    └── seed-complete.ts              # Comprehensive seeder
```

---

## Next Steps

1. ✅ Create role guard middleware
2. ✅ Update routes with role guards
3. ✅ Update services to filter by role
4. ✅ Create comprehensive seeder
5. ✅ Test all three sides

---

## Questions to Confirm

1. **Customer Side:** Should it be public (no auth) or require CUSTOMER role?
2. **Tracking:** How should customers track shipments? (tracking number, phone, email?)
3. **Driver Access:** Should drivers see only their assigned shipments or all shipments (read-only)?
4. **Dispatcher vs Admin:** Should DISPATCHER have same access as OPS_ADMIN or limited?

