import { describe, expect, it } from "vitest";
import { buildAbility } from "@libs/permissions-backend";
import type { PermissionRuleEntityType } from "@libs/permissions-backend";
import { canReadAuditEvent, subjectForTargetType } from "#src/utils/audit-scope.js";

// Abilities construites par le VRAI constructeur CASL, à partir de règles ayant
// la forme de celles stockées en base : un test qui simulerait `ability.can`
// vérifierait sa propre simulation, pas la règle réellement appliquée.
function abilityFor(
  rules: { action: string; subject: string; inverted?: boolean; order?: number }[],
) {
  return buildAbility(
    rules.map(
      (rule, index) =>
        ({
          action: rule.action,
          subject: rule.subject,
          conditions: null,
          inverted: rule.inverted ?? false,
          order: rule.order ?? index,
        }) as unknown as PermissionRuleEntityType,
    ),
    { id: "user-1" } as never,
  );
}

describe("subjectForTargetType", () => {
  // La convention de préfixe est le contrat : une route qui écrit
  // `incident_verify` demain doit être rattachée sans modifier ce module.
  it("rattache chaque targetType à son domaine par préfixe", () => {
    expect(subjectForTargetType("incident")).toBe("Incident");
    expect(subjectForTargetType("incident_list")).toBe("Incident");
    expect(subjectForTargetType("incident_export")).toBe("Incident");
    expect(subjectForTargetType("access_record")).toBe("AccessRecord");
    expect(subjectForTargetType("access_record_retention")).toBe("AccessRecord");
  });

  it("ne rattache rien à un targetType inconnu", () => {
    expect(subjectForTargetType("facturation")).toBeUndefined();
  });
});

describe("canReadAuditEvent", () => {
  // RÉGRESSION DE SÉCURITÉ, constatée en production le 2026-09-18.
  //
  // `tech_admin` reçoit un 403 sur tout le préfixe `/incidents` — la règle
  // `manage Incident` lui est explicitement refusée — et lisait pourtant 78
  // événements d'incidents par le journal d'audit : qui a créé, consulté,
  // exporté et supprimé quel incident, horodaté et nominatif. Le journal
  // rendait observable exactement ce que l'interdiction voulait soustraire.
  it("masque au tech_admin les événements du domaine dont il est banni", () => {
    const techAdmin = abilityFor([
      { action: "manage", subject: "User" },
      { action: "manage", subject: "Role" },
      { action: "read", subject: "AccessRecord" },
      { action: "read", subject: "AuditEvent" },
      { action: "manage", subject: "Incident", inverted: true, order: 10 },
    ]);

    expect(canReadAuditEvent(techAdmin, "incident")).toBe(false);
    expect(canReadAuditEvent(techAdmin, "incident_export")).toBe(false);
    // …sans lui retirer ce à quoi il a légitimement droit.
    expect(canReadAuditEvent(techAdmin, "access_record")).toBe(true);
    expect(canReadAuditEvent(techAdmin, "access_record_list")).toBe(true);
  });

  it("laisse le DPO voir les deux domaines", () => {
    const dpo = abilityFor([
      { action: "read", subject: "AccessRecord" },
      { action: "read", subject: "Incident" },
      { action: "read", subject: "AuditEvent" },
    ]);

    expect(canReadAuditEvent(dpo, "incident")).toBe(true);
    expect(canReadAuditEvent(dpo, "access_record_export")).toBe(true);
  });

  // Le défaut va vers la discrétion : un domaine ajouté sans déclarer son
  // préfixe disparaît du journal plutôt que de s'y montrer à tout le monde.
  // C'est l'inverse de la règle des drapeaux de fonctionnalité, parce que
  // l'enjeu est inverse — là il s'agissait de ne pas amputer le produit par
  // accident, ici de ne pas divulguer par accident.
  it("masque un targetType inconnu, même à qui peut tout lire", () => {
    const dpo = abilityFor([
      { action: "manage", subject: "all" },
      { action: "read", subject: "AuditEvent" },
    ]);

    expect(canReadAuditEvent(dpo, "un_domaine_pas_encore_declare")).toBe(false);
  });
});
