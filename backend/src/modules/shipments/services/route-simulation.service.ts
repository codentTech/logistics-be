import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { LocationProcessorService } from '../../drivers/services/location-processor.service';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import { refreshConfig } from '../../../config';

interface RoutePoint {
  lat: number;
  lng: number;
}

type SimulationPhase = 'TO_PICKUP' | 'TO_DELIVERY';

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
          'User-Agent': 'OpsCore/1.0', // Required by Nominatim
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
        `Failed to geocode address "${address}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  /**
   * Get route from OSRM (Open Source Routing Machine) - follows actual roads
   */
  private async getRouteFromOSRM(pickup: RoutePoint, delivery: RoutePoint): Promise<RoutePoint[]> {
    try {
      // OSRM expects coordinates in [lng, lat] format
      const url = `http://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OpsCore/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`OSRM routing failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found from OSRM');
      }

      // Extract coordinates from GeoJSON LineString
      const coordinates = data.routes[0].geometry.coordinates;
      
      // Convert from [lng, lat] to { lat, lng }
      const routePoints: RoutePoint[] = coordinates.map((coord: [number, number]) => ({
        lng: coord[0],
        lat: coord[1],
      }));

      // Use all route points - don't limit to a fixed number
      // This ensures the driver follows the complete route until delivery
      return routePoints;
    } catch (error) {
      // Fallback to linear interpolation if OSRM fails
      // This can happen if OSRM service is down or coordinates are invalid
      // Log error details for debugging but continue with fallback
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Note: In production, you might want to pass a logger instance to this service
      // For now, we silently fall back to ensure simulation always works
      // Use a reasonable number of steps for fallback (200 steps for smooth movement)
      return this.calculateRoutePoints(pickup, delivery, 200);
    }
  }

  /**
   * Interpolate between route points to get smoother movement
   */
  private interpolateRoutePoints(routePoints: RoutePoint[], targetSteps: number): RoutePoint[] {
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
        const segmentDistance = this.calculateDistance(segmentStart, segmentEnd);

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
    if (interpolated[interpolated.length - 1]?.lat !== routePoints[routePoints.length - 1]?.lat) {
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
  private calculateRoutePoints(pickup: RoutePoint, delivery: RoutePoint, steps: number): RoutePoint[] {
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
  private async getDriverCurrentLocation(driverId: string, tenantId: string): Promise<RoutePoint | null> {
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
   * Phase 1 (TO_PICKUP): Driver's current location → Pickup address (when status is APPROVED)
   * Phase 2 (TO_DELIVERY): Pickup address → Delivery address (when status is IN_TRANSIT)
   */
  async startSimulation(
    shipmentId: string,
    driverId: string,
    tenantId: string,
    pickupAddress: string,
    deliveryAddress: string,
    phase: SimulationPhase = 'TO_PICKUP'
  ): Promise<void> {
    // Stop any existing simulation for this driver
    await this.stopSimulation(driverId, tenantId);

    try {
      // Geocode addresses
      const pickupPoint = await this.geocodeAddress(pickupAddress);
      const deliveryPoint = await this.geocodeAddress(deliveryAddress);

      let startPoint: RoutePoint;
      let endPoint: RoutePoint;
      let routePoints: RoutePoint[];

      if (phase === 'TO_PICKUP') {
        // Phase 1: Driver's current location → Pickup address
        let driverLocation = await this.getDriverCurrentLocation(driverId, tenantId);
        
        // If driver location doesn't exist, create a starting point near pickup
        // This allows simulation to start even if driver hasn't shared location yet
        // We offset by ~1km so there's visible movement
        if (!driverLocation) {
          // Calculate a point ~1km away from pickup (north direction)
          // 1 degree latitude ≈ 111km, so 0.009 ≈ 1km
          const offsetLat = 0.009; // ~1km north
          driverLocation = {
            lat: pickupPoint.lat + offsetLat,
            lng: pickupPoint.lng,
          };
          
          // Store this as the driver's current location so simulation can proceed
          await this.updateDriverLocation(driverId, tenantId, driverLocation.lat, driverLocation.lng);
        }

        startPoint = driverLocation;
        endPoint = pickupPoint;
        
        // Get route points from driver location to pickup
        routePoints = await this.getRouteFromOSRM(startPoint, endPoint);
      } else {
        // Phase 2: Pickup address → Delivery address
        startPoint = pickupPoint;
        endPoint = deliveryPoint;
        
        // Get route points from pickup to delivery
        routePoints = await this.getRouteFromOSRM(startPoint, endPoint);
      }

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
      await this.redis.setex(
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
      );

      // Start at the beginning of the route
      const initialPoint = routePoints[0];
      await this.updateDriverLocation(driverId, tenantId, initialPoint.lat, initialPoint.lng);

      // Start interval to update location
      const intervalId = setInterval(async () => {
        await this.updateSimulationStep(simulationKey, routePoints, phase);
      }, this.UPDATE_INTERVAL_MS);

      simulationState.intervalId = intervalId;
      this.activeSimulations.set(simulationKey, simulationState);
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

    // Move to next step
    simulation.currentStep += 1;

    // Check if we've reached the end of the route
    if (simulation.currentStep >= routePoints.length) {
      // Move to final point (pickup for phase 1, delivery for phase 2)
      const finalPoint = routePoints[routePoints.length - 1];
      await this.updateDriverLocation(
        simulation.driverId,
        simulation.tenantId,
        finalPoint.lat,
        finalPoint.lng
      );
      
      // For phase 1 (TO_PICKUP), stop simulation when reaching pickup
      // For phase 2 (TO_DELIVERY), stop simulation when reaching delivery
      if (phase === 'TO_PICKUP') {
        // Driver reached pickup - stop simulation
        // The simulation will restart in phase 2 when status changes to IN_TRANSIT
        await this.stopSimulation(simulation.driverId, simulation.tenantId);
      } else {
        // Driver reached delivery - stop simulation
        await this.stopSimulation(simulation.driverId, simulation.tenantId);
      }
      return;
    }

    // Update driver location to current point
    const currentPoint = routePoints[simulation.currentStep];
    await this.updateDriverLocation(
      simulation.driverId,
      simulation.tenantId,
      currentPoint.lat,
      currentPoint.lng
    );

    // Check if we're close enough to target point (within threshold)
    const targetPoint = phase === 'TO_PICKUP' ? simulation.pickupPoint : simulation.deliveryPoint;
    const distanceToTarget = this.calculateDistance(currentPoint, targetPoint);
    
    if (distanceToTarget <= this.DELIVERY_THRESHOLD_METERS) {
      // Close enough to target - move to exact point and stop
      await this.updateDriverLocation(
        simulation.driverId,
        simulation.tenantId,
        targetPoint.lat,
        targetPoint.lng
      );
      
      if (phase === 'TO_PICKUP') {
        // Driver reached pickup - stop simulation
        await this.stopSimulation(simulation.driverId, simulation.tenantId);
      } else {
        // Driver reached delivery - stop simulation
        await this.stopSimulation(simulation.driverId, simulation.tenantId);
      }
      return;
    }

    // Update Redis
    await this.redis.setex(
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
    );
  }

  /**
   * Update driver location and emit Socket.IO event
   */
  private async updateDriverLocation(
    driverId: string,
    tenantId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    // Update location via LocationProcessorService
    await this.locationProcessor.processLocation(
      tenantId,
      driverId,
      {
        latitude,
        longitude,
        timestamp,
      },
      'REST' // Mark as REST source (simulated)
    );

    // Emit Socket.IO event
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('driver-location-update', {
        driverId,
        location: {
          latitude,
          longitude,
          timestamp,
        },
        source: 'SIMULATED',
      });
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
  async stopSimulationByShipment(shipmentId: string, tenantId: string): Promise<void> {
    // Find all simulations for this shipment
    const simulationsToStop: Array<{ driverId: string; tenantId: string }> = [];

    for (const [key, simulation] of this.activeSimulations.entries()) {
      if (simulation.shipmentId === shipmentId && simulation.tenantId === tenantId) {
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
   */
  hasActiveSimulation(driverId: string, tenantId: string): boolean {
    const simulationKey = `simulation:${tenantId}:${driverId}`;
    return this.activeSimulations.has(simulationKey);
  }

  /**
   * Get route data for a driver (for map visualization)
   */
  async getRouteData(driverId: string, tenantId: string): Promise<{
    shipmentId: string;
    pickupPoint: RoutePoint;
    deliveryPoint: RoutePoint;
    routePoints: RoutePoint[];
    phase?: SimulationPhase;
  } | null> {
    const routeKey = `route:${tenantId}:${driverId}`;
    const routeData = await this.redis.get(routeKey);
    
    if (!routeData) {
      return null;
    }

    return JSON.parse(routeData);
  }

  /**
   * Get route data by shipment ID
   */
  async getRouteDataByShipment(shipmentId: string, tenantId: string): Promise<{
    shipmentId: string;
    driverId: string;
    pickupPoint: RoutePoint;
    deliveryPoint: RoutePoint;
    routePoints: RoutePoint[];
    phase?: SimulationPhase;
  } | null> {
    // Search through active simulations
    for (const [key, simulation] of this.activeSimulations.entries()) {
      if (simulation.shipmentId === shipmentId && simulation.tenantId === tenantId) {
        const routeData = await this.getRouteData(simulation.driverId, tenantId);
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

    // If not in memory, try to find in Redis by searching all route keys
    const pattern = `route:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const routeData = await this.redis.get(key);
      if (routeData) {
        const parsed = JSON.parse(routeData);
        if (parsed.shipmentId === shipmentId) {
          return parsed;
        }
      }
    }

    return null;
  }
}

