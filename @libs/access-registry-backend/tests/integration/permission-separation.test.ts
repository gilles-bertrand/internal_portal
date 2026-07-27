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

async function seedRecords() {
  await module.insertUser("other-encoder-id", "encoder");

  const own = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("encoder-id", "encoder") },
    payload: accessRecordPayload(),
  });
  const other = await module.fastifyInstance.inject({
    method: "POST",
    url: "/access-records",
    headers: { authorization: module.generateBearerToken("other-encoder-id", "encoder") },
    payload: accessRecordPayload({ dataSubjectRef: "cust-other" }),
  });

  return {
    ownId: own.json().data.id as string,
    otherId: other.json().data.id as string,
  };
}

interface RoleExpectations {
  roleName: "encoder" | "dpo" | "auditor" | "tech_admin";
  userId: string;
  create: number;
  list: number;
  getOwn: number;
  getOther: number;
}

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
// Miroir de la matrice de permissions réellement seedée (cf. permission-rule-seed.ts).
// tech_admin a désormais `read AccessRecord` (accès au registre en lecture) : il liste et
// consulte tous les enregistrements (200) mais ne peut pas créer (403). L'écriture/lecture
// des routes plus larges (export/stats/audit-events/verify-integrity/retention) est couverte
// par permission-separation-reads.test.ts pour garder ce fichier sous la limite de lignes.
const ROLE_EXPECTATIONS: RoleExpectations[] = [
  { roleName: "encoder", userId: "encoder-id", create: 200, list: 200, getOwn: 200, getOther: 403 },
  { roleName: "dpo", userId: "dpo-id", create: 403, list: 200, getOwn: 200, getOther: 200 },
  { roleName: "auditor", userId: "auditor-id", create: 403, list: 200, getOwn: 200, getOther: 200 },
  {
    roleName: "tech_admin",
    userId: "admin-id",
    create: 403,
    list: 200,
    getOwn: 200,
    getOther: 200,
  },
];

describe.each(ROLE_EXPECTATIONS)("role $roleName", (expectations) => {
  const auth = () => ({
    authorization: module.generateBearerToken(expectations.userId, expectations.roleName),
  });

  test(`POST /access-records -> ${expectations.create}`, async () => {
    const response = await module.fastifyInstance.inject({
      method: "POST",
      url: "/access-records",
      headers: auth(),
      payload: accessRecordPayload(),
    });
    expect(response.statusCode).toBe(expectations.create);
  });

  test(`GET /access-records -> ${expectations.list}`, async () => {
    await seedRecords();

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: "/access-records",
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.list);
  });

  test(`GET /access-records/:id (son propre enregistrement) -> ${expectations.getOwn}`, async () => {
    const { ownId } = await seedRecords();

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: `/access-records/${ownId}`,
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.getOwn);
  });

  test(`GET /access-records/:id (enregistrement d'un autre encoder) -> ${expectations.getOther}`, async () => {
    const { otherId } = await seedRecords();

    const response = await module.fastifyInstance.inject({
      method: "GET",
      url: `/access-records/${otherId}`,
      headers: auth(),
    });
    expect(response.statusCode).toBe(expectations.getOther);
  });
});

// Le filtrage réel du total par rôle (encoder ne voit que le sien, dpo/auditor voient tout)
// est déjà couvert par list-and-get.route.test.ts — cette matrice ne vérifie que les codes
// HTTP de chaque route par rôle.
