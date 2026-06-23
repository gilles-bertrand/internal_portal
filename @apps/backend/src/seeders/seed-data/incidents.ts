/* oxlint-disable max-lines, max-lines-per-function -- données de seed déclaratives (gros objets littéraux) */
import type { NewIncidentInput } from "@libs/incident-registry-backend";

const IPBW_SIGNATURES = {
  issuerSignature: { name: "RSSI Triptyk", role: "RSSI", org: "Triptyk SRL", date: "2026-02-20" },
  recipientSignature: { name: "DSI IPBW", role: "DSI", org: "IPBW SA", date: "2026-02-20" },
};

const OCM_SIGNATURES = {
  issuerSignature: {
    name: "Gilles Bertrand",
    role: "Gérant",
    org: "Triptyk SRL",
    date: "2026-04-03",
  },
  recipientSignature: {
    name: "Patrick Burgeon",
    role: "Administrateur chargé de la gestion journalière",
    org: "OCM",
    date: "2026-04-03",
  },
};

const OCM_IMPACT_DETAILS = {
  nature: [
    "Visibilité et téléchargement non autorisés de feuillets médicaux confidentiels par des employés de la société IMAJE sur le portail extranet.",
    "4 personnes identifiées ont accédé aux documents : Anne Herbiet, Megane Frankinet, Marine Malaise, Nathalie Michel (toutes employées IMAJE).",
    "1 patient concerné : Deborah Deom.",
    "L'incident a un impact sur des données à caractère personnel sensibles (données médicales).",
  ],
  severityIntro: "Impact global : Faible.",
  severityPoints: [
    "Impact individuel non négligeable mais très limité dans l'étendue.",
    "Criticité opérationnelle : Basse (incident ponctuel, résolu, limité à 4 personnes connues, 1 patient).",
    "Criticité conformité / réputationnelle : Modérée (données sensibles, relation employeur/employé, organisme médical).",
    "Pas de malveillance externe, pas de piratage, pas de dissémination de l'information.",
  ],
};

const OCM_CORRECTIVE_ACTIONS = [
  {
    phase: "Phase 1",
    order: 1,
    title: "Détection",
    detail: "Détection de l'incident le 3 avril 2026 à 09h13.",
    completedAt: "2026-04-03T09:13:00.000Z",
  },
  {
    phase: "Phase 1",
    order: 2,
    title: "Suppression accès",
    detail:
      "Suppression immédiate de la visibilité et de la possibilité de télécharger les feuillets médicaux sur le portail extranet.",
    completedAt: "2026-04-03T09:47:00.000Z",
  },
  {
    phase: "Phase 2",
    order: 3,
    title: "Suppression échange",
    detail:
      "Identification et suppression de la possibilité d'échange des feuillets sensibles entre les différents acteurs du système.",
  },
  {
    phase: "Phase 2",
    order: 4,
    title: "Audit permissions",
    detail: "Audit complet des permissions d'accès aux documents sur le portail.",
  },
];

const OCM_TIMELINE = [
  {
    date: "02/04/2026",
    time: "07h58",
    event: "Premiers accès non autorisés aux feuillets médicaux par Anne Herbiet (IMAJE)",
  },
  { date: "02/04/2026", time: "09h30", event: "Accès par Megane Frankinet (IMAJE)" },
  { date: "02/04/2026", time: "14h42", event: "Accès par Marine Malaise (IMAJE)" },
  { date: "03/04/2026", time: "07h15", event: "Accès par Nathalie Michel (IMAJE)" },
  {
    date: "03/04/2026",
    time: "09h13",
    event: "Détection et signalement de l'incident par Laetitia Manias (OCM)",
  },
  {
    date: "03/04/2026",
    time: "09h47",
    event:
      "Phase 1 : Suppression de la visibilité et du téléchargement des feuillets sur le portail",
  },
  {
    date: "03/04/2026",
    time: "En cours",
    event:
      "Phase 2 : Identification et suppression de la possibilité d'échange des feuillets sensibles",
  },
];

