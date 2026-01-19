import { FastifySchema } from "fastify";

/**
 * Schema for GET /v1/drivers
 */
export const getAllDriversSchema: FastifySchema = {
  summary: "Get all drivers",
  description: `
Get all active drivers for the authenticated tenant with their current locations.

**Access:** Admin or Driver

**Response:**
Returns an array of driver objects including:
- Driver profile information (name, phone, license number)
- Current location (latitude, longitude, timestamp) if available
- Active status

**Location Data:**
Location data is retrieved from Redis cache and reflects the most recent location update. If a driver hasn't shared their location, the \`location\` field will be \`null\`.
  `,
  tags: ["drivers"],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: "List of drivers",
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              tenantId: { type: "string", format: "uuid" },
              userId: { type: ["string", "null"], format: "uuid" },
              name: { type: "string" },
              phone: { type: ["string", "null"] },
              licenseNumber: { type: ["string", "null"] },
              isActive: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              location: {
                type: ["object", "null"],
                properties: {
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
              isOnline: { type: "boolean" },
              user: {
                type: ["object", "null"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  tenantId: { type: "string", format: "uuid" },
                  email: { type: "string" },
                  role: { type: "string" },
                  firstName: { type: ["string", "null"] },
                  lastName: { type: ["string", "null"] },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    401: {
      description: "Unauthorized",
      type: "object",
      properties: {
        success: { type: "boolean" },
        error_code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

/**
 * Schema for GET /v1/drivers/:id
 */
export const getDriverByIdSchema: FastifySchema = {
  summary: "Get driver by ID",
  description: `
Get detailed information about a specific driver by their ID.

**Access:** Admin or Driver (drivers can only view their own details)

**Response:**
Returns complete driver information including profile details and current location (if available).

**Location Data:**
Location data is retrieved from Redis cache and reflects the most recent location update.
  `,
  tags: ["drivers"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      description: "Driver details",
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            tenantId: { type: "string", format: "uuid" },
            userId: { type: ["string", "null"], format: "uuid" },
            name: { type: "string" },
            phone: { type: ["string", "null"] },
            licenseNumber: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            location: {
              type: ["object", "null"],
              properties: {
                latitude: { type: "number" },
                longitude: { type: "number" },
                timestamp: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    404: {
      description: "Driver not found",
      type: "object",
      properties: {
        success: { type: "boolean" },
        error_code: { type: "string" },
        message: { type: "string" },
      },
    },
    401: {
      description: "Unauthorized",
      type: "object",
      properties: {
        success: { type: "boolean" },
        error_code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};

/**
 * Schema for POST /v1/drivers/:id/location
 */
export const updateDriverLocationSchema: FastifySchema = {
  description: `Update driver location via REST API.

**Alternative: MQTT**
You can also update driver location via MQTT by publishing to:
- **Topic:** \`tenant/{tenantId}/driver/{driverId}/location\`
- **Message Format:**
\`\`\`json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "timestamp": "2024-01-01T12:00:00Z"
}
\`\`\`

**Example (mosquitto_pub):**
\`\`\`bash
mosquitto_pub -h your-mqtt-server -p 1883 \\
  -t "tenant/YOUR_TENANT_ID/driver/YOUR_DRIVER_ID/location" \\
  -m '{"latitude":40.7128,"longitude":-74.0060,"timestamp":"2024-01-01T12:00:00Z"}'
\`\`\`

Both REST and MQTT store location in Redis and broadcast via Socket.IO.`,
  tags: ["drivers"],
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["latitude", "longitude"],
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" },
      timestamp: { type: "string", format: "date-time" },
    },
  },
  response: {
    200: {
      description: "Location updated successfully",
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
    400: {
      description: "Bad request",
      type: "object",
      properties: {
        success: { type: "boolean" },
        error_code: { type: "string" },
        message: { type: "string" },
      },
    },
    401: {
      description: "Unauthorized",
      type: "object",
      properties: {
        success: { type: "boolean" },
        error_code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};
