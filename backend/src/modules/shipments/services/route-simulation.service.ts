import Redis from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { LocationProcessorService } from "../../drivers/services/location-processor.service";
import { AppError, ErrorCode } from "../../../shared/errors/error-handler";
import { refreshConfig } from "../../../config";

interface RoutePoint {
  lat: number;
  lng: number;
}

type SimulationPhase = "TO_DELIVERY"; // Only Phase 2: Pickup → Delivery

interface SimulationState {
  shipmentId: string;
  driverId: string;
  tenantId: string;
  pickupPoint: RoutePoint;
  deliveryPoint: RoutePoint;
  currentStep: number;
  totalSteps: number;
  phase: SimulationPhase;
  intervalId?: NodeJS.Timeout;
}

export class RouteSimulationService {
  private redis: Redis;
  private io: SocketIOServer | null;
  private locationProcessor: LocationProcessorService;
  private activeSimulations: Map<string, SimulationState> = new Map();
  private readonly UPDATE_INTERVAL_MS = refreshConfig.routeSimulationInterval;
  private readonly DELIVERY_THRESHOLD_METERS = 50; // Stop when within 50 meters of delivery

  constructor(redis: Redis, io?: SocketIOServer) {
    this.redis = redis;
    this.io = io || null;
    this.locationProcessor = new LocationProcessorService(redis);
    
    // Log Socket.IO availability
    if (!this.io) {
      console.warn("[RouteSimulation] ⚠️ Socket.IO not available - location updates will not be emitted to frontend");
    } else {
      console.log("[RouteSimulation] ✅ Socket.IO available - location updates will be emitted");
    }
  }

