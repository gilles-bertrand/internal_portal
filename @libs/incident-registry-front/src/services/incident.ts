import Service, { service } from '@ember/service';
import { cacheKeyFor, type Store } from '@warp-drive/core';
import { createRecord } from '@warp-drive/utilities/json-api';
import type { Incident } from '#src/schemas/incidents.ts';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

// Attributs de contenu envoyés au backend (create ET update partagent le même
// schéma d'attributs). Applique les mêmes valeurs par défaut que `create`.
function toIncidentAttributes(data: ValidatedIncident): Partial<Incident> {
  return {
    ...data,
    timelineEvents: data.timelineEvents ?? [],
    contributingFactors: data.contributingFactors ?? [],
    correctiveActions: data.correctiveActions ?? [],
    preventiveMeasures: data.preventiveMeasures ?? [],
    personalDataImpacted: data.personalDataImpacted ?? false,
    specialCategoryData: data.specialCategoryData ?? false,
  } as Partial<Incident>;
}

export default class IncidentService extends Service {
  @service declare store: Store;

  public async create(data: ValidatedIncident) {
    const record = this.store.createRecord<Incident>(
      'incidents',
      toIncidentAttributes(data)
    );

    const request = createRecord(record);
    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(record)),
    });

    await this.store.request(request);
  }

  // Édition = nouvelle version côté backend (PUT). Corps identique à `create`
  // (mêmes attributs de contenu) — cf. backend spec 01.
  public async update(id: string, data: ValidatedIncident) {
    await this.store.request({
      url: `/api/v1/incidents/${id}`,
      method: 'PUT',
      body: JSON.stringify({
        data: { type: 'incidents', id, attributes: toIncidentAttributes(data) },
      }),
    });
  }

  // Soft-delete (le backend pose deletedAt/deletedBy ; aucun DELETE physique).
  public async softDelete(id: string) {
    await this.store.request({
      url: `/api/v1/incidents/${id}`,
      method: 'DELETE',
      body: JSON.stringify({}),
    });
  }

  // Restauration — réservée au DPO côté backend (POST /:id/restore).
  public async restore(id: string) {
    await this.store.request({
      url: `/api/v1/incidents/${id}/restore`,
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}
