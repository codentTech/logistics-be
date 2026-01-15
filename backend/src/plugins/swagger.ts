import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import { swaggerConfig } from "../config";

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  if (!swaggerConfig.enabled) {
    return;
  }

  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "OpsCore API",
        description: `
# OpsCore Logistics Management API

A production-grade, multi-tenant logistics and shipment management system built with Fastify, TypeORM, and PostgreSQL.

## 🚀 Features

- **Multi-Tenant Architecture**: Complete tenant isolation with automatic tenant detection
- **Role-Based Access Control (RBAC)**: Admin, Driver, and Customer roles with granular permissions
- **Real-Time Updates**: Socket.IO integration for live shipment tracking and notifications
- **Route Simulation**: OSRM-based road routing with two-phase simulation (to pickup → to delivery)
- **State Machine**: Enforced shipment status transitions with validation
- **Idempotency**: Request deduplication for safe retries
- **MQTT Support**: Alternative location update mechanism via MQTT protocol
- **Redis Caching**: High-performance caching for driver locations and dashboard data

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Get your token from the \`POST /v1/auth/login\` endpoint.

## 🏢 Multi-Tenant Login Flow

1. **Single Tenant**: User logs in with email/password → receives JWT token directly
2. **Multiple Tenants**: User logs in → receives tenant list → selects tenant → re-verifies password → receives JWT token

## 📦 Shipment Status Flow

The shipment lifecycle follows a strict state machine:

\`CREATED\` → \`ASSIGNED\` (with \`pendingApproval: true\`) → \`APPROVED\` → \`IN_TRANSIT\` → \`DELIVERED\`

**Cancellation States:**
- \`CANCEL_BY_CUSTOMER\`: Customer cancels before \`IN_TRANSIT\`
- \`CANCEL_BY_DRIVER\`: Driver cancels before \`IN_TRANSIT\`

**Status Transition Rules:**
- Only admins can assign drivers (CREATED → ASSIGNED)
- Only drivers can approve/reject assignments (ASSIGNED → APPROVED or CREATED)
- Only admins/drivers can update to IN_TRANSIT (APPROVED → IN_TRANSIT)
- Only admins/drivers can mark as DELIVERED (IN_TRANSIT → DELIVERED)
- Customers can cancel before IN_TRANSIT (any → CANCEL_BY_CUSTOMER)
- Drivers can cancel before IN_TRANSIT (any → CANCEL_BY_DRIVER)

## 🔄 Route Simulation Flow

The system supports two-phase route simulation:

1. **Phase 1 (TO_PICKUP)**: When driver approves assignment, simulation starts from driver's current location to pickup address
2. **Phase 2 (TO_DELIVERY)**: When status changes to IN_TRANSIT, simulation starts from pickup address to delivery address

Route data is stored in Redis and updated in real-time via Socket.IO.

## 📡 Real-Time Events (Socket.IO)

Connect to the Socket.IO server and listen for these events:

- \`shipment-status-update\`: Emitted when shipment status changes
  \`\`\`json
  {
    "shipmentId": "uuid",
    "newStatus": "APPROVED",
    "driverId": "uuid",
    "pendingApproval": false
  }
  \`\`\`
- \`driver-location-update\`: Emitted when driver location updates
  \`\`\`json
  {
    "driverId": "uuid",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  \`\`\`
- \`notification\`: Emitted when a new notification is created
  \`\`\`json
  {
    "id": "uuid",
    "type": "SHIPMENT_ASSIGNED",
    "title": "New Shipment Assigned",
    "message": "You have been assigned to a new shipment",
    "shipmentId": "uuid"
  }
  \`\`\`
- \`notification-updated\`: Emitted when notifications need to be refreshed
  \`\`\`json
  {
    "shipmentId": "uuid"
  }
  \`\`\`

**Socket.IO Room Structure:**
- \`tenant:{tenantId}\`: All users in a tenant receive tenant-wide updates
- \`user:{userId}\`: User-specific updates (notifications)

## 🔑 Idempotency

All mutation endpoints (POST, PATCH) support idempotency via the \`Idempotency-Key\` header:

\`\`\`
Idempotency-Key: unique-request-id-here
\`\`\`

Duplicate requests with the same key will return the cached response without executing the operation again.

## 📊 Rate Limiting

API requests are rate-limited to 200 requests per minute per IP address.

## 🛠️ MQTT Support

Driver locations can be updated via MQTT in addition to REST API:

**Topic:** \`tenant/{tenantId}/driver/{driverId}/location\`

**Message Format:**
\`\`\`json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

## 📝 Support

For issues or questions, please contact the development team.
        `,
        version: "1.0.0",
        contact: {
          name: "OpsCore API Support",
          email: "support@opscore.com",
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
      },
      servers: [
        {
          url: `http://${swaggerConfig.host}`,
          description: "Development server",
        },
        {
          url: "https://api.opscore.com",
          description: "Production server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token obtained from the /v1/auth/login endpoint",
          },
        },
        schemas: {
          Error: {
            type: "object",
            properties: {
              success: { type: "boolean", example: false },
              error_code: { type: "string", example: "INVALID_SHIPMENT_STATE" },
              message: {
                type: "string",
                example: "Cannot transition from CREATED to DELIVERED",
              },
            },
            required: ["success", "error_code", "message"],
            description:
              "Standard error response format used across all endpoints",
          },
          Success: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "object", description: "Response data payload" },
            },
            required: ["success"],
            description:
              "Standard success response format used across all endpoints",
          },
          Shipment: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174000",
                description: "Unique shipment identifier",
              },
              tenantId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174001",
                description: "Tenant identifier for multi-tenant isolation",
              },
              status: {
                type: "string",
                enum: [
                  "CREATED",
                  "ASSIGNED",
                  "APPROVED",
                  "IN_TRANSIT",
                  "DELIVERED",
                  "CANCEL_BY_CUSTOMER",
                  "CANCEL_BY_DRIVER",
                ],
                example: "CREATED",
                description:
                  "Current status of the shipment (state machine enforced)",
              },
              pickupAddress: {
                type: "string",
                example: "123 Main St, New York, NY 10001",
                description: "Full address for pickup location",
              },
              deliveryAddress: {
                type: "string",
                example: "456 Oak Ave, Brooklyn, NY 11201",
                description: "Full address for delivery location",
              },
              customerName: {
                type: "string",
                example: "John Doe",
                description: "Name of the customer",
              },
              customerPhone: {
                type: "string",
                example: "+1234567890",
                description: "Customer contact phone number",
              },
              driverId: {
                type: ["string", "null"],
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174002",
                description: "Assigned driver ID (null if not assigned)",
              },
              pendingApproval: {
                type: "boolean",
                example: false,
                description:
                  "Whether driver approval is pending (true when status is ASSIGNED)",
              },
              assignedAt: {
                type: ["string", "null"],
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description:
                  "Timestamp when driver was assigned (null if not assigned)",
              },
              cancelledAt: {
                type: ["string", "null"],
                format: "date-time",
                example: "2024-01-15T11:00:00Z",
                description:
                  "Timestamp when shipment was cancelled (null if not cancelled)",
              },
              deliveredAt: {
                type: ["string", "null"],
                format: "date-time",
                example: "2024-01-15T14:30:00Z",
                description:
                  "Timestamp when shipment was delivered (null if not delivered)",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T08:00:00Z",
                description: "Timestamp when shipment was created",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description: "Timestamp when shipment was last updated",
              },
            },
            required: [
              "id",
              "tenantId",
              "status",
              "pickupAddress",
              "deliveryAddress",
              "customerName",
              "customerPhone",
              "createdAt",
              "updatedAt",
            ],
            description:
              "Shipment entity with all properties and relationships",
          },
          Driver: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174002",
                description: "Unique driver identifier",
              },
              tenantId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174001",
                description: "Tenant identifier for multi-tenant isolation",
              },
              userId: {
                type: ["string", "null"],
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174003",
                description: "Associated user account ID (null if not linked)",
              },
              name: {
                type: "string",
                example: "John Driver",
                description: "Driver's full name",
              },
              phone: {
                type: ["string", "null"],
                example: "+1234567890",
                description: "Driver's contact phone number",
              },
              licenseNumber: {
                type: ["string", "null"],
                example: "DL123456",
                description: "Driver's license number",
              },
              isActive: {
                type: "boolean",
                example: true,
                description: "Whether the driver is currently active",
              },
              location: {
                type: ["object", "null"],
                properties: {
                  latitude: {
                    type: "number",
                    example: 40.7128,
                    description: "Current latitude coordinate",
                  },
                  longitude: {
                    type: "number",
                    example: -74.006,
                    description: "Current longitude coordinate",
                  },
                  timestamp: {
                    type: "string",
                    format: "date-time",
                    example: "2024-01-15T10:30:00Z",
                    description: "Timestamp of the location update",
                  },
                },
                description:
                  "Current location data (null if location not shared)",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T08:00:00Z",
                description: "Timestamp when driver was created",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description: "Timestamp when driver was last updated",
              },
            },
            required: [
              "id",
              "tenantId",
              "name",
              "isActive",
              "createdAt",
              "updatedAt",
            ],
            description:
              "Driver entity with location information and user association",
          },
          Notification: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174004",
                description: "Unique notification identifier",
              },
              userId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174003",
                description: "User ID who receives this notification",
              },
              shipmentId: {
                type: ["string", "null"],
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174000",
                description:
                  "Associated shipment ID (null if not shipment-related)",
              },
              type: {
                type: "string",
                enum: [
                  "SHIPMENT_ASSIGNED",
                  "SHIPMENT_APPROVED",
                  "SHIPMENT_REJECTED",
                  "SHIPMENT_CANCELLED",
                  "SHIPMENT_IN_TRANSIT",
                  "SHIPMENT_DELIVERED",
                ],
                example: "SHIPMENT_ASSIGNED",
                description: "Type of notification",
              },
              title: {
                type: "string",
                example: "New Shipment Assigned",
                description: "Notification title",
              },
              message: {
                type: "string",
                example: "You have been assigned to shipment #12345",
                description: "Notification message content",
              },
              status: {
                type: "string",
                enum: ["UNREAD", "READ"],
                example: "UNREAD",
                description: "Read status of the notification",
              },
              metadata: {
                type: ["object", "null"],
                example: { shipmentId: "123e4567-e89b-12d3-a456-426614174000" },
                description: "Additional metadata as JSON object",
              },
              createdAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description: "Timestamp when notification was created",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description: "Timestamp when notification was last updated",
              },
            },
            required: [
              "id",
              "userId",
              "type",
              "title",
              "message",
              "status",
              "createdAt",
              "updatedAt",
            ],
            description: "Notification entity for in-app notifications",
          },
          DashboardSummary: {
            type: "object",
            properties: {
              tenantId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174001",
                description: "Tenant identifier",
              },
              totalShipments: {
                type: "number",
                example: 150,
                description: "Total number of shipments for the tenant",
              },
              activeShipments: {
                type: "number",
                example: 25,
                description:
                  "Number of active shipments (CREATED, ASSIGNED, APPROVED, IN_TRANSIT)",
              },
              deliveredToday: {
                type: "number",
                example: 12,
                description: "Number of shipments delivered today",
              },
              driversOnline: {
                type: "number",
                example: 8,
                description:
                  "Number of drivers currently online (with recent location updates)",
              },
              lastUpdated: {
                type: "string",
                format: "date-time",
                example: "2024-01-15T10:30:00Z",
                description: "Timestamp when summary was last updated",
              },
            },
            required: [
              "tenantId",
              "totalShipments",
              "activeShipments",
              "deliveredToday",
              "driversOnline",
              "lastUpdated",
            ],
            description: "Dashboard summary data (CQRS read model)",
          },
          RouteData: {
            type: "object",
            properties: {
              driverId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174002",
                description: "Driver ID for this route",
              },
              shipmentId: {
                type: "string",
                format: "uuid",
                example: "123e4567-e89b-12d3-a456-426614174000",
                description: "Shipment ID for this route",
              },
              phase: {
                type: "string",
                enum: ["TO_PICKUP", "TO_DELIVERY"],
                example: "TO_PICKUP",
                description: "Current phase of the route simulation",
              },
              routePoints: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    lat: { type: "number", example: 40.7128 },
                    lng: { type: "number", example: -74.006 },
                  },
                },
                description: "Array of route coordinates (lat/lng pairs)",
              },
              currentIndex: {
                type: "number",
                example: 5,
                description: "Current position index in the route",
              },
              isComplete: {
                type: "boolean",
                example: false,
                description: "Whether the route simulation is complete",
              },
            },
            required: [
              "driverId",
              "shipmentId",
              "phase",
              "routePoints",
              "currentIndex",
              "isComplete",
            ],
            description: "Route simulation data for a driver-shipment pair",
          },
        },
      },
      tags: [
        {
          name: "auth",
          description:
            "Authentication and authorization endpoints. Handles user login, tenant selection, and JWT token generation. Supports multi-tenant login flows where users with multiple tenants must select a tenant before receiving a token.",
        },
        {
          name: "shipments",
          description:
            "Shipment management endpoints. Create, update, track, and manage shipments throughout their lifecycle. Includes driver assignment, approval/rejection workflow, status updates, cancellation, and route tracking. All operations respect state machine rules and role-based access control. Supports idempotency for safe retries.",
        },
        {
          name: "drivers",
          description:
            "Driver management endpoints. Retrieve driver information, update driver locations via REST or MQTT, and track driver status. Locations are cached in Redis and broadcast via Socket.IO for real-time updates. Drivers can only update their own location.",
        },
        {
          name: "dashboard",
          description:
            "Dashboard and analytics endpoints. Get real-time operational summaries, statistics, and aggregated data for the tenant. Uses CQRS read models for optimal performance. Data is cached and refreshed periodically.",
        },
        {
          name: "notifications",
          description:
            "Notification management endpoints. Retrieve in-app notifications, mark as read, and get unread counts. Real-time notifications are delivered via Socket.IO events. Supports pagination for large notification lists. Notifications are created automatically for shipment events.",
        },
      ],
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin, {
  name: "swagger",
});
