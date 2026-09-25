import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, object } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { DataCategoryEntity } from "#src/entities/data-category.entity.js";
import { PurposeEntity } from "#src/entities/purpose.entity.js";
import { LegalBasisEntity } from "#src/entities/legal-basis.entity.js";
import {
  jsonApiSerializeDataCategory,
  jsonApiSerializeLegalBasis,
  jsonApiSerializePurpose,
  SerializedDataCategorySchema,
  SerializedLegalBasisSchema,
  SerializedPurposeSchema,
} from "#src/serializers/referential.serializer.js";

export class DataCategoriesRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/data-categories",
      { schema: { response: { 200: object({ data: array(SerializedDataCategorySchema) }) } } },
      async (_request, reply) => {
        const items = await this.em
          .getRepository(DataCategoryEntity)
          .findAll({ orderBy: { label: "ASC" } });
        return reply.send({ data: items.map(jsonApiSerializeDataCategory) });
      },
    );
  }
}

export class PurposesRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/purposes",
      { schema: { response: { 200: object({ data: array(SerializedPurposeSchema) }) } } },
      async (_request, reply) => {
        const items = await this.em
          .getRepository(PurposeEntity)
          .findAll({ orderBy: { label: "ASC" } });
        return reply.send({ data: items.map(jsonApiSerializePurpose) });
      },
    );
  }
}

export class LegalBasesRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/legal-bases",
      { schema: { response: { 200: object({ data: array(SerializedLegalBasisSchema) }) } } },
      async (_request, reply) => {
        const items = await this.em
          .getRepository(LegalBasisEntity)
          .findAll({ orderBy: { label: "ASC" } });
        return reply.send({ data: items.map(jsonApiSerializeLegalBasis) });
      },
    );
  }
}
