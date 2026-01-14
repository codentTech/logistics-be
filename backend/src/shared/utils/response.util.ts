import { FastifyReply } from "fastify";

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Send a success response with consistent format
 * @param reply Fastify reply object
 * @param data Response data
 * @param statusCode HTTP status code (default: 200)
 * @param message Optional success message
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode: number = 200,
  message?: string
): FastifyReply {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  return reply.status(statusCode).send(response);
}
