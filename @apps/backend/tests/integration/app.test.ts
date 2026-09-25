import { testEnv } from "#tests/utils/test-app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { App, type FastifyInstanceType } from "../../src/app/app.js";

describe("App Integration Tests", () => {
  let app: App;
  let fastifyInstance: FastifyInstanceType;

  beforeAll(async () => {
    app = await testEnv().then((t) => t.app);
    fastifyInstance = app["fastify"];
  });

  afterAll(async () => {
    await app.stop();
  });

  it("should return 200 for status route", async () => {
    const response = await fastifyInstance.inject({
      method: "GET",
      url: "/api/v1/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  // @lat: [[apps/backend-bootstrap#Drapeaux de fonctionnalité par domaine]]
  //
  // Le front n'a pas de liste de domaines à lui : il lit celle-ci. Si la route
  // cessait de la porter, le menu se viderait sans que rien ne le signale.
  it("advertises the mounted domains so the front does not keep its own list", async () => {
    const response = await fastifyInstance.inject({
      method: "GET",
      url: "/api/v1/status",
    });

    const features = response.json().features as Record<string, boolean>;
    expect(Object.keys(features).sort()).toEqual(
      ["accessRegistry", "incidentRegistry", "todos"].sort(),
    );
    // Aucune variable FEATURE_* n'est posée dans l'environnement de test : tout
    // doit être actif. Une variable absente ne retire jamais rien.
    expect(Object.values(features).every(Boolean)).toBe(true);
  });

  // Ces trois tests couvrent le composition root lui-même — le seul endroit du
  // monorepo qu'aucune suite de lib n'exerce : les harnais `setup-module.ts`
  // des libs montent leurs routes sur une instance Fastify NUE, avec leur
  // propre `setErrorHandler`. Deux défauts de production ont donc vécu
  // longtemps sans qu'un seul des 52 tests d'intégration incident puisse les
  // voir. Toute route testée ici l'est pour son PIPELINE, pas pour son métier.

  // @lat: [[backend/platform#Parser du content-type JSON:API]]
  //
  // Le parser doit être le TROISIÈME argument de `addContentTypeParser` ;
  // passé en deuxième il atterrit dans le slot `opts` et AUCUNE fonction de
  // parsing n'est enregistrée. Tout corps envoyé en `application/vnd.api+json`
  // — c'est-à-dire toute écriture venant du front, WarpDrive posant ce
  // content-type — repartait alors en 400 `FST_ERR_CTP_INVALID_JSON_BODY`.
  // Recevoir ici un 401 prouve que le corps a bien été parsé et que la route a
  // été atteinte : c'est le seul but de l'assertion.
  it("parses a JSON:API request body instead of rejecting it as invalid JSON", async () => {
    const response = await fastifyInstance.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/vnd.api+json" },
      payload: JSON.stringify({
        email: "nobody@example.com",
        password: "not-the-password",
      }),
    });

    expect(response.json()).not.toMatchObject({
      errors: [{ code: "FST_ERR_CTP_INVALID_JSON_BODY" }],
    });
    expect(response.statusCode).toBe(401);
  });

  // @lat: [[backend/platform#Le handler d'erreur global répond en JSON:API]]
  //
  // Le handler renvoyait `{ message, code, status }`, forme qu'AUCUNE route ne
  // déclare : toutes déclarent `jsonApiErrorDocumentSchema`, donc `{ errors }`.
  // Fastify sérialise la réponse d'erreur contre le schéma du status, la clé
  // `errors` manquait, et le client recevait un 500
  // `FST_ERR_RESPONSE_SERIALIZATION` opaque au lieu du 400 de validation — sur
  // toutes les routes de tous les modules. Le message nommant le champ fautif
  // était perdu, et le front ne pouvait rien afficher d'utile.
  it("answers a validation failure with a JSON:API error document, not a 500", async () => {
    const response = await fastifyInstance.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ email: "not-an-email", password: "short" }),
    });

    expect(response.statusCode).toBe(400);

    const body = response.json() as {
      errors?: { status?: string; detail?: string; source?: { pointer?: string } }[];
    };
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors?.[0]?.status).toBe("400");
    expect(body.errors?.[0]?.detail).toEqual(expect.any(String));

    // @lat: [[backend/platform#Le handler d'erreur global répond en JSON:API#Le pointer d'erreur ne doit pas être doublé]]
    //
    // Le front dérive la clé du champ fautif de ce pointer : `instancePath`
    // commence déjà par `/`, et une concaténation naïve produisait
    // `//data/attributes/...`, clé inexploitable côté changeset. L'erreur
    // serveur ne se rattachait alors à aucun input.
    const pointer = body.errors?.[0]?.source?.pointer;
    expect(pointer?.startsWith("/")).toBe(true);
    expect(pointer?.startsWith("//")).toBe(false);
  });

  // Le handler 404 suit le même contrat que le handler d'erreur : document
  // JSON:API et status posé explicitement.
  it("answers an unknown route with a JSON:API 404 document", async () => {
    const response = await fastifyInstance.inject({
      method: "GET",
      url: "/api/v1/route-qui-n-existe-pas",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      errors: [{ status: "404", code: "NOT_FOUND", title: "Not Found" }],
    });
  });
});
