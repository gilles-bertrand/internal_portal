// @lat: [[backend/access-registry#Référentiels bilingues (label / labelEn)]]
// Source unique des référentiels du registre d'accès, partagée par le seeder de
// développement et le seeder e2e : les deux les écrivaient auparavant en double,
// avec le risque que l'un dérive de l'autre.
//
// `label` est le libellé français (colonne historique, jamais nulle), `labelEn`
// sa traduction anglaise. Le frontend choisit selon la locale active.

import { DataCategoryEntity, LegalBasisEntity, PurposeEntity } from "@libs/access-registry-backend";
import type { EntityManager } from "@mikro-orm/core";

export interface ReferentialSeed {
  id: string;
  code: string;
  label: string;
  labelEn: string;
}

export interface LegalBasisSeed extends ReferentialSeed {
  isArticle9: boolean;
}

export const DATA_CATEGORY_SEEDS: ReferentialSeed[] = [
  { id: "dc-identity", code: "identity", label: "Identité", labelEn: "Identity" },
  { id: "dc-contact", code: "contact", label: "Contact", labelEn: "Contact details" },
  { id: "dc-financial", code: "financial", label: "Financier", labelEn: "Financial" },
  { id: "dc-health", code: "health", label: "Santé", labelEn: "Health" },
];

export const PURPOSE_SEEDS: ReferentialSeed[] = [
  { id: "p-support", code: "support", label: "Support client", labelEn: "Customer support" },
  { id: "p-billing", code: "billing", label: "Facturation", labelEn: "Billing" },
  { id: "p-legal", code: "legal", label: "Obligation légale", labelEn: "Legal obligation" },
];

export const LEGAL_BASIS_SEEDS: LegalBasisSeed[] = [
  {
    id: "lb-6-1-b",
    code: "art6.1b",
    label: "Exécution d'un contrat (art. 6.1.b)",
    labelEn: "Performance of a contract (art. 6.1.b)",
    isArticle9: false,
  },
  {
    id: "lb-6-1-c",
    code: "art6.1c",
    label: "Obligation légale (art. 6.1.c)",
    labelEn: "Legal obligation (art. 6.1.c)",
    isArticle9: false,
  },
  {
    id: "lb-9-2-h",
    code: "art9.2h",
    label: "Médecine préventive (art. 9.2.h)",
    labelEn: "Preventive medicine (art. 9.2.h)",
    isArticle9: true,
  },
  {
    id: "lb-9-2-a",
    code: "art9.2a",
    label: "Consentement explicite (art. 9.2.a)",
    labelEn: "Explicit consent (art. 9.2.a)",
    isArticle9: true,
  },
];

// Écrit les référentiels dans une base de développement, sans écraser
// l'existant (le seeder est rejouable sur une base déjà peuplée).
export async function seedReferentials(em: EntityManager) {
  for (const seed of DATA_CATEGORY_SEEDS) {
    if (!(await em.findOne(DataCategoryEntity, { id: seed.id }))) {
      em.create(DataCategoryEntity, seed);
    }
  }
  for (const seed of PURPOSE_SEEDS) {
    if (!(await em.findOne(PurposeEntity, { id: seed.id }))) {
      em.create(PurposeEntity, seed);
    }
  }
  for (const seed of LEGAL_BASIS_SEEDS) {
    if (!(await em.findOne(LegalBasisEntity, { id: seed.id }))) {
      em.create(LegalBasisEntity, seed);
    }
  }
  await backfillEnglishLabels(em);
}

// Renseigne labelEn sur les référentiels seedés avant l'ajout de la colonne :
// une ligne existante n'est pas réécrite par le seed, elle resterait donc sans
// traduction et s'afficherait en français dans une interface anglaise.
//
// Trois boucles explicites plutôt qu'une générique : les types de requête
// MikroORM ne s'infèrent que sur une entité monomorphe, pas sur une union.
async function backfillEnglishLabels(em: EntityManager) {
  for (const row of await em.find(DataCategoryEntity, {})) {
    row.labelEn ??= seededLabelEn(DATA_CATEGORY_SEEDS, row.code);
  }
  for (const row of await em.find(PurposeEntity, {})) {
    row.labelEn ??= seededLabelEn(PURPOSE_SEEDS, row.code);
  }
  for (const row of await em.find(LegalBasisEntity, {})) {
    row.labelEn ??= seededLabelEn(LEGAL_BASIS_SEEDS, row.code);
  }
}

// null pour une entrée créée hors seed (un système source saisi dans le
// formulaire, par exemple) : le frontend l'affichera dans son unique libellé.
function seededLabelEn(seeds: readonly ReferentialSeed[], code: string): string | null {
  return seeds.find((seed) => seed.code === code)?.labelEn ?? null;
}
