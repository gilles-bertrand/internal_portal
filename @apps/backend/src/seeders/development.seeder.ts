import { hashPassword, UserEntity } from "@libs/users-backend";
import { DataCategoryEntity, LegalBasisEntity, PurposeEntity } from "@libs/access-registry-backend";
import { AppendService, IncidentEntity } from "@libs/incident-registry-backend";
import { PermissionRuleEntity, RoleEntity, type RoleEntityType } from "@libs/permissions-backend";
import type { EntityManager } from "@mikro-orm/core";
import { Seeder } from "@mikro-orm/seeder";
import { randomUUID } from "crypto";
import { incidentIPBW, incidentOCM } from "./seed-data/incidents.js";

interface RuleSeed {
  action: string;
  subject: string;
  conditions?: Record<string, unknown> | null;
  inverted?: boolean;
  order?: number;
}

// @lat: [[backend/permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]]
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager) {
    const hashedPassword = await hashPassword("123456789");
    const techAdminPassword = await hashPassword("Loupus69!");
    const roles = await this.seedRolesAndPermissions(em);
    await this.seedUsers(em, hashedPassword, techAdminPassword, roles);
    await this.seedReferentials(em);
    await this.seedIncidents(em);
  }

  private async seedRolesAndPermissions(em: EntityManager) {
    const roles = {
      encoder: await this.ensureRole(em, "encoder", "Encode les accès et incidents"),
      dpo: await this.ensureRole(em, "dpo", "Délégué à la protection des données"),
      auditor: await this.ensureRole(em, "auditor", "Audite l'intégrité des registres"),
      tech_admin: await this.ensureRole(em, "tech_admin", "Administration technique et comptes"),
    };

    await this.ensureRules(em, roles.encoder, [
      { action: "create", subject: "AccessRecord" },
      { action: "read", subject: "AccessRecord", conditions: { encodedBy: "$user.id" } },
      { action: "create", subject: "Incident" },
      { action: "read", subject: "Incident" },
      { action: "update", subject: "Incident", conditions: { encodedBy: "$user.id" } },
      { action: "delete", subject: "Incident", conditions: { encodedBy: "$user.id" } },
    ]);
    await this.ensureRules(em, roles.dpo, [
      { action: "read", subject: "AccessRecord" },
      { action: "manage", subject: "AccessRecordRetention" },
      { action: "read", subject: "AccessRecordIntegrity" },
      { action: "read", subject: "IncidentIntegrity" },
      { action: "read", subject: "Incident" },
      { action: "update", subject: "Incident" },
      { action: "delete", subject: "Incident" },
      { action: "restore", subject: "Incident" },
    ]);
    await this.ensureRules(em, roles.auditor, [
      { action: "read", subject: "AccessRecord" },
      { action: "read", subject: "AccessRecordIntegrity" },
      { action: "read", subject: "IncidentIntegrity" },
      { action: "read", subject: "Incident" },
    ]);
    await this.ensureRules(em, roles.tech_admin, [
      { action: "manage", subject: "User" },
      { action: "manage", subject: "Role" },
      // tech_admin accède au registre d'accès en lecture (list/get/export/stats/audit-events).
      { action: "read", subject: "AccessRecord" },
      { action: "manage", subject: "Incident", inverted: true, order: 10 },
    ]);

    return roles;
  }

  private async seedUsers(
    em: EntityManager,
    hashedPassword: string,
    techAdminPassword: string,
    roles: Record<string, RoleEntityType>,
  ) {
    await this.ensureUser(em, {
      id: "e2e-login-user",
      email: "deflorenne.amaury@triptyk.eu",
      firstName: "Amaury",
      lastName: "Deflorenne",
      password: hashedPassword,
      role: roles.encoder!,
    });
    await this.ensureUser(em, {
      id: "e2e-dpo-user",
      email: "dpo@triptyk.eu",
      firstName: "Camille",
      lastName: "DPO",
      password: hashedPassword,
      role: roles.dpo!,
    });
    await this.ensureUser(em, {
      id: "e2e-tech-admin-user",
      email: "gilles@triptyk.eu",
      firstName: "Gilles",
      lastName: "Bertrand",
      password: techAdminPassword,
      role: roles.tech_admin!,
    });
    await this.ensureUser(em, {
      id: "e2e-auditor-user",
      email: "auditor@triptyk.eu",
      firstName: "Alex",
      lastName: "Auditor",
      password: hashedPassword,
      role: roles.auditor!,
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

  private async ensureRole(
    em: EntityManager,
    name: string,
    description: string,
  ): Promise<RoleEntityType> {
    const existing = await em.findOne(RoleEntity, { name });
    if (existing) return existing;
    return em.create(RoleEntity, { id: randomUUID(), name, description });
  }

  private async ensureRules(em: EntityManager, role: RoleEntityType, rules: RuleSeed[]) {
    const existingCount = await em.count(PermissionRuleEntity, { role: role.id });
    if (existingCount > 0) return;

    for (const rule of rules) {
      em.create(PermissionRuleEntity, {
        id: randomUUID(),
        role: role.id,
        action: rule.action,
        subject: rule.subject,
        conditions: rule.conditions ?? null,
        fields: null,
        inverted: rule.inverted ?? false,
        order: rule.order ?? 0,
      });
    }
  }

  private async ensureUser(
    em: EntityManager,
    data: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      role: RoleEntityType;
    },
  ) {
    const existing = await em.findOne(UserEntity, { id: data.id });
    if (!existing) em.create(UserEntity, data);
  }
}
