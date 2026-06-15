import type { AccessRecord } from '#src/schemas/access-records.ts';
import { type ValidatedAccessRecord } from '#src/components/forms/access-record-validation.ts';
import Service from '@ember/service';
import { service } from '@ember/service';
import { cacheKeyFor, type Store } from '@warp-drive/core';
import { createRecord } from '@warp-drive/utilities/json-api';

export default class AccessRecordService extends Service {
  @service declare store: Store;

  public async create(data: ValidatedAccessRecord) {
    const record = this.store.createRecord<AccessRecord>('access-records', {
      accessedAt: data.accessedAt,
      accessorRef: data.accessorRef,
      dataSubjectRef: data.dataSubjectRef,
      dataCategories: data.dataCategories
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      isSpecialCategory: data.isSpecialCategory ?? false,
      accessType: data.accessType,
      purpose: data.purpose,
      legalBasis: data.legalBasis,
      sourceSystem: data.sourceSystem,
      recipient: data.recipient ?? null,
      justification: data.justification,
    });

    const request = createRecord(record);
    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(record)),
    });

    await this.store.request(request);
  }
}
