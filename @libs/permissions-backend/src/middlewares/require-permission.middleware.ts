import type { FastifyReply, FastifyRequest } from "fastify";
import { makeJsonApiError } from "@libs/backend-shared";

// @lat: [[backend/permissions#Guard requirePermission]]
export function requirePermission(action: string, subject: string) {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply) {
    if (!request.ability) {
      return reply.code(401).send(
        makeJsonApiError(401, "Unauthorized", {
          code: "UNAUTHORIZED",
          detail: "Not authenticated",
        }),
      );
    }
    if (!request.ability.can(action, subject)) {
      return reply.code(403).send(
        makeJsonApiError(403, "Forbidden", {
          code: "FORBIDDEN",
          detail: "Insufficient permission",
        }),
      );
    }
  };
}
