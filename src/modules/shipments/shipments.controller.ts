import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ShipmentService } from "./shipments.service";
import {
  CreateShipmentDto,
  AssignDriverDto,
  UpdateShipmentStatusDto,
} from "./shipments.dto";
import { AppError } from "../../shared/errors/error-handler";
import { getTenantId } from "../tenants/tenant.decorator";

export async function shipmentRoutes(fastify: FastifyInstance) {
  const shipmentService = new ShipmentService();

  // Create shipment
  fastify.post<{ Body: CreateShipmentDto }>(
    "/v1/shipments",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          "Create a new shipment. Requires Idempotency-Key header for idempotent requests.",
        tags: ["shipments"],
        security: [{ bearerAuth: [] }],
        headers: {
          type: "object",
          properties: {
            "Idempotency-Key": {
              type: "string",
              description:
                "Unique key for idempotent requests (optional but recommended)",
            },
          },
        },
        body: {
          type: "object",
          required: [
            "pickupAddress",
            "deliveryAddress",
            "customerName",
            "customerPhone",
          ],
          properties: {
            pickupAddress: {
              type: "string",
              description: "Pickup address",
            },
            deliveryAddress: {
              type: "string",
              description: "Delivery address",
            },
            customerName: { type: "string" },
            customerPhone: { type: "string" },
          },
        },
        response: {
          201: {
            description: "Shipment created successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  tenantId: { type: "string", format: "uuid" },
                  status: {
                    type: "string",
                    enum: [
                      "CREATED",
                      "ASSIGNED",
                      "PICKED_UP",
                      "IN_TRANSIT",
                      "DELIVERED",
                    ],
                  },
                  pickupAddress: { type: "string" },
                  deliveryAddress: { type: "string" },
                  customerName: { type: "string" },
                  customerPhone: { type: "string" },
                  driverId: { type: ["string", "null"], format: "uuid" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
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
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateShipmentDto }>,
      reply: FastifyReply
    ) => {
      try {
        const tenantId = getTenantId(request);
        const user = (request as any).user;
        const shipment = await shipmentService.createShipment(
          tenantId,
          request.body,
          user.userId
        );
        return reply.status(201).send({
          success: true,
          data: shipment,
        });
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send(error.toJSON());
        }
        throw error;
      }
    }
  );

  // Assign driver
  fastify.post<{ Params: { id: string }; Body: AssignDriverDto }>(
    "/v1/shipments/:id/assign-driver",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Assign a driver to a shipment",
        tags: ["shipments"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["driverId"],
          properties: {
            driverId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AssignDriverDto;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const tenantId = getTenantId(request);
        const user = (request as any).user;
        const shipment = await shipmentService.assignDriver(
          request.params.id,
          tenantId,
          request.body,
          user.userId
        );
        return reply.status(200).send({
          success: true,
          data: shipment,
        });
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send(error.toJSON());
        }
        throw error;
      }
    }
  );

  // Update status
  fastify.post<{ Params: { id: string }; Body: UpdateShipmentStatusDto }>(
    "/v1/shipments/:id/status",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Update shipment status (state machine)",
        tags: ["shipments"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: [
                "CREATED",
                "ASSIGNED",
                "PICKED_UP",
                "IN_TRANSIT",
                "DELIVERED",
              ],
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateShipmentStatusDto;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const tenantId = getTenantId(request);
        const user = (request as any).user;
        const shipment = await shipmentService.updateStatus(
          request.params.id,
          tenantId,
          request.body,
          user.userId
        );
        return reply.status(200).send({
          success: true,
          data: shipment,
        });
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send(error.toJSON());
        }
        throw error;
      }
    }
  );
}
