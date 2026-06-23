import { hashPassword, UserEntity } from "@libs/users-backend";
import { DataCategoryEntity, LegalBasisEntity, PurposeEntity } from "@libs/access-registry-backend";
import { AppendService, IncidentEntity } from "@libs/incident-registry-backend";
import type { EntityManager } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";
import { incidentIPBW, incidentOCM } from "#src/seeders/seed-data/incidents.js";

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager) {
    const hashedPassword = await hashPassword("123456789");
    await this.seedUsers(em, hashedPassword);
    await this.seedReferentials(em);
    await this.seedIncidents(em);
  }

  private async seedUsers(em: EntityManager, hashedPassword: string) {
    await this.ensureUser(em, {
      id: "e2e-login-user",
      email: "deflorenne.amaury@triptyk.eu",
      firstName: "Amaury",
      lastName: "Deflorenne",
      password: hashedPassword,
      role: "encoder",
    });
    await this.ensureUser(em, {
      id: "e2e-dpo-user",
      email: "dpo@triptyk.eu",
      firstName: "Camille",
      lastName: "DPO",
      password: hashedPassword,
      role: "dpo",
    });
  }

  private async seedReferentials(em: EntityManager) {
    for (const [id, code, label] of [
      ["dc-identity", "identity", "Identité"],
      ["dc-contact", "contact", "Contact"],
      ["dc-financial", "financial", "Financier"],
      ["dc-health", "health", "Santé"],
    ] as [string, string, string][]) {
      await this.ensureEntity(em, DataCategoryEntity, { id, code, label });
    }
    for (const [id, code, label] of [
      ["p-support", "support", "Support client"],
      ["p-billing", "billing", "Facturation"],
      ["p-legal", "legal", "Obligation légale"],
    ] as [string, string, string][]) {
      await this.ensureEntity(em, PurposeEntity, { id, code, label });
    }
    for (const [id, code, label, isArticle9] of [
      ["lb-6-1-b", "art6.1b", "Exécution d'un contrat (art. 6.1.b)", false],
      ["lb-6-1-c", "art6.1c", "Obligation légale (art. 6.1.c)", false],
      ["lb-9-2-h", "art9.2h", "Médecine préventive (art. 9.2.h)", true],
      ["lb-9-2-a", "art9.2a", "Consentement explicite (art. 9.2.a)", true],
    ] as [string, string, string, boolean][]) {
      await this.ensureEntity(em, LegalBasisEntity, { id, code, label, isArticle9 });
    }
  }

  private async seedIncidents(em: EntityManager) {
    const appendService = new AppendService(em);
    const existingCount = await em.count(IncidentEntity);
    if (existingCount !== 0) return;
    await appendService.append(incidentIPBW());
    await appendService.append(incidentOCM());
  }

  private async ensureEntity<T extends { id: string }>(
    em: EntityManager,
    entity: new () => T,
    data: T,
  ) {
    const existing = await em.findOne(entity, { id: data.id });
    if (!existing) em.create(entity, data);
  }

  private async ensureUser(
    em: EntityManager,
    data: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      role: string;
    },
  ) {
    const existing = await em.findOne(UserEntity, { id: data.id });
    if (!existing) em.create(UserEntity, data);
  }
}
