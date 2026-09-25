import type { AppAbility } from "#src/ability/ability-builder.js";

declare module "fastify" {
  interface FastifyRequest {
    ability?: AppAbility;
  }
}
