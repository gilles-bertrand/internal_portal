import { testEnv } from "#tests/utils/test-app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { App, type FastifyInstanceType } from "../../src/app/app.js";

// Acceptance des drapeaux de fonctionnalité : un domaine désactivé n'a AUCUNE
// route. Pas un 403 « vous n'avez pas le droit », pas une page vide : un 404,
// parce que la ressource n'existe pas.
//
// La distinction n'est pas cosmétique dans un produit de conformité. Un 403 est
// une information — il dit qu'il y a quelque chose, et qu'on vous le refuse. Un
// domaine simplement pas encore développé ne doit rien dire du tout.
//
// @lat: [[apps/backend-bootstrap#Drapeaux de fonctionnalité par domaine]]
describe("Feature flags", () => {
  let app: App;
  let fastifyInstance: FastifyInstanceType;

  beforeAll(async () => {
    app = await testEnv({
      FEATURE_INCIDENT_REGISTRY: false,
      FEATURE_TODOS: false,
    }).then((t) => t.app);
    fastifyInstance = app["fastify"];
  });

  afterAll(async () => {
    await app.stop();
  });

  it("un domaine désactivé n'expose plus aucune route", async () => {
    for (const url of ["/api/v1/incidents", "/api/v1/todos"]) {
      const response = await fastifyInstance.inject({ method: "GET", url });
      expect({ url, status: response.statusCode }).toEqual({ url, status: 404 });
    }
  });

  // Le 404 doit venir du routeur, pas d'un garde d'authentification : sans
  // jeton, un domaine MONTÉ répondrait 401. Recevoir 404 sans jeton prouve que
  // la route n'est pas déclarée du tout, et non qu'elle est seulement protégée.
  it("le 404 vient de l'absence de route, pas d'un refus d'authentification", async () => {
    const mounted = await fastifyInstance.inject({
      method: "GET",
      url: "/api/v1/access-records",
    });
    expect(mounted.statusCode).toBe(401);
  });

  it("les domaines laissés actifs restent montés", async () => {
    const response = await fastifyInstance.inject({
      method: "GET",
      url: "/api/v1/status",
    });

    expect(response.json().features).toEqual({
      todos: false,
      accessRegistry: true,
      incidentRegistry: false,
    });
  });

  // `users` et `permissions` n'ont pas de drapeau : sans eux personne ne se
  // connecte ni n'administre les droits. Ils doivent répondre même quand tout
  // le reste est coupé.
  it("le socle authentification/permissions n'est jamais démontable", async () => {
    const response = await fastifyInstance.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/vnd.api+json" },
      payload: JSON.stringify({ email: "nobody@example.com", password: "whatever-long" }),
    });

    expect(response.statusCode).toBe(401);
  });
});
