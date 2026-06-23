import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type { Store } from '@warp-drive/core';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';
import { findRecord } from '@warp-drive/utilities/json-api';
import type { Incident } from '#src/schemas/incidents.ts';

export default class IncidentsShowRoute extends Route {
  @service declare store: Store;

  async model(params: { incident_id: string }) {
    const result = await this.store.request<ReactiveDataDocument<Incident>>(
      findRecord<Incident>('incidents', params.incident_id)
    );
    return result.content.data;
  }
}
