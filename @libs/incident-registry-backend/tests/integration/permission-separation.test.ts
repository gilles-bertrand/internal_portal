import { afterAll, aroundEach, beforeAll, describe, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { validIncidentPayload } from "#tests/utils/fixtures.js";

let module: TestModule;

beforeAll(async () => {
  module = await TestModule.init();
});

afterAll(async () => {
  await module.close();
});

aroundEach(async (runTest) => {
  const em = module.em;
  await em.begin();
  await runTest();
  await em.rollback();
});

async function seedIncident() {
  const created = await module.fastifyInstance.inject({
    method: "POST",
    url: "/incidents",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: validIncidentPayload,
  });
  return created.json().data.id as string;
}

interface RoleExpectations {
  roleName: "encoder" | "dpo" | "auditor" | "tech_admin";
  userId: string;
  create: number;
  list: number;
  get: number;
  export: number;
  exportOne: number;
  verifyIntegrity: number;
}

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
// Miroir de la matrice de permissions réellement seedée (cf. permission-rule-seed.ts) —
// tech_admin est bloqué au niveau module (cf. init.ts) donc 403 partout. Contrairement à
// access-registry, la lecture d'un incident n'est pas restreinte par encoder (pas de
// condition encodedBy) : cf. [[backend/incident-registry#RBAC plus strict qu'access-registry]].
const ROLE_EXPECTATIONS: RoleExpectations[] = [
  {
    roleName: "encoder",
    userId: "encoder-id",
    create: 200,
    list: 200,
    get: 200,
    export: 200,
    exportOne: 200,
    verifyIntegrity: 403,
  },
  {
    roleName: "dpo",
    userId: "dpo-id",
    create: 403,
    list: 200,
    get: 200,
    export: 200,
    exportOne: 200,
    verifyIntegrity: 200,
  },
  {
    roleName: "auditor",
    userId: "auditor-id",
    create: 403,
    list: 200,
    get: 200,
    export: 200,
    exportOne: 200,
    verifyIntegrity: 200,
  },
  {
    roleName: "tech_admin",
    userId: "admin-id",
    create: 403,
    list: 403,
    get: 403,
    export: 403,
    exportOne: 403,
    verifyIntegrity: 403,
  },
];

describe.each(ROLE_EXPECTATIONS)("role $roleName", (expectations) => {
  const auth = () => ({
    authorization: module.generateBearerToken(expectations.userId, expectations.roleName),
  });

  test(`POST /incidents -> ${expectations.create}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/incidents",
      headers: auth(),
      payload: validIncidentPayload,
    });
    expect(response.statusCode).toBe(expectations.create);
  });

  test(`GET /incidents -> ${expectations.list}`, async () => {
    await seedIncident();

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/incidents",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.list);
  });

  test(`GET /incidents/:id -> ${expectations.get}`, async () => {
    const id = await seedIncident();

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: `/incidents/${id}`,
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.get);
  });

  test(`POST /incidents/export -> ${expectations.export}`, async () => {
    await seedIncident();

    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/incidents/export",
      headers: auth(),
      payload: { format: "json" },
    });
    expect(response.statusCode).toBe(expectations.export);
  });

  test(`POST /incidents/:id/export -> ${expectations.exportOne}`, async () => {
    const id = await seedIncident();

    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: `/incidents/${id}/export`,
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.exportOne);
  });

  test(`GET /incidents/verify-integrity -> ${expectations.verifyIntegrity}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/incidents/verify-integrity",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.verifyIntegrity);
  });
});