const OCM_ACCESS_LOGS = [
  {
    date: "02/04/2026",
    user: "HERBIET Anne",
    email: "anne-sophie.herbiet@imaje-interco.be",
    files: "Feuillet Patient + Feuillet Médecin",
    count: 5,
  },
  {
    date: "02/04/2026",
    user: "FRANKINET Megane",
    email: "megane.frankinet@imaje-interco.be",
    files: "Feuillet Médecin",
    count: 1,
  },
  {
    date: "02/04/2026",
    user: "MALAISE Marine",
    email: "marine.malaise@imaje-interco.be",
    files: "Feuillet Patient + Feuillet Médecin",
    count: 3,
  },
  {
    date: "03/04/2026",
    user: "MICHEL Nathalie",
    email: "nathalie.michel@imaje-interco.be",
    files: "Feuillet Patient + Feuillet Médecin",
    count: 2,
  },
];

export function incidentIPBW(): NewIncidentInput {
  return {
    reportDate: "2026-02-20T10:00:00.000Z",
    version: "1.0",
    classification: "CONFIDENTIEL",
    status: "resolved",
    applicationName: "Portail Admin IPBW",
    applicationDetail: "Module gestion utilisateurs",
    environment: "production",
    clientCode: "IPBW",
    clientName: "IPBW SA",
    reportedBy: "Support N1",
    encodedBy: "e2e-login-user",
    recipientName: "Direction IT",
    recipientOrg: "IPBW",
    legalContext:
      "Incident technique affectant l'authentification administrative. Traçabilité interne RGPD.",
    serviceName: "API Auth",
    deployedVersion: "2.4.1",
    incidentStartAt: "2026-02-19T08:00:00.000Z",
    incidentEndAt: "2026-02-19T12:30:00.000Z",
    detectedAt: "2026-02-19T08:15:00.000Z",
    resolvedAt: "2026-02-19T12:30:00.000Z",
    resolutionDurationMinutes: 255,
    technicalLeadId: null,
    description: "Défaillance du service d'authentification après déploiement.",
    descriptionSections: [
      { title: "Code défaillant", body: "NullPointerException dans AuthService" },
      { title: "Code corrigé", body: "Rollback vers 2.4.0" },
    ],
    personalDataImpacted: true,
    specialCategoryData: false,
    apdNotificationRequired: false,
    impactSummary: "50 comptes administrateurs exposés temporairement",
    impactDetails: null,
    severityOperational: "high",
    severityCompliance: "medium",
    severityOverall: "high",
    affectedPersonsCount: 50,
    affectedPatientsCount: null,
    immediateCause: "Régression après déploiement",
    contributingFactors: ["Absence de test de non-régression automatisé"],
    correctiveActions: [
      {
        order: 1,
        title: "Rollback",
        detail: "Retour version 2.4.0",
        completedAt: "2026-02-19T13:00:00.000Z",
      },
    ],
    preventiveMeasures: ["Renforcer la couverture de tests CI"],
    communicationPlan: [
      { audience: "clients", channel: "email", message: "Information incident résolu" },
    ],
    conclusion: "Incident résolu. Pas de notification APD requise.",
    timelineEvents: [
      { date: "2026-02-19", time: "08:00", event: "Début incident" },
      { date: "2026-02-19", time: "08:15", event: "Détection monitoring" },
      { date: "2026-02-19", time: "12:30", event: "Résolution confirmée" },
    ],
    accessLogs: null,
    ...IPBW_SIGNATURES,
  };
}

