import { afterAll, aroundEach, beforeAll, describe, expect, test } from "vitest";
import { TestModule } from "#tests/utils/setup-module.js";
import { accessRecordPayload } from "#tests/utils/fixtures.js";

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

async function seedOneRecord() {
  await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: accessRecordPayload(),
  });
}

interface RoleExpectations {
  roleName: "encoder" | "dpo" | "auditor" | "tech_admin";
  userId: string;
  export: number;
  stats: number;
  auditEvents: number;
  verifyIntegrity: number;
  retentionRun: number;
}

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
// Complète permission-separation.test.ts (create/list/get) avec les routes module-wide
// export/stats/audit-events/verify-integrity/retention. tech_admin a `read AccessRecord` :
// export/stats/audit-events (gardés par `read AccessRecord`) → 200 ; verify-integrity
// (`read AccessRecordIntegrity`) et retention (`manage AccessRecordRetention`) → 403.
const ROLE_EXPECTATIONS: RoleExpectations[] = [
  {
    roleName: "encoder",
    userId: "encoder-id",
    export: 200,
    stats: 200,
    auditEvents: 200,
    verifyIntegrity: 403,
    retentionRun: 403,
  },
  {
    roleName: "dpo",
    userId: "dpo-id",
    export: 200,
    stats: 200,
    auditEvents: 200,
    verifyIntegrity: 200,
    retentionRun: 200,
  },
  {
    roleName: "auditor",
    userId: "auditor-id",
    export: 200,
    stats: 200,
    auditEvents: 200,
    verifyIntegrity: 200,
    retentionRun: 403,
  },
  {
    roleName: "tech_admin",
    userId: "admin-id",
    export: 200,
    stats: 200,
    auditEvents: 200,
    verifyIntegrity: 403,
    retentionRun: 403,
  },
];

describe.each(ROLE_EXPECTATIONS)("role $roleName", (expectations) => {
  const auth = () => ({
    authorization: module.generateBearerToken(expectations.userId, expectations.roleName),
  });

  test(`POST /access-records/export -> ${expectations.export}`, async () => {
    await seedOneRecord();

    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/access-records/export",
      headers: auth(),
      payload: { format: "json" },
    });
    expect(response.statusCode).toBe(expectations.export);
  });

  test(`GET /access-records/stats -> ${expectations.stats}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/access-records/stats",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.stats);
  });

  test(`GET /access-records/audit-events -> ${expectations.auditEvents}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/access-records/audit-events",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.auditEvents);
  });

  test(`GET /access-records/verify-integrity -> ${expectations.verifyIntegrity}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/access-records/verify-integrity",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.verifyIntegrity);
  });

  test(`POST /access-records/retention/run -> ${expectations.retentionRun}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/access-records/retention/run",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.retentionRun);
  });
});
