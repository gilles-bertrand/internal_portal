import type { FastifyReply, FastifyRequest } from "fastify";
import { makeJsonApiError } from "@libs/backend-shared";
import type { UserRole } from "#src/entities/user.entity.js";

export function requireRole(...roles: UserRole[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      return reply.code(401).send(
        makeJsonApiError(401, "Unauthorized", {
          code: "UNAUTHORIZED",
          detail: "Not authenticated",
        }),
      );
    }
    if (!roles.includes(user.role as UserRole)) {
      return reply.code(403).send(
        makeJsonApiError(403, "Forbidden", {
          code: "FORBIDDEN",
          detail: "Insufficient role",
        }),
      );
    }
  };
}
