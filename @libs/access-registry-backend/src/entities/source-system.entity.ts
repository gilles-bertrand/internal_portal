import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const SourceSystemEntity = defineEntity({
  name: "SourceSystem",
  tableName: "source_system",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
    // Cf. PurposeEntity. Toujours null pour les systèmes créés depuis le
    // formulaire (« + Ajouter un système ») : l'utilisateur ne saisit qu'un
    // libellé, affiché tel quel dans les deux locales.
    labelEn: p.string().nullable(),
  },
});

export type SourceSystemEntityType = InferEntity<typeof SourceSystemEntity>;