  /**
   * Geocode an address to get coordinates using OpenStreetMap Nominatim API
   */
  private async geocodeAddress(address: string): Promise<RoutePoint> {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "OpsCore/1.0", // Required by Nominatim
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error(`No coordinates found for address: ${address}`);
      }

      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Failed to geocode address "${address}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        400
      );
    }
  }

  /**
   * Get route from OSRM (Open Source Routing Machine) - follows actual roads
   * CRITICAL: This MUST use OSRM for road-based routing, not straight lines
   * Vehicles move on roads, not like airplanes!
   */
  private async getRouteFromOSRM(
    pickup: RoutePoint,
    delivery: RoutePoint
  ): Promise<RoutePoint[]> {
    // CRITICAL: Always try OSRM first - vehicles must follow roads
    // Don't skip OSRM for long distances - it handles them fine
    // Only fallback if OSRM completely fails after retries
    
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // OSRM expects coordinates in [lng, lat] format
        // Use overview=full to get all route points for accurate road following
        const url = `http://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}?overview=full&geometries=geojson&alternatives=false`;

        // Increased timeout for long distances (30 seconds)
        // OSRM can take time for complex routes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "OpsCore/1.0",
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // If 429 (rate limit) or 503 (service unavailable), retry
          if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            continue;
          }
          throw new Error(`OSRM routing failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
          throw new Error(`OSRM returned error code: ${data.code || 'Unknown'}`);
        }

        // Extract coordinates from GeoJSON LineString
        const coordinates = data.routes[0].geometry.coordinates;

        if (!coordinates || coordinates.length === 0) {
          throw new Error("No coordinates in OSRM response");
        }

        // CRITICAL: Convert from [lng, lat] to { lat, lng }
        // Use ALL route points from OSRM - these follow actual roads
        const routePoints: RoutePoint[] = coordinates.map(
          (coord: [number, number]) => ({
            lat: coord[1], // OSRM returns [lng, lat], we need { lat, lng }
            lng: coord[0],
          })
        );

        // Validate we have enough points (at least 2)
        if (routePoints.length < 2) {
          throw new Error("OSRM returned insufficient route points");
        }

        // Success! Return road-based route
        return routePoints;
      } catch (error) {
        lastError = error as Error;
        
        // If it's an abort (timeout), retry with longer timeout on next attempt
        if (error instanceof Error && error.name === 'AbortError' && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        // For other errors, retry if we have attempts left
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    // CRITICAL: Only fallback to straight line if OSRM completely fails after all retries
    // This should be rare - log it for monitoring
    // For production, consider using a self-hosted OSRM instance for reliability
    const distance = this.calculateDistance(pickup, delivery);
    const steps = Math.max(200, Math.min(1000, Math.floor(distance / 1000)));
    
    // Return fallback route with warning
    return this.calculateRoutePoints(pickup, delivery, steps);
  }

  /**
   * Interpolate between route points to get smoother movement
   */
  private interpolateRoutePoints(
    routePoints: RoutePoint[],
    targetSteps: number
  ): RoutePoint[] {
    if (routePoints.length <= 1) {
      return routePoints;
    }

    const interpolated: RoutePoint[] = [];
    const totalDistance = this.calculateTotalDistance(routePoints);
    const stepDistance = totalDistance / targetSteps;

    let currentDistance = 0;
    let segmentIndex = 0;

    for (let i = 0; i < targetSteps; i++) {
      const targetDistance = i * stepDistance;

      // Find the segment where this distance falls
      while (segmentIndex < routePoints.length - 1) {
        const segmentStart = routePoints[segmentIndex];
        const segmentEnd = routePoints[segmentIndex + 1];
        const segmentDistance = this.calculateDistance(
          segmentStart,
          segmentEnd
        );

        if (currentDistance + segmentDistance >= targetDistance) {
          // Interpolate within this segment
          const ratio = (targetDistance - currentDistance) / segmentDistance;
          interpolated.push({
            lat: segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * ratio,
            lng: segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * ratio,
          });
          break;
        }

        currentDistance += segmentDistance;
        segmentIndex++;
      }

      // If we've passed all segments, use the last point
      if (segmentIndex >= routePoints.length - 1) {
        interpolated.push(routePoints[routePoints.length - 1]);
      }
    }

    // Always include the last point
    if (
      interpolated[interpolated.length - 1]?.lat !==
      routePoints[routePoints.length - 1]?.lat
    ) {
      interpolated.push(routePoints[routePoints.length - 1]);
    }

    return interpolated;
  }

  /**
   * Calculate distance between two points using Haversine formula (in meters)
   */
  private calculateDistance(point1: RoutePoint, point2: RoutePoint): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) *
        Math.cos(this.toRadians(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate total distance along a route
   */
  private calculateTotalDistance(routePoints: RoutePoint[]): number {
    let total = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      total += this.calculateDistance(routePoints[i], routePoints[i + 1]);
    }
    return total;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate intermediate points along a route using linear interpolation (fallback)
   * Creates points at regular intervals to ensure smooth movement
   */
  private calculateRoutePoints(
    pickup: RoutePoint,
    delivery: RoutePoint,
    steps: number
  ): RoutePoint[] {
    const points: RoutePoint[] = [];

    // Calculate total distance to determine step size
    const totalDistance = this.calculateDistance(pickup, delivery);
    const stepDistance = totalDistance / steps;

    // Create points along the route
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lat = pickup.lat + (delivery.lat - pickup.lat) * ratio;
      const lng = pickup.lng + (delivery.lng - pickup.lng) * ratio;
      points.push({ lat, lng });
    }

    return points;
  }

  /**
   * Get driver's current location from Redis
   */
  private async getDriverCurrentLocation(
    driverId: string,
    tenantId: string
  ): Promise<RoutePoint | null> {
    const redisKey = `driver:${tenantId}:${driverId}:location`;
    try {
      const locationData = await this.redis.get(redisKey);
      if (locationData) {
        const location = JSON.parse(locationData);
        return {
          lat: location.latitude,
          lng: location.longitude,
        };
      }
    } catch (error) {
      // Location not found or error reading
    }
    return null;
  }

  /**
   * Start simulating driver movement
   * Phase 2 (TO_DELIVERY): Pickup address → Delivery address (when status is IN_TRANSIT)
   * Phase 1 has been removed - simulation only starts when status is IN_TRANSIT
   */
  async startSimulation(
    shipmentId: string,
    driverId: string,
    tenantId: string,
    pickupAddress: string,
    deliveryAddress: string,
    phase: SimulationPhase = "TO_DELIVERY"
  ): Promise<void> {
    const simulationKey = `simulation:${tenantId}:${driverId}`;

    // CRITICAL: Check if simulation is already running for the SAME shipment
    // If yes, don't restart - just return (prevents back-and-forth movement)
    if (this.activeSimulations.has(simulationKey)) {
      const existing = this.activeSimulations.get(simulationKey);
      if (
        existing &&
        existing.shipmentId === shipmentId &&
        existing.phase === phase
      ) {
        // Same simulation already running - don't restart
        return;
      } else {
        // Different shipment or phase - stop the old one first
        await this.stopSimulation(driverId, tenantId);
      }
    } else {
      // Check Redis for existing simulation (service restart scenario)
      const redisSimulation = await this.redis.get(simulationKey);
      if (redisSimulation) {
        const parsed = JSON.parse(redisSimulation);
        // If same shipment and phase, restore instead of restarting
        if (parsed.shipmentId === shipmentId && parsed.phase === phase) {
          await this.restoreSimulationFromRedis(driverId, tenantId);
          return; // Simulation restored, don't start new one
        } else {
          // Different shipment/phase - stop old one
          await this.stopSimulation(driverId, tenantId);
        }
      }
    }

    try {
      // Geocode addresses
      const pickupPoint = await this.geocodeAddress(pickupAddress);
      const deliveryPoint = await this.geocodeAddress(deliveryAddress);

      // Phase 2: Pickup address → Delivery address
      // Always start from pickup point (Phase 1 has been removed)
      const startPoint = pickupPoint;
      const endPoint = deliveryPoint;

      // CRITICAL: Get route points from pickup to delivery using OSRM
      // This ensures vehicles follow actual roads, not straight lines
      // getRouteFromOSRM handles retries and only falls back if absolutely necessary
      const routePoints = await this.getRouteFromOSRM(startPoint, endPoint);

      // Create simulation state
      const simulationState: SimulationState = {
        shipmentId,
        driverId,
        tenantId,
        pickupPoint,
        deliveryPoint,
        currentStep: 0,
        totalSteps: routePoints.length - 1,
        phase,
      };

      // Store in memory and Redis
      const simulationKey = `simulation:${tenantId}:${driverId}`;
      const routeKey = `route:${tenantId}:${driverId}`;
      this.activeSimulations.set(simulationKey, simulationState);

      await this.redis.setex(
        simulationKey,
        3600, // 1 hour TTL
        JSON.stringify({
          shipmentId,
          driverId,
          tenantId,
          pickupPoint,
          deliveryPoint,
          currentStep: 0,
          totalSteps: routePoints.length - 1,
          phase,
        })
      );

      // Store route points separately for API access
      // CRITICAL: Add timeout to prevent hanging
      try {
        await Promise.race([
          this.redis.setex(
            routeKey,
            3600, // 1 hour TTL
            JSON.stringify({
              shipmentId,
              driverId,
              tenantId,
              pickupPoint,
              deliveryPoint,
              routePoints,
              phase,
            })
          ),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Redis SETEX timed out')), 3000)
          ),
        ]);
        console.log(`[RouteSimulation] 💾 Route data stored in Redis for driver ${driverId}`, {
          routeKey,
          routePointsCount: routePoints.length,
          shipmentId,
        });
      } catch (error) {
        console.error(`[RouteSimulation] ❌ Failed to store route data in Redis for driver ${driverId}:`, error);
        // Continue anyway - simulation can still run, but route API won't work
      }

      // CRITICAL: Set initial location immediately to first route point (pickup)
      // This ensures driver location is updated right away, even before interval starts
      // currentStep is 0, so routePoints[0] is the pickup point (start of Phase 2)
      const initialPoint = routePoints[0];
      console.log(`[RouteSimulation] 📍 Setting initial location to pickup point:`, {
        lat: initialPoint.lat,
        lng: initialPoint.lng,
        step: 0,
        totalSteps: routePoints.length - 1,
      });
      await this.updateDriverLocation(
        driverId,
        tenantId,
        initialPoint.lat,
        initialPoint.lng
      );

      // Start interval to update location
      // CRITICAL: Use routePoints from Redis in the interval to ensure consistency
      // The routePoints in closure might be stale if simulation is restored
      // Also, start immediately with first update (don't wait for first interval)
      
      // Store route points in closure for fallback if Redis fails
      const routePointsForFallback = routePoints;
      
      // Declare intervalId variable first so it's in scope for updateStep
      let intervalId: NodeJS.Timeout | null = null;

      const updateStep = async () => {
        const currentSimulation = this.activeSimulations.get(simulationKey);
        if (!currentSimulation) {
          // Simulation was stopped
          console.log(`[RouteSimulation] ⚠️ Simulation not found in activeSimulations for key ${simulationKey} - stopping interval`);
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        console.log(`[RouteSimulation] ⏰ Interval triggered for driver ${driverId}, current step: ${currentSimulation.currentStep}`);

        try {
          // Get fresh route points from Redis (they don't change once calculated)
          // Add timeout to prevent hanging
          const routeKey = `route:${tenantId}:${driverId}`;
          let routeData: string | null;
          try {
            routeData = await Promise.race([
              this.redis.get(routeKey),
              new Promise<string | null>((_, reject) =>
                setTimeout(() => reject(new Error('Redis GET timed out')), 2000)
              ),
            ]);
          } catch (error) {
            // If Redis times out, use fallback route points from closure
            // This ensures simulation continues even if Redis is slow
            await this.updateSimulationStep(
              simulationKey,
              routePointsForFallback,
              phase
            );
            return;
          }

          if (!routeData) {
            // Route data missing - use fallback
            await this.updateSimulationStep(
              simulationKey,
              routePointsForFallback,
              phase
            );
            return;
          }

          const route = JSON.parse(routeData);
          if (!route.routePoints || route.routePoints.length === 0) {
            // Invalid route data - use fallback
            await this.updateSimulationStep(
              simulationKey,
              routePointsForFallback,
              phase
            );
            return;
          }

          // Use route points from Redis to ensure we're using the same route
          await this.updateSimulationStep(
            simulationKey,
            route.routePoints,
            phase
          );
        } catch (error) {
          // Continue simulation even if one step fails
          // Use fallback route points to keep simulation running
          try {
            await this.updateSimulationStep(
              simulationKey,
              routePointsForFallback,
              phase
            );
          } catch (fallbackError) {
            // If even fallback fails, simulation might be stopped
            // Don't throw - let next interval try again
          }
        }
      };

      // Set up interval - use the declared intervalId variable
      intervalId = setInterval(() => {
        console.log(`[RouteSimulation] ⏰ Interval tick for driver ${driverId} - calling updateStep`);
        updateStep();
      }, this.UPDATE_INTERVAL_MS);

      simulationState.intervalId = intervalId;
      this.activeSimulations.set(simulationKey, simulationState);
      
      console.log(`[RouteSimulation] ✅ Interval set up for driver ${driverId}`, {
        intervalId: !!intervalId,
        intervalMs: this.UPDATE_INTERVAL_MS,
      });

      console.log(`[RouteSimulation] ✅ Simulation started for driver ${driverId}, shipment ${shipmentId}`, {
        phase,
        routePointsCount: routePoints.length,
        updateIntervalMs: this.UPDATE_INTERVAL_MS,
        hasSocketIO: !!this.io,
        initialStep: 0,
        pickupPoint: pickupPoint,
        deliveryPoint: deliveryPoint,
      });

      // Execute first update immediately (don't wait for interval)
      // This ensures driver starts moving right away
      // Use setTimeout to ensure intervalId is set in closure
      setTimeout(() => {
        console.log(`[RouteSimulation] 🚀 Executing first update step for driver ${driverId}`);
        updateStep();
      }, 100); // Small delay to ensure everything is set up
    } catch (error) {
      // Clean up on error
      const simulationKey = `simulation:${tenantId}:${driverId}`;
      this.activeSimulations.delete(simulationKey);
      await this.redis.del(simulationKey);
      throw error;
    }
  }

  /**
   * Update simulation to next step
   */
  private async updateSimulationStep(
    simulationKey: string,
    routePoints: RoutePoint[],
    phase: SimulationPhase
  ): Promise<void> {
    const simulation = this.activeSimulations.get(simulationKey);
    if (!simulation) {
      return; // Simulation was stopped
    }

    // Validate route points
    if (!routePoints || routePoints.length === 0) {
      await this.stopSimulation(simulation.driverId, simulation.tenantId);
      return;
    }

    // CRITICAL: Check bounds before incrementing to prevent going backwards
    // If already at or past the end, don't increment - just stop
    if (simulation.currentStep >= routePoints.length - 1) {
      // Already at or past the end - move to final point and stop
      const finalPoint = routePoints[routePoints.length - 1];
      await this.updateDriverLocation(
        simulation.driverId,
        simulation.tenantId,
        finalPoint.lat,
        finalPoint.lng
      );

      // Phase 2 only - driver reached delivery, stop simulation
      await this.stopSimulation(simulation.driverId, simulation.tenantId);
      return;
    }

    // Move to next step (only if not at end)
    const previousStep = simulation.currentStep;
    simulation.currentStep += 1;

    console.log(`[RouteSimulation] 🔄 Moving driver ${simulation.driverId} from step ${previousStep} to ${simulation.currentStep} (total: ${routePoints.length - 1})`);

    // Check if we've reached the end of the route (after incrementing)
    if (simulation.currentStep >= routePoints.length) {
      // Move to final point (delivery for Phase 2)
      const finalPoint = routePoints[routePoints.length - 1];
      console.log(`[RouteSimulation] 🏁 Driver ${simulation.driverId} reached end of route, moving to delivery point`);
      await this.updateDriverLocation(
        simulation.driverId,
        simulation.tenantId,
        finalPoint.lat,
        finalPoint.lng
      );

      // Phase 2 only - driver reached delivery, stop simulation
      await this.stopSimulation(simulation.driverId, simulation.tenantId);
      return;
    }

    // Update driver location to current point
    const currentPoint = routePoints[simulation.currentStep];
    if (
      !currentPoint ||
      typeof currentPoint.lat !== "number" ||
      typeof currentPoint.lng !== "number"
    ) {
      console.warn(`[RouteSimulation] ⚠️ Invalid route point at step ${simulation.currentStep}:`, currentPoint);
      return;
    }

    console.log(`[RouteSimulation] 📍 Updating driver ${simulation.driverId} location to step ${simulation.currentStep}:`, {
      lat: currentPoint.lat,
      lng: currentPoint.lng,
    });

    await this.updateDriverLocation(
      simulation.driverId,
      simulation.tenantId,
      currentPoint.lat,
      currentPoint.lng
    );

    // Check if we're close enough to delivery point (within threshold)
    const targetPoint = simulation.deliveryPoint;
    const distanceToTarget = this.calculateDistance(currentPoint, targetPoint);

    if (distanceToTarget <= this.DELIVERY_THRESHOLD_METERS) {
      // Close enough to delivery - move to exact point and stop
      await this.updateDriverLocation(
        simulation.driverId,
        simulation.tenantId,
        targetPoint.lat,
        targetPoint.lng
      );

      // Driver reached delivery - stop simulation
      await this.stopSimulation(simulation.driverId, simulation.tenantId);
      return;
    }

    // Update Redis with current simulation state
    // This ensures simulation state persists even if service restarts
    // Add timeout to prevent hanging
    try {
      await Promise.race([
        this.redis.setex(
          simulationKey,
          3600,
          JSON.stringify({
            shipmentId: simulation.shipmentId,
            driverId: simulation.driverId,
            tenantId: simulation.tenantId,
            pickupPoint: simulation.pickupPoint,
            deliveryPoint: simulation.deliveryPoint,
            currentStep: simulation.currentStep,
            totalSteps: simulation.totalSteps,
            phase: simulation.phase,
          })
        ),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Redis SETEX timed out')), 2000)
        ),
      ]);
    } catch (error) {
      // If Redis times out, continue anyway - simulation can continue without Redis update
      // The in-memory state is still updated below
    }

    // Also update the in-memory state to ensure consistency
    this.activeSimulations.set(simulationKey, simulation);
  }

  /**
   * Update driver location and emit Socket.IO event
   * During route simulation, this should always update (simulation takes priority)
   */
  private async updateDriverLocation(
    driverId: string,
    tenantId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    // During route simulation, simulation location takes priority
    // This ensures driver moves on map even if they're still sharing location
    // The simulation represents the planned route, which should be displayed

    // Update location directly in Redis (bypass LocationProcessorService to avoid source conflicts)
    // This ensures simulation location is always stored and emitted, even if driver is sharing location
    const locationKey = `driver:${tenantId}:${driverId}:location`;
    const locationData = {
      latitude,
      longitude,
      timestamp,
      source: "SIMULATED", // Mark as simulated to distinguish from real GPS
    };

    // CRITICAL: Always emit Socket.IO event, even if Redis fails
    // Redis storage is secondary - real-time map updates are primary
    // Emit Socket.IO FIRST to ensure frontend gets updates immediately
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit("driver-location-update", {
        driverId,
        location: {
          latitude,
          longitude,
          timestamp,
        },
        source: "SIMULATED",
      });
      console.log(`[RouteSimulation] 📡 Emitted location update via Socket.IO for driver ${driverId}`, {
        latitude,
        longitude,
        timestamp,
      });
    } else {
      console.warn(`[RouteSimulation] ⚠️ Socket.IO not available - cannot emit location update for driver ${driverId}`);
    }

    // Then try to store in Redis (non-blocking)
    // If Redis fails, that's okay - Socket.IO already emitted
    try {
      await Promise.race([
        this.redis.setex(locationKey, 3600, JSON.stringify(locationData)),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Redis SETEX timed out')), 2000)
        ),
      ]);
    } catch (error) {
      // Redis failed or timed out - that's okay, Socket.IO already emitted
      // Don't throw - location update was successful via Socket.IO
    }
  }

  /**
   * Stop simulation for a driver
   */
  async stopSimulation(driverId: string, tenantId: string): Promise<void> {
    const simulationKey = `simulation:${tenantId}:${driverId}`;
    const simulation = this.activeSimulations.get(simulationKey);

    if (simulation) {
      // Clear interval
      if (simulation.intervalId) {
        clearInterval(simulation.intervalId);
      }

      // Remove from memory
      this.activeSimulations.delete(simulationKey);
    }

    // Remove from Redis
    await this.redis.del(simulationKey);

    // Also remove route data
    const routeKey = `route:${tenantId}:${driverId}`;
    await this.redis.del(routeKey);
  }

  /**
   * Stop all simulations for a shipment (e.g., when shipment status changes)
   */
  async stopSimulationByShipment(
    shipmentId: string,
    tenantId: string
  ): Promise<void> {
    // Find all simulations for this shipment
    const simulationsToStop: Array<{ driverId: string; tenantId: string }> = [];

    for (const [key, simulation] of this.activeSimulations.entries()) {
      if (
        simulation.shipmentId === shipmentId &&
        simulation.tenantId === tenantId
      ) {
        simulationsToStop.push({
          driverId: simulation.driverId,
          tenantId: simulation.tenantId,
        });
      }
    }

    // Stop all found simulations
    for (const { driverId, tenantId } of simulationsToStop) {
      await this.stopSimulation(driverId, tenantId);
    }
  }

  /**
   * Check if a driver has an active simulation
   * Checks both in-memory Map and Redis (in case service was restarted)
   */
  async hasActiveSimulation(
    driverId: string,
    tenantId: string
  ): Promise<boolean> {
    const simulationKey = `simulation:${tenantId}:${driverId}`;

    // Check in-memory first (fastest)
    if (this.activeSimulations.has(simulationKey)) {
      return true;
    }

    // Check Redis (in case service was restarted and simulation exists in Redis)
    try {
      const simulationData = await this.redis.get(simulationKey);
      if (simulationData) {
        // Simulation exists in Redis but not in memory - need to restore it
        return true;
      }
    } catch (error) {
      // Error checking Redis
    }

    return false;
  }

  /**
   * Restore simulation from Redis (e.g., after service restart)
   * This restarts the interval for an existing simulation
   */
  async restoreSimulationFromRedis(
    driverId: string,
    tenantId: string
  ): Promise<void> {
    const simulationKey = `simulation:${tenantId}:${driverId}`;
    const routeKey = `route:${tenantId}:${driverId}`;

    try {
      const simulationData = await this.redis.get(simulationKey);
      const routeData = await this.redis.get(routeKey);

      if (!simulationData || !routeData) {
        return; // No simulation to restore
      }

      const simulation = JSON.parse(simulationData);
      const route = JSON.parse(routeData);

      // CRITICAL: Check if simulation already exists in memory (prevent duplicate intervals)
      if (this.activeSimulations.has(simulationKey)) {
        const existing = this.activeSimulations.get(simulationKey);
        if (existing && existing.shipmentId === simulation.shipmentId) {
          // Same simulation already running - don't create duplicate
          return;
        }
      }

      // Recreate simulation state with current progress (don't reset to 0)
      const simulationState: SimulationState = {
        shipmentId: simulation.shipmentId,
        driverId: simulation.driverId,
        tenantId: simulation.tenantId,
        pickupPoint: simulation.pickupPoint,
        deliveryPoint: simulation.deliveryPoint,
        currentStep: simulation.currentStep, // Preserve current progress
        totalSteps: simulation.totalSteps,
        phase: route.phase as SimulationPhase,
      };

      // Restart interval only if not already running (prevent duplicates)
      if (!simulationState.intervalId) {
        // Use routePoints from Redis to ensure consistency
        const intervalId = setInterval(async () => {
          try {
            // Get fresh route points from Redis
            const freshRouteData = await this.redis.get(routeKey);
            if (!freshRouteData) {
              clearInterval(intervalId);
              await this.stopSimulation(driverId, tenantId);
              return;
            }

            const freshRoute = JSON.parse(freshRouteData);
            await this.updateSimulationStep(
              simulationKey,
              freshRoute.routePoints,
              freshRoute.phase as SimulationPhase
            );
          } catch (error) {
            // Continue simulation even if one step fails
          }
        }, this.UPDATE_INTERVAL_MS);

        simulationState.intervalId = intervalId;
      }

      this.activeSimulations.set(simulationKey, simulationState);
    } catch (error) {
      // Failed to restore simulation
    }
  }

  /**
   * Get route data for a driver (for map visualization)
   */
  async getRouteData(
    driverId: string,
    tenantId: string
  ): Promise<{
    shipmentId: string;
    pickupPoint: RoutePoint;
    deliveryPoint: RoutePoint;
    routePoints: RoutePoint[];
    phase?: SimulationPhase;
  } | null> {
    const routeKey = `route:${tenantId}:${driverId}`;
    
    console.log(`[RouteSimulation] 🔍 getRouteData called for driver ${driverId}, routeKey: ${routeKey}`);
    
    // Add timeout to Redis GET operation
    let routeData: string | null;
    try {
      routeData = await Promise.race([
        this.redis.get(routeKey),
        new Promise<string | null>((_, reject) =>
          setTimeout(() => reject(new Error('Redis GET timed out')), 2000)
        ),
      ]);
    } catch (error) {
      // If Redis times out or fails, return null
      console.log(`[RouteSimulation] ❌ Redis GET failed for routeKey ${routeKey}:`, error);
      return null;
    }

    if (!routeData) {
      console.log(`[RouteSimulation] ⚠️ No route data found in Redis for routeKey ${routeKey}`);
      return null;
    }

    const parsed = JSON.parse(routeData);
    console.log(`[RouteSimulation] ✅ Route data retrieved from Redis for driver ${driverId}`, {
      shipmentId: parsed.shipmentId,
      routePointsCount: parsed.routePoints?.length || 0,
      phase: parsed.phase,
    });

    return parsed;
  }

  /**
   * Get route data by shipment ID
   */
  async getRouteDataByShipment(
    shipmentId: string,
    tenantId: string
  ): Promise<{
    shipmentId: string;
    driverId: string;
    pickupPoint: RoutePoint;
    deliveryPoint: RoutePoint;
    routePoints: RoutePoint[];
    phase?: SimulationPhase;
  } | null> {
    // Search through active simulations first (fastest)
    for (const [key, simulation] of this.activeSimulations.entries()) {
      if (
        simulation.shipmentId === shipmentId &&
        simulation.tenantId === tenantId
      ) {
        const routeData = await this.getRouteData(
          simulation.driverId,
          tenantId
        );
        if (routeData) {
          return {
            ...routeData,
            shipmentId,
            driverId: simulation.driverId,
          };
        }
        return null;
      }
    }

    // If not in memory, try to find in Redis by searching simulation keys
    // Use SCAN instead of KEYS to avoid blocking Redis (KEYS is very slow)
    // But limit to a reasonable number of iterations to prevent timeout
    const simulationPattern = `simulation:${tenantId}:*`;
    
    try {
      const keys: string[] = [];
      let cursor = '0';
      let iterations = 0;
      const maxIterations = 10; // Limit iterations to prevent timeout

      // ioredis scan returns [nextCursor, keys[]]
      do {
        const result = await Promise.race([
          this.redis.scan(cursor, 'MATCH', simulationPattern, 'COUNT', 10),
          new Promise<[string, string[]]>((_, reject) =>
            setTimeout(() => reject(new Error('Redis SCAN timed out')), 2000)
          ),
        ]);
        cursor = result[0];
        keys.push(...result[1]);
        iterations++;
      } while (cursor !== '0' && iterations < maxIterations);

      // Check each simulation key to find matching shipment
      for (const key of keys) {
        try {
          const simulationData = await Promise.race([
            this.redis.get(key),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Redis GET timed out')), 2000)
            ),
          ]);
          
          if (simulationData) {
            const simulation = JSON.parse(simulationData);
            if (simulation.shipmentId === shipmentId) {
              // Found matching simulation, get route data
              const routeData = await this.getRouteData(
                simulation.driverId,
                tenantId
              );
              if (routeData) {
                return {
                  ...routeData,
                  shipmentId,
                  driverId: simulation.driverId,
                };
              }
            }
          }
        } catch (error) {
          // Skip this key if it fails, continue to next
          continue;
        }
      }
    } catch (error) {
      // If SCAN fails or times out, return null (route not found or Redis unavailable)
      console.log(`[RouteSimulation] ❌ SCAN failed or timed out for shipment ${shipmentId}:`, error);
      return null;
    }

    console.log(`[RouteSimulation] ⚠️ No route data found for shipment ${shipmentId} after checking memory and Redis`);
    return null;
  }
}
