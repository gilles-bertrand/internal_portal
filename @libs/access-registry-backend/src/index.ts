import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { DataCategoryEntity } from "#src/entities/data-category.entity.js";
import { PurposeEntity } from "#src/entities/purpose.entity.js";
import { LegalBasisEntity } from "#src/entities/legal-basis.entity.js";
import { RetentionPolicyEntity } from "#src/entities/retention-policy.entity.js";

export * from "#src/entities/access-record.entity.js";
export * from "#src/entities/data-category.entity.js";
export * from "#src/entities/purpose.entity.js";
export * from "#src/entities/legal-basis.entity.js";
export * from "#src/entities/retention-policy.entity.js";
export * from "#src/routes/create.route.js";
export * from "#src/routes/list.route.js";
export * from "#src/routes/get.route.js";
export * from "#src/routes/verify-integrity.route.js";
export * from "#src/routes/stats.route.js";
export * from "#src/serializers/access-record.serializer.js";
export * from "#src/utils/append.service.js";
export * from "#src/utils/audit-logger.type.js";
export * from "#src/init.js";
export * from "#src/context.js";

export const entities = [
  AccessRecordEntity,
  DataCategoryEntity,
  PurposeEntity,
  LegalBasisEntity,
  RetentionPolicyEntity,
];
