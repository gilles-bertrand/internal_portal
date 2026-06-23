import Service, { service } from '@ember/service';
import { cacheKeyFor, type Store } from '@warp-drive/core';
import { createRecord } from '@warp-drive/utilities/json-api';
import type { Incident } from '#src/schemas/incidents.ts';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

export default class IncidentService extends Service {
  @service declare store: Store;

  public async create(data: ValidatedIncident) {
    const record = this.store.createRecord<Incident>('incidents', {
      ...data,
      timelineEvents: data.timelineEvents ?? [],
      contributingFactors: data.contributingFactors ?? [],
      correctiveActions: data.correctiveActions ?? [],
      preventiveMeasures: data.preventiveMeasures ?? [],
      personalDataImpacted: data.personalDataImpacted ?? false,
      specialCategoryData: data.specialCategoryData ?? false,
    } as Partial<Incident>);

    const request = createRecord(record);
    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(record)),
    });

    await this.store.request(request);
  }
}
