interface PermissionRuleSeed {
  role: "encoder" | "dpo" | "auditor" | "tech_admin";
  action: string;
  subject: string;
  conditions?: Record<string, unknown> | null;
  inverted?: boolean;
  order?: number;
}

// Miroir de @apps/backend/src/seeders/development.seeder.ts#seedRolesAndPermissions —
// garde les tests d'intégration fidèles au comportement réellement seedé en prod.
export const PERMISSION_RULE_SEED: PermissionRuleSeed[] = [
  { role: "encoder", action: "create", subject: "AccessRecord" },
  {
    role: "encoder",
    action: "read",
    subject: "AccessRecord",
    conditions: { encodedBy: "$user.id" },
  },
  { role: "encoder", action: "create", subject: "Incident" },
  { role: "encoder", action: "read", subject: "Incident" },
  { role: "dpo", action: "read", subject: "AccessRecord" },
  { role: "dpo", action: "manage", subject: "AccessRecordRetention" },
  { role: "dpo", action: "read", subject: "AccessRecordIntegrity" },
  { role: "dpo", action: "read", subject: "IncidentIntegrity" },
  { role: "dpo", action: "read", subject: "Incident" },
  { role: "auditor", action: "read", subject: "AccessRecord" },
  { role: "auditor", action: "read", subject: "AccessRecordIntegrity" },
  { role: "auditor", action: "read", subject: "IncidentIntegrity" },
  { role: "auditor", action: "read", subject: "Incident" },
  { role: "tech_admin", action: "manage", subject: "User" },
  { role: "tech_admin", action: "manage", subject: "Role" },
  { role: "tech_admin", action: "manage", subject: "AccessRecord", inverted: true, order: 10 },
  { role: "tech_admin", action: "manage", subject: "Incident", inverted: true, order: 10 },
];
