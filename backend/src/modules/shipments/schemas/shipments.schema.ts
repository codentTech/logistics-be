import { FastifySchema } from 'fastify';

/**
 * Schema for GET /v1/shipments
 */
export const getAllShipmentsSchema: FastifySchema = {
  summary: 'Get all shipments',
  description: `
Get all shipments for the authenticated tenant. 

**Role-Based Access:**
- **Admin**: Returns all shipments in the tenant
- **Driver**: Returns only shipments assigned to the driver

**Query Parameters:**
- \`status\` (optional): Filter shipments by status (CREATED, ASSIGNED, IN_TRANSIT, DELIVERED, CANCEL_BY_CUSTOMER, CANCEL_BY_DRIVER)

**Response:**
Returns an array of shipment objects with all relevant details including driver assignment, status, and timestamps.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
        description: 'Filter by status (optional)',
      },
    },
  },
  response: {
    200: {
      description: 'List of shipments',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              tenantId: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              pickupAddress: { type: 'string' },
              deliveryAddress: { type: 'string' },
              customerName: { type: 'string' },
              customerPhone: { type: 'string' },
              driverId: { type: ['string', 'null'], format: 'uuid' },
              assignedAt: { type: ['string', 'null'], format: 'date-time' },
              cancelledAt: { type: ['string', 'null'], format: 'date-time' },
              deliveredAt: { type: ['string', 'null'], format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for GET /v1/shipments/:id
 */
export const getShipmentByIdSchema: FastifySchema = {
  summary: 'Get shipment by ID',
  description: `
Get detailed information about a specific shipment by its ID.

**Role-Based Access:**
- **Admin**: Can view any shipment in the tenant
- **Driver**: Can only view shipments assigned to them

**Response:**
Returns complete shipment details including pickup/delivery addresses, customer information, driver assignment, status history, and all timestamps.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Shipment details',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            pickupAddress: { type: 'string' },
            deliveryAddress: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            driverId: { type: ['string', 'null'], format: 'uuid' },
            assignedAt: { type: ['string', 'null'], format: 'date-time' },
            pickedUpAt: { type: ['string', 'null'], format: 'date-time' },
            deliveredAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments
 */
export const createShipmentSchema: FastifySchema = {
  summary: 'Create new shipment',
  description: `
Create a new shipment with pickup and delivery information.

**Access:** Admin only

**Idempotency:**
This endpoint supports idempotency via the \`Idempotency-Key\` header. Include a unique key to prevent duplicate shipments if the request is retried.

**Request Body:**
- \`pickupAddress\` (required): Full address string for pickup location
- \`deliveryAddress\` (required): Full address string for delivery location
- \`customerName\` (required): Name of the customer
- \`customerPhone\` (required): Customer contact phone number

**Response:**
Returns the created shipment with status \`CREATED\` and a unique ID.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  headers: {
    type: 'object',
    properties: {
      'Idempotency-Key': {
        type: 'string',
        description: 'Unique key for idempotent requests (optional but recommended)',
      },
    },
  },
  body: {
    type: 'object',
    required: ['pickupAddress', 'deliveryAddress', 'customerName', 'customerPhone'],
    properties: {
      pickupAddress: {
        type: 'string',
        description: 'Pickup address',
      },
      deliveryAddress: {
        type: 'string',
        description: 'Delivery address',
      },
      customerName: { type: 'string' },
      customerPhone: { type: 'string' },
    },
  },
  response: {
    201: {
      description: 'Shipment created successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
            },
            pickupAddress: { type: 'string' },
            deliveryAddress: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            driverId: { type: ['string', 'null'], format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/assign-driver
 */
export const assignDriverSchema: FastifySchema = {
  summary: 'Assign driver to shipment',
  description: `
Assign a driver to a shipment. This changes the shipment status to \`ASSIGNED\` and sets \`pendingApproval\` to \`true\`.

**Access:** Admin only

**Idempotency:**
This endpoint supports idempotency via the \`Idempotency-Key\` header.

**Workflow:**
1. Admin assigns driver → Status becomes \`ASSIGNED\`
2. Driver receives notification
3. Driver can approve or reject the assignment
4. If approved → Status becomes \`APPROVED\` and route simulation Phase 1 starts
5. If rejected → Status returns to \`CREATED\` and driver is removed

**Request Body:**
- \`driverId\` (required): UUID of the driver to assign

**Response:**
Returns the updated shipment with new status and driver assignment.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['driverId'],
    properties: {
      driverId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      description: 'Driver assigned successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            driverId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/status
 */
export const updateStatusSchema: FastifySchema = {
  summary: 'Update shipment status',
  description: `
Update the status of a shipment. All status transitions must follow the state machine rules.

**Access:** Admin or Driver

**Idempotency:**
This endpoint supports idempotency via the \`Idempotency-Key\` header.

**State Machine Rules:**
- \`CREATED\` → \`ASSIGNED\`: Only via assign-driver endpoint
- \`ASSIGNED\` → \`APPROVED\`: Only via approve endpoint (driver)
- \`APPROVED\` → \`IN_TRANSIT\`: Admin or Driver (triggers route simulation Phase 2)
- \`IN_TRANSIT\` → \`DELIVERED\`: Admin or Driver
- Any → \`CANCEL_BY_CUSTOMER\`: Only via cancel-by-customer endpoint
- Any → \`CANCEL_BY_DRIVER\`: Only via cancel-by-driver endpoint

**Request Body:**
- \`status\` (required): New status (must be a valid transition)

**Response:**
Returns the updated shipment with new status. Emits Socket.IO event for real-time updates.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER'],
      },
    },
  },
  response: {
    200: {
      description: 'Status updated successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};


/**
 * Schema for POST /v1/shipments/:id/approve
 */
export const approveAssignmentSchema: FastifySchema = {
  summary: 'Approve shipment assignment',
  description: `
Driver approves a shipment assignment. Changes status from \`ASSIGNED\` to \`APPROVED\` and starts route simulation Phase 1 (driver location → pickup).

**Access:** Driver only (must be the assigned driver)

**Workflow:**
1. Driver receives assignment notification
2. Driver calls this endpoint to approve
3. Status changes to \`APPROVED\`
4. \`pendingApproval\` becomes \`false\`
5. Route simulation Phase 1 starts (TO_PICKUP)
6. Notification sent to admin
7. Socket.IO event emitted for real-time updates

**Response:**
Returns the updated shipment with \`APPROVED\` status.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Shipment ID' },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Assignment approved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
      },
    },
    400: {
      description: 'Bad request (invalid state transition)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    403: {
      description: 'Forbidden (not the assigned driver)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/reject
 */
export const rejectAssignmentSchema: FastifySchema = {
  summary: 'Reject shipment assignment',
  description: `
Driver rejects a shipment assignment. Changes status from \`ASSIGNED\` back to \`CREATED\` and removes driver assignment.

**Access:** Driver only (must be the assigned driver)

**Workflow:**
1. Driver receives assignment notification
2. Driver calls this endpoint to reject
3. Status changes to \`CREATED\`
4. \`driverId\` becomes \`null\`
5. \`pendingApproval\` becomes \`false\`
6. Notification sent to admin
7. Socket.IO event emitted for real-time updates

**Response:**
Returns the updated shipment with \`CREATED\` status and no driver assignment.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Shipment ID' },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Assignment rejected successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
      },
    },
    400: {
      description: 'Bad request (invalid state transition)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    403: {
      description: 'Forbidden (not the assigned driver)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/cancel-by-customer
 */
export const cancelByCustomerSchema: FastifySchema = {
  summary: 'Cancel shipment by customer',
  description: `
Customer cancels a shipment. Changes status to \`CANCEL_BY_CUSTOMER\`. Only allowed before status reaches \`IN_TRANSIT\`.

**Access:** Customer only

**Rules:**
- Can only cancel if status is not \`IN_TRANSIT\` or \`DELIVERED\`
- Sets \`cancelledAt\` timestamp
- Notification sent to admin and driver (if assigned)

**Response:**
Returns the updated shipment with \`CANCEL_BY_CUSTOMER\` status.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Shipment ID' },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Shipment cancelled successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
      },
    },
    400: {
      description: 'Bad request (cannot cancel in current state)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    403: {
      description: 'Forbidden (customer role required)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for POST /v1/shipments/:id/cancel-by-driver
 */
export const cancelByDriverSchema: FastifySchema = {
  summary: 'Cancel shipment by driver',
  description: `
Driver cancels a shipment. Changes status to \`CANCEL_BY_DRIVER\`. Only allowed before status reaches \`IN_TRANSIT\`.

**Access:** Driver only (must be the assigned driver)

**Rules:**
- Can only cancel if status is not \`IN_TRANSIT\` or \`DELIVERED\`
- Sets \`cancelledAt\` timestamp
- Removes driver assignment (\`driverId\` becomes \`null\`)
- Notification sent to admin

**Response:**
Returns the updated shipment with \`CANCEL_BY_DRIVER\` status.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Shipment ID' },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Shipment cancelled successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
      },
    },
    400: {
      description: 'Bad request (cannot cancel in current state)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    403: {
      description: 'Forbidden (not the assigned driver)',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

/**
 * Schema for GET /v1/shipments/:id/route
 */
export const getShipmentRouteSchema: FastifySchema = {
  summary: 'Get shipment route data',
  description: `
Get real-time route simulation data for a shipment. Returns route points, current position, and phase information.

**Access:** Admin or Driver (driver can only view routes for assigned shipments)

**Response:**
Returns route data including:
- \`driverId\`: Driver ID for this route
- \`shipmentId\`: Shipment ID
- \`phase\`: Current phase (\`TO_PICKUP\` or \`TO_DELIVERY\`)
- \`routePoints\`: Array of coordinates (lat/lng pairs)
- \`currentIndex\`: Current position in the route
- \`isComplete\`: Whether simulation is complete

Returns \`null\` if no driver is assigned or route simulation hasn't started.
  `,
  tags: ['shipments'],
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Shipment ID' },
    },
    required: ['id'],
  },
  response: {
    200: {
      description: 'Route data retrieved successfully',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          oneOf: [
            {
              type: 'object',
              properties: {
                driverId: { type: 'string', format: 'uuid' },
                shipmentId: { type: 'string', format: 'uuid' },
                phase: { type: 'string', enum: ['TO_PICKUP', 'TO_DELIVERY'] },
                routePoints: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      lat: { type: 'number' },
                      lng: { type: 'number' },
                    },
                  },
                },
                currentIndex: { type: 'number' },
                isComplete: { type: 'boolean' },
              },
            },
            { type: 'null', description: 'No route data available' },
          ],
        },
      },
    },
    401: {
      description: 'Unauthorized',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    404: {
      description: 'Shipment not found',
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error_code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};
