import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type { Store } from '@warp-drive/core';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';
import { query } from '@warp-drive/utilities/json-api';
import type IntlService from 'ember-intl/services/intl';
import type { Purpose } from '#src/schemas/purposes.ts';
import type { LegalBasis } from '#src/schemas/legal-bases.ts';
import type { DataCategory } from '#src/schemas/data-categories.ts';
import type { SourceSystem } from '#src/schemas/source-systems.ts';
import { labelForCode } from '#src/utils/referential-label.ts';

// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
// Cache applicatif des quatre référentiels du registre d'accès. Les
// access-records ne persistent que le `code` d'un référentiel : toute vue qui
// affiche un enregistrement (détail, tableau) doit pouvoir le retraduire en
// libellé. Les charger ici plutôt que dans chaque route évite autant d'allers-
// retours réseau que de vues, les référentiels ne changeant quasiment jamais.
export default class ReferentialsService extends Service {
  @service declare store: Store;
  @service declare intl: IntlService;

  @tracked purposes: Purpose[] = [];
  @tracked legalBases: LegalBasis[] = [];
  @tracked dataCategories: DataCategory[] = [];
  @tracked sourceSystems: SourceSystem[] = [];

  // Mémorise la requête en cours (et non un simple booléen) pour que deux
  // appels concurrents — la route détail et le tableau, par exemple — partagent
  // le même chargement au lieu d'en déclencher deux.
  #loading: Promise<void> | undefined;

  public load(): Promise<void> {
    this.#loading ??= this.#fetchAll();
    return this.#loading;
  }

  // À appeler après création d'un référentiel (« + Ajouter un système »)
  // pour que le cache reflète la nouvelle entrée.
  public invalidate(): void {
    this.#loading = undefined;
  }

  async #fetchAll(): Promise<void> {
    const [purposes, legalBases, dataCategories, sourceSystems] =
      await Promise.all([
        this.store.request<ReactiveDataDocument<Purpose[]>>(
          query<Purpose>('purposes')
        ),
        this.store.request<ReactiveDataDocument<LegalBasis[]>>(
          query<LegalBasis>('legal-bases')
        ),
        this.store.request<ReactiveDataDocument<DataCategory[]>>(
          query<DataCategory>('data-categories')
        ),
        this.store.request<ReactiveDataDocument<SourceSystem[]>>(
          query<SourceSystem>('source-systems')
        ),
      ]);
    this.purposes = [...purposes.content.data];
    this.legalBases = [...legalBases.content.data];
    this.dataCategories = [...dataCategories.content.data];
    this.sourceSystems = [...sourceSystems.content.data];
  }

  // Les quatre résolutions lisent `intl.primaryLocale`, donc un changement de
  // langue dans le dashboard suffit à réafficher les libellés — sans refetch.
  public purposeLabel(code: string | null | undefined): string {
    return labelForCode(this.purposes, code, this.intl.primaryLocale);
  }

  public legalBasisLabel(code: string | null | undefined): string {
    return labelForCode(this.legalBases, code, this.intl.primaryLocale);
  }

  public dataCategoryLabel(code: string | null | undefined): string {
    return labelForCode(this.dataCategories, code, this.intl.primaryLocale);
  }

  public sourceSystemLabel(code: string | null | undefined): string {
    return labelForCode(this.sourceSystems, code, this.intl.primaryLocale);
  }
}

declare module '@ember/service' {
  interface Registry {
    referentials: ReferentialsService;
  }
}
