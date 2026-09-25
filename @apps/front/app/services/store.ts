import { useLegacyStore } from '@warp-drive/legacy';
import { JSONAPICache } from '@warp-drive/json-api';
import UserSchema from '@libs/users-front/schemas/users';
import { setBuildURLConfig } from '@warp-drive/utilities';
import { CacheHandler, Fetch, RequestManager } from '@warp-drive/core';
import type Owner from '@ember/owner';
import { LegacyNetworkHandler } from '@warp-drive/legacy/compat';
import { setOwner } from '@ember/owner';
import AuthHandler from '@libs/users-front/handlers/auth';
import { getOwner } from '@ember/owner';
import TodoSchema from '@libs/todos-front/schemas/todos';
import AccessRecordSchema from '@libs/access-registry-front/schemas/access-records';
// @lat: [[frontend/access-record-options#Enregistrement obligatoire des schémas warp-drive]]
import PurposeSchema from '@libs/access-registry-front/schemas/purposes';
import LegalBasisSchema from '@libs/access-registry-front/schemas/legal-bases';
import DataCategorySchema from '@libs/access-registry-front/schemas/data-categories';
import SourceSystemSchema from '@libs/access-registry-front/schemas/source-systems';
import EligibleAccessorSchema from '@libs/access-registry-front/schemas/eligible-accessors';
import IncidentSchema from '@libs/incident-registry-front/schemas/incidents';
import RoleSchema from '@libs/permissions-front/schemas/roles';

setBuildURLConfig({
  host: null,
  namespace: 'api/v1',
});

const legacyStore = useLegacyStore({
  linksMode: false,
  legacyRequests: true,
  modelFragments: true,
  cache: JSONAPICache,
  schemas: [
    UserSchema,
    TodoSchema,
    AccessRecordSchema,
    PurposeSchema,
    LegalBasisSchema,
    DataCategorySchema,
    SourceSystemSchema,
    EligibleAccessorSchema,
    IncidentSchema,
    RoleSchema,
  ],
  handlers: [],
});

export default class MyStore extends legacyStore {
  constructor(owner: Owner) {
    super(owner);

    const authHandler = new AuthHandler();
    setOwner(authHandler, getOwner(this)!);

    const manager = new RequestManager();

    setOwner(this.requestManager, getOwner(this)!);

    this.requestManager = manager
      .use([authHandler, LegacyNetworkHandler, Fetch])
      .useCache(CacheHandler);
  }
}
