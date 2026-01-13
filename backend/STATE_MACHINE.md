# 📊 Shipment State Machine Guide

## State Flow

The shipment follows a strict state machine with these valid transitions:

```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

## Valid Transitions

| Current Status | Valid Next Status | Description |
|---------------|-------------------|-------------|
| `CREATED` | `ASSIGNED` | Shipment is created and ready for driver assignment |
| `ASSIGNED` | `PICKED_UP` | Driver has been assigned and picked up the shipment |
| `PICKED_UP` | `IN_TRANSIT` | Shipment is on the way to delivery |
| `IN_TRANSIT` | `DELIVERED` | Shipment has been delivered |
| `DELIVERED` | *(none)* | Terminal state - no further transitions |

## ❌ Invalid Transitions

- **Cannot go backwards:** `ASSIGNED` → `CREATED` ❌
- **Cannot skip states:** `CREATED` → `PICKED_UP` ❌ (must go through `ASSIGNED`)
- **Cannot skip states:** `ASSIGNED` → `IN_TRANSIT` ❌ (must go through `PICKED_UP`)
- **Terminal state:** `DELIVERED` cannot transition to any other state ❌

## ✅ Example Valid Flow

1. **Create Shipment** → Status: `CREATED`
2. **Assign Driver** → Status: `ASSIGNED`
3. **Update Status** → Status: `PICKED_UP`
4. **Update Status** → Status: `IN_TRANSIT`
5. **Update Status** → Status: `DELIVERED`

## 🔧 API Usage

### Assign Driver (CREATED → ASSIGNED)
```bash
POST /v1/shipments/:id/assign-driver
{
  "driverId": "driver-uuid"
}
```

### Update Status (ASSIGNED → PICKED_UP)
```bash
POST /v1/shipments/:id/status
{
  "status": "PICKED_UP"
}
```

### Update Status (PICKED_UP → IN_TRANSIT)
```bash
POST /v1/shipments/:id/status
{
  "status": "IN_TRANSIT"
}
```

### Update Status (IN_TRANSIT → DELIVERED)
```bash
POST /v1/shipments/:id/status
{
  "status": "DELIVERED"
}
```

## 📝 Status Timestamps

Each status transition automatically sets a timestamp:

- `assignedAt` - Set when status becomes `ASSIGNED`
- `pickedUpAt` - Set when status becomes `PICKED_UP`
- `deliveredAt` - Set when status becomes `DELIVERED`

## 🎯 Testing State Machine

### Test Valid Transitions
```bash
# 1. Create shipment (CREATED)
POST /v1/shipments

# 2. Assign driver (CREATED → ASSIGNED)
POST /v1/shipments/:id/assign-driver

# 3. Update to PICKED_UP (ASSIGNED → PICKED_UP)
POST /v1/shipments/:id/status
{"status": "PICKED_UP"}

# 4. Update to IN_TRANSIT (PICKED_UP → IN_TRANSIT)
POST /v1/shipments/:id/status
{"status": "IN_TRANSIT"}

# 5. Update to DELIVERED (IN_TRANSIT → DELIVERED)
POST /v1/shipments/:id/status
{"status": "DELIVERED"}
```

### Test Invalid Transitions (Should Fail)
```bash
# Try to go backwards
POST /v1/shipments/:id/status
{"status": "CREATED"}  # ❌ Error if current status is ASSIGNED

# Try to skip states
POST /v1/shipments/:id/status
{"status": "IN_TRANSIT"}  # ❌ Error if current status is ASSIGNED

# Try to transition from terminal state
POST /v1/shipments/:id/status
{"status": "ASSIGNED"}  # ❌ Error if current status is DELIVERED
```

## 🔍 Error Response

When an invalid transition is attempted, you'll get:

```json
{
  "success": false,
  "error_code": "INVALID_SHIPMENT_STATE",
  "message": "Cannot transition from ASSIGNED to CREATED. Valid next states: PICKED_UP",
  "details": {
    "currentStatus": "ASSIGNED",
    "attemptedStatus": "CREATED",
    "validTransitions": ["PICKED_UP"],
    "stateFlow": "CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED"
  }
}
```

## 💡 Tips

1. **Always check current status** before attempting a transition
2. **Follow the flow sequentially** - don't skip states
3. **Use assign-driver endpoint** to go from CREATED to ASSIGNED
4. **Use status endpoint** for all other transitions
5. **DELIVERED is terminal** - once delivered, no further changes

## 📚 Related Documentation

- **API Testing Guide:** `API_TESTING_GUIDE.md`
- **Swagger UI:** http://localhost:3000/docs

