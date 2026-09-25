import { describe, it, expect, afterEach } from "vitest";
import { statusRoute } from "./status.route.js";
import { fastifyTestInstance } from "#tests/utils/fastify-instance.js";
import { FEATURE_NAMES, type FeatureName } from "#src/configuration.js";
import type { FastifyInstanceType } from "#src/app/app.js";

let fastifyInstance: FastifyInstanceType;

async function serve(features: Partial<Record<FeatureName, boolean>>) {
  fastifyInstance = fastifyTestInstance();
  statusRoute(fastifyInstance, { features: features as Record<FeatureName, boolean> });
  return fastifyInstance.inject({ method: "GET", url: "/status" });
}

describe("statusRoute", () => {
  afterEach(async () => {
    await fastifyInstance.close();
  });

  it("should return status ok", async () => {
    const response = await serve({
      todos: true,
      accessRegistry: true,
      incidentRegistry: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  // @lat: [[apps/backend-bootstrap#Drapeaux de fonctionnalité par domaine]]
  //
  // Le front lit cette réponse pour savoir quoi afficher : c'est l'unique canal
  // par lequel il apprend qu'un domaine n'est pas monté.
  it("expose l'état de chaque domaine pilotable", async () => {
    const response = await serve({
      todos: false,
      accessRegistry: true,
      incidentRegistry: true,
    });

    expect(response.json().features).toEqual({
      todos: false,
      accessRegistry: true,
      incidentRegistry: true,
    });
  });

  // Une clé absente de la réponse serait lue `undefined` par le front, qui la
  // traiterait comme « désactivé » — donc masquerait une fonctionnalité bien
  // montée. La réponse porte toujours les mêmes clés.
  it("renvoie toujours toutes les clés, même celles laissées par défaut", async () => {
    const response = await serve({ todos: true });

    expect(Object.keys(response.json().features).sort()).toEqual([...FEATURE_NAMES].sort());
    expect(response.json().features.incidentRegistry).toBe(false);
  });
});
