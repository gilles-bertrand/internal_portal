import type { FastifyInstance } from "fastify";

// @lat: [[backend/platform#Contrat de module Fastify partagé]]
export interface Route<T extends FastifyInstance = FastifyInstance> {
  routeDefinition(f: T): void;
}

export interface ModuleInterface<T extends FastifyInstance = FastifyInstance> {
  setupRoutes(fastify: T): Promise<void>;
}
