# Route Simulation Feature

## Overview

When a driver is assigned to a shipment, the system automatically simulates the driver's movement from the **pickup address** to the **delivery address**. This allows you to test and demonstrate real-time location tracking without requiring physical movement.

## How It Works

### 1. **When Simulation Starts**
- Automatically triggered when a driver is assigned to a shipment via `/v1/shipments/:id/assign-driver`
- The system geocodes both pickup and delivery addresses to get coordinates
- Calculates 100 intermediate points along a straight-line route
- Starts updating the driver's location every 3 seconds

### 2. **Location Updates**
- Driver location is updated every 3 seconds
- Each update moves the driver closer to the delivery address
- Updates are stored in Redis and broadcast via Socket.IO
- The simulation takes approximately **5 minutes** to complete (100 steps × 3 seconds)

### 3. **When Simulation Stops**
- Automatically stops when the driver reaches the delivery address
- Stops when shipment status changes to `DELIVERED` or `CREATED`
- Stops if the driver is reassigned to a different shipment (old simulation stops, new one starts)

## Areas Changed

### 1. **New Service: `RouteSimulationService`**
**File:** `backend/src/modules/shipments/services/route-simulation.service.ts`

**Responsibilities:**
- Geocoding addresses using OpenStreetMap Nominatim API
- Calculating route points (linear interpolation between pickup and delivery)
- Managing active simulations (start/stop)
- Updating driver locations periodically
- Storing simulation state in Redis

**Key Methods:**
- `startSimulation()` - Starts simulation for a driver
- `stopSimulation()` - Stops simulation for a specific driver
- `stopSimulationByShipment()` - Stops all simulations for a shipment
- `geocodeAddress()` - Converts address string to coordinates
- `calculateRoutePoints()` - Generates intermediate points along route

### 2. **Updated Controller: `shipments.controller.ts`**
**File:** `backend/src/modules/shipments/controllers/shipments.controller.ts`

**Changes:**
- **`assignDriverHandler`**: Starts route simulation after driver assignment
- **`updateStatusHandler`**: Stops simulation when shipment is delivered or status changes

### 3. **Data Storage**

**Redis Keys:**
- `simulation:{tenantId}:{driverId}` - Stores simulation state (TTL: 1 hour)

**In-Memory Storage:**
- `activeSimulations` Map - Tracks active simulations with interval IDs for cleanup

## Configuration

### Simulation Parameters

Located in `RouteSimulationService`:

```typescript
private readonly UPDATE_INTERVAL_MS = 3000; // Update every 3 seconds
private readonly SIMULATION_STEPS = 100; // Number of steps from pickup to delivery
```

**To adjust simulation speed:**
- **Faster**: Reduce `UPDATE_INTERVAL_MS` (e.g., 1000ms = 1 second updates)
- **Slower**: Increase `UPDATE_INTERVAL_MS` (e.g., 5000ms = 5 second updates)
- **More steps**: Increase `SIMULATION_STEPS` for smoother movement
- **Fewer steps**: Decrease `SIMULATION_STEPS` for faster completion

## Geocoding

The system uses **OpenStreetMap Nominatim API** (free, no API key required) to convert addresses to coordinates.

**Rate Limits:**
- Nominatim allows 1 request per second
- The system makes 2 requests per simulation (pickup + delivery)
- If geocoding fails, the assignment still succeeds, but simulation won't start

**Example:**
- Input: `"123 Main St, New York, NY 10001"`
- Output: `{ lat: 40.7128, lng: -74.0060 }`

## Route Calculation

Uses **OSRM (Open Source Routing Machine)** for actual road-based routing:
- Gets real route following actual roads and streets
- Uses free public OSRM server (no API key required)
- Falls back to linear interpolation if OSRM is unavailable
- Interpolates route points for smooth movement (100 steps)
- Driver follows the actual road network on the map

**OSRM API:**
- Public demo server: `http://router.project-osrm.org`
- Returns GeoJSON LineString with waypoints along the route
- Handles route optimization and road network navigation

## Testing

### Manual Test Flow

1. **Create a shipment** with pickup and delivery addresses:
   ```bash
   POST /v1/shipments
   {
     "pickupAddress": "Times Square, New York, NY",
     "deliveryAddress": "Central Park, New York, NY",
     "customerName": "John Doe",
     "customerPhone": "+1234567890"
   }
   ```

2. **Assign a driver** to the shipment:
   ```bash
   POST /v1/shipments/{shipmentId}/assign-driver
   {
     "driverId": "driver-uuid"
   }
   ```

3. **Watch the driver move** on the dashboard or shipment details page
   - Driver starts at pickup location
   - Moves toward delivery location every 3 seconds
   - Reaches delivery after ~5 minutes

### Verification

- Check Redis for simulation state:
  ```bash
  redis-cli GET simulation:{tenantId}:{driverId}
  ```

- Monitor Socket.IO events:
  - Event: `driver-location-update`
  - Source: `SIMULATED`

## Error Handling

- **Geocoding failures**: Logged as warning, assignment still succeeds
- **Redis failures**: Simulation continues in memory, but state may be lost on restart
- **Socket.IO unavailable**: Location updates still stored in Redis, but no real-time broadcast

## Limitations

1. **Fixed speed**: All simulations move at the same rate
2. **No traffic simulation**: Doesn't account for traffic, stops, or delays
3. **Single simulation per driver**: If a driver is reassigned, old simulation stops
4. **OSRM dependency**: Falls back to straight-line if OSRM service is unavailable

## Future Enhancements

1. **Variable speed**: Simulate different speeds (city vs highway) based on road type
2. **Traffic simulation**: Add delays and stops based on real-time traffic data
3. **Multiple routes**: Support multiple delivery stops
4. **Pause/Resume**: Allow pausing and resuming simulations
5. **Speed control**: Allow adjusting simulation speed via API
6. **Alternative routing services**: Support Mapbox/Google Maps as fallback options

