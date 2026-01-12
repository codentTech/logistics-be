import { shipmentResolvers } from "./resolvers/shipment.resolver";
import { dashboardResolvers } from "./resolvers/dashboard.resolver";
import { GraphQLContext } from "./resolvers/shipment.resolver";

// GraphQL schema as string (can be loaded from file in production)
const schema = `
type Query {
  shipmentDashboard(status: ShipmentStatus): [Shipment!]!
  opsSummary: OpsSummary!
}

type Shipment {
  id: ID!
  tenantId: ID!
  driverId: ID
  status: ShipmentStatus!
  pickupAddress: String!
  deliveryAddress: String!
  customerName: String!
  customerPhone: String!
  assignedAt: String
  pickedUpAt: String
  deliveredAt: String
  createdAt: String!
  updatedAt: String!
  driver: Driver
}

type Driver {
  id: ID!
  name: String!
  phone: String
  isActive: Boolean!
  currentLocation: DriverLocation
}

type DriverLocation {
  latitude: Float!
  longitude: Float!
  timestamp: String!
  source: String!
}

type OpsSummary {
  tenantId: ID!
  totalShipments: Int!
  activeShipments: Int!
  deliveredToday: Int!
  driversOnline: Int!
  lastUpdated: String!
}

enum ShipmentStatus {
  CREATED
  ASSIGNED
  PICKED_UP
  IN_TRANSIT
  DELIVERED
}
`;

export const graphQLConfig = {
  schema,
  resolvers: {
    Query: {
      ...shipmentResolvers.Query,
      ...dashboardResolvers.Query,
    },
  },
  context: async (request: any, reply: any): Promise<any> => {
    const fastify = reply.server as any;
    
    // Skip authentication for GET requests (GraphiQL UI loads)
    // Actual queries will still require auth via resolvers
    if (request.method === 'GET') {
      // Return minimal context - queries will fail without proper auth
      return {
        tenantId: null,
        userId: null,
        redis: fastify.redis,
      } as GraphQLContext;
    }
    
    // For POST requests (actual queries), require authentication
    // Check if user is already attached (from hook)
    let user = (request as any).user;
    
    // If not attached, authenticate here (fallback)
    if (!user) {
      try {
        // Get token from header
        const authHeader = request.headers?.authorization || request.headers?.Authorization;
        if (!authHeader) {
          throw new Error("Authentication required. Please provide a JWT token in the Authorization header: 'Authorization: Bearer YOUR_TOKEN'");
        }

        // Extract token
        const token = authHeader.replace(/^Bearer\s+/i, '');
        if (!token) {
          throw new Error("Invalid token format. Use: 'Authorization: Bearer YOUR_TOKEN'");
        }

        // Verify token
        const decoded = await fastify.jwt.verify(token) as any;

        // Fetch user from database
        const { AppDataSource } = await import('../infra/db/data-source');
        const { User } = await import('../infra/db/entities/User');
        const userRepository = AppDataSource.getRepository(User);
        
        const dbUser = await userRepository.findOne({
          where: {
            id: decoded.userId as string,
            isActive: true,
          },
          relations: ["tenant"],
        });

        if (!dbUser) {
          throw new Error("User not found or inactive");
        }

        if (!dbUser.tenant.isActive) {
          throw new Error("Tenant is inactive");
        }

        // Attach user to request for future use
        user = {
          userId: dbUser.id,
          tenantId: dbUser.tenantId,
          email: dbUser.email,
          role: dbUser.role,
        };
        (request as any).user = user;
      } catch (error: any) {
        if (error.message) {
          throw error;
        }
        throw new Error("Invalid or expired token. Please login again to get a new token.");
      }
    }

    if (!fastify.redis) {
      throw new Error("Redis not available");
    }

    return {
      tenantId: user.tenantId,
      userId: user.userId,
      redis: fastify.redis,
    } as GraphQLContext;
  },
  subscription: false, // Disable subscriptions for now
};
