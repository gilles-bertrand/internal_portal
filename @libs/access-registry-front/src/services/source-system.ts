import type { SourceSystem } from '#src/schemas/source-systems.ts';
import Service from '@ember/service';
import { service } from '@ember/service';
import { cacheKeyFor, type Store } from '@warp-drive/core';
import { createRecord } from '@warp-drive/utilities/json-api';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';

// Création d'un système source dans le référentiel backend (POST /source-systems).
// Le backend est idempotent (renvoie l'existant si le code dérivé existe déjà),
// on retourne donc toujours le référentiel résultant, prêt à être ajouté aux
// options de la select.
export default class SourceSystemService extends Service {
  @service declare store: Store;

  public async create(label: string): Promise<SourceSystem> {
    const record = this.store.createRecord<SourceSystem>('source-systems', {
      label,
    });

    const request = createRecord(record);
    request.body = JSON.stringify({
      data: this.store.cache.peek(cacheKeyFor(record)),
    });

    const response =
      await this.store.request<ReactiveDataDocument<SourceSystem>>(request);
    return response.content.data;
  }
}

declare module '@ember/service' {
  interface Registry {
    'source-system': SourceSystemService;
  }
}
