import fastifyJwt from "@fastify/jwt";
import { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { jwtConfig } from "../config";
import { AppDataSource } from "../infra/db/data-source";
import { User } from "../infra/db/entities/User";
import { AppError, ErrorCode } from "../shared/errors/error-handler";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: jwtConfig.secret,
    sign: {
      expiresIn: jwtConfig.expiresIn,
    },
    // Ensure token is extracted from Authorization header
    decode: {
      complete: true,
    },
  });

  // Decorate fastify with authenticate method
  fastify.decorate("authenticate", async function (request: FastifyRequest) {
    try {
      // Check if Authorization header exists
      const authHeaderRaw =
        request.headers.authorization || request.headers.Authorization;
      if (!authHeaderRaw) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          "Authorization header is required",
          401
        );
      }

      // Handle string or string[] (Fastify headers can be arrays)
      const authHeader = Array.isArray(authHeaderRaw)
        ? authHeaderRaw[0]
        : authHeaderRaw;

      // Extract token from Bearer format
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          "Invalid token format. Use: Authorization: Bearer YOUR_TOKEN",
          401
        );
      }

      // Verify JWT token
      let decoded: any;
      try {
        decoded = (await fastify.jwt.verify(token)) as any;
      } catch (jwtError: any) {
        // Log JWT verification error for debugging
        fastify.log.warn(
          { err: jwtError, token: token.substring(0, 20) + "..." },
          "JWT verification failed"
        );
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          jwtError.message || "Invalid or expired token",
          401
        );
      }

      // Fetch user from database to ensure it still exists and is active
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {
          id: decoded.userId as string,
          isActive: true,
        },
        relations: ["tenant"],
      });

      if (!user) {
        throw new AppError(
          ErrorCode.USER_NOT_FOUND,
          "User not found or inactive",
          401
        );
      }

      if (!user.tenant || !user.tenant.isActive) {
        throw new AppError(
          ErrorCode.TENANT_INACTIVE,
          "Tenant is inactive",
          403
        );
      }

      // Attach user to request (using any to avoid type conflict with JWT)
      (request as any).user = {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      // Handle JWT verification errors
      if (error && typeof error === "object" && "code" in error) {
        if (
          error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID" ||
          error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER"
        ) {
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            "Authorization token missing or invalid",
            401
          );
        }
        if (error.code === "FST_JWT_BAD_REQUEST") {
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            "Invalid token format",
            401
          );
        }
      }
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        error instanceof Error ? error.message : "Invalid or expired token",
        401
      );
    }
  });
};

export default fp(authPlugin, {
  name: "auth",
});