export function incidentOCM(): NewIncidentInput {
  return {
    reportDate: "2026-04-03T00:00:00.000Z",
    version: "1.0 — Version initiale",
    classification: "CONFIDENTIEL",
    status: "Résolu (Phase 1)",
    applicationName: "OCM — Portail Extranet Entreprises Clientes",
    applicationDetail: "Portail extranet entreprises",
    environment: "production",
    clientCode: "OCM",
    clientName: "OCM",
    reportedBy: "Laetitia Manias (OCM) / Employé société IMAJE",
    encodedBy: "e2e-login-user",
    recipientName: "OCM — Direction",
    recipientOrg: "OCM",
    legalContext:
      "Conformément à nos obligations contractuelles et légales, ainsi qu'aux exigences du Règlement Général sur la Protection des Données (RGPD), Triptyk SRL informe par la présente ses parties prenantes d'un incident de sécurité impliquant des données à caractère personnel sensibles (données médicales) survenu sur le portail extranet de l'organisme de contrôle médical OCM.\n\nCe document constitue le rapport officiel d'incident rédigé conformément aux bonnes pratiques de gestion des incidents informatiques (ITIL).",
    serviceName: "Consultation des feuillets médicaux (résultats de contrôle)",
    deployedVersion: "—",
    incidentStartAt: "2026-04-02T07:58:00.000Z",
    incidentEndAt: "2026-04-03T09:47:00.000Z",
    detectedAt: "2026-04-03T09:13:00.000Z",
    resolvedAt: "2026-04-03T09:47:00.000Z",
    resolutionDurationMinutes: 34,
    technicalLeadId: "e2e-dpo-user",
    description:
      "Les sociétés clientes de l'OCM disposent d'un portail extranet leur permettant de gérer les demandes de contrôle médical de leurs employés. Sur ce portail, des feuillets en PDF contenant les résultats médicaux de patients étaient visibles et téléchargeables par les entreprises.\n\nCes feuillets, qui ne peuvent normalement être consultés qu'à la discrétion du patient, du médecin contrôleur et de l'organisme de contrôle OCM, étaient accessibles aux employés de la société IMAJE via leur interface employeur.\n\nLes employeurs pouvaient ainsi voir les résultats et les commentaires émis par le médecin contrôleur, ainsi que la pathologie mentionnée sur le certificat du médecin fourni par le patient.",
    descriptionSections: [
      {
        title: "3.1 Documents concernés",
        items: [
          "Feuillet patient : certificat médical fourni par le patient (RCM-31032026_PATIENT-DEBORAH_DEOM)",
          "Feuillet médecin contrôleur : rapport du médecin OCM (RCM-31032026_OCM-MEDECIN-DEBORAH_DEOM)",
        ],
      },
      { title: "3.2 Patient concerné", body: "Deborah Deom — 1 patient identifié." },
    ],
    personalDataImpacted: true,
    specialCategoryData: true,
    apdNotificationRequired: null,
    impactSummary:
      "Visibilité et téléchargement non autorisés de feuillets médicaux confidentiels par 4 employés de la société IMAJE.",
    impactDetails: OCM_IMPACT_DETAILS,
    severityOperational: "low",
    severityCompliance: "moderate",
    severityOverall: "low",
    affectedPersonsCount: 4,
    affectedPatientsCount: 1,
    immediateCause:
      "Les feuillets médicaux (certificat patient et rapport du médecin contrôleur) étaient accessibles sur le portail extranet des entreprises clientes alors qu'ils auraient dû être restreints aux seuls utilisateurs autorisés (patient, médecin contrôleur, OCM).",
    contributingFactors: [],
    correctiveActions: OCM_CORRECTIVE_ACTIONS,
    preventiveMeasures: [
      "Mise en place de contrôles d'accès renforcés pour les documents médicaux avec vérification systématique des permissions à chaque téléchargement.",
      "Ajout de tests automatisés vérifiant l'isolation des documents sensibles par type d'utilisateur.",
      "Audit de sécurité global du portail extranet pour identifier d'éventuelles vulnérabilités similaires.",
    ],
    communicationPlan: null,
    conclusion:
      "La Phase 1 de résolution de l'incident est entièrement terminée depuis le 3 avril 2026 à 09h47. La visibilité et le téléchargement des feuillets médicaux ont été supprimés du portail extranet.\n\nLa Phase 2, consistant à identifier et supprimer la possibilité d'échange des feuillets sensibles, est en cours de mise en œuvre et devrait être implémentée aujourd'hui.\n\nL'incident étant lié à des données à caractère personnel de nature médicale (catégorie spéciale au sens de l'article 9 du RGPD), une évaluation de la nécessité de notification à l'Autorité de Protection des Données (APD) doit être réalisée conformément à l'article 33 du RGPD.\n\nTriptyk SRL reste à la disposition de l'OCM pour tout complément d'information, action conjointe ou audit supplémentaire si nécessaire.",
    timelineEvents: OCM_TIMELINE,
    accessLogs: OCM_ACCESS_LOGS,
    ...OCM_SIGNATURES,
  };
}
