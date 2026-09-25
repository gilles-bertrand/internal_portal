import type { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { computeRecordHash, GENESIS_HASH } from "@libs/backend-shared";
import {
  CURRENT_INCIDENT_CANONICAL_VERSION,
  incidentCanonicalString,
} from "#src/utils/incident-canonical.js";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

const ADVISORY_LOCK_KEY = 1_000_000_003;

export interface NewIncidentInput {
  reportDate: string;
  version: string;
  classification: string;
  status: string;
  applicationName: string;
  applicationDetail: string;
  environment: string;
  clientCode: string;
  clientName: string;
  reportedBy: string;
  encodedBy: string;
  recipientName: string;
  recipientOrg: string;
  legalContext: string;
  serviceName: string;
  deployedVersion: string;
  incidentStartAt: string;
  incidentEndAt: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolutionDurationMinutes: number | null;
  technicalLeadId: string | null;
  description: string;
  descriptionSections: { title: string; body?: string; items?: string[] }[] | null;
  personalDataImpacted: boolean;
  specialCategoryData: boolean;
  apdNotificationRequired: boolean | null;
  impactSummary: string;
  impactDetails: { nature?: string[]; severityIntro?: string; severityPoints?: string[] } | null;
  severityOperational: string | null;
  severityCompliance: string | null;
  severityOverall: string | null;
  affectedPersonsCount: number | null;
  affectedPatientsCount: number | null;
  immediateCause: string;
  contributingFactors: string[];
  correctiveActions: {
    phase?: string;
    order: number;
    title: string;
    detail: string;
    completedAt?: string;
  }[];
  preventiveMeasures: string[];
  communicationPlan: Record<string, unknown>[] | null;
  conclusion: string;
  timelineEvents: { date: string; time: string; event: string }[];
  accessLogs: { date: string; user: string; email: string; files: string; count: number }[] | null;
  issuerSignature: { name: string; role?: string; org?: string; date?: string };
  recipientSignature: { name: string; role?: string; org?: string; date?: string };
}

function referenceYear(reportDate: string): string {
  return new Date(reportDate).getUTCFullYear().toString();
}

// @lat: [[backend/incident-registry#Référence et séquence annuelle globale]]
async function nextAnnualSequence(tx: EntityManager, year: string): Promise<number> {
  const prefix = `INC-${year}-`;
  const rows = await tx.find(IncidentEntity, {
    reference: { $like: `${prefix}%` },
  });
  let max = 0;
  for (const row of rows) {
    const match = row.reference.match(/^INC-\d{4}-(\d{4})-/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

function buildReference(year: string, seq: number, clientCode: string): string {
  return `INC-${year}-${seq.toString().padStart(4, "0")}-${clientCode}`;
}

export class AppendService {
  public constructor(private em: EntityManager) {}

  public async append(input: NewIncidentInput): Promise<IncidentEntityType> {
    return this.em.transactional(async (tx) => {
      await tx.execute(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const [last] = await tx.findAll(IncidentEntity, {
        orderBy: { seq: "DESC" },
        limit: 1,
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const seq = (last?.seq ?? 0) + 1;
      const encodedAt = new Date().toISOString();

      const year = referenceYear(input.reportDate);
      const annualSeq = await nextAnnualSequence(tx, year);
      const reference = buildReference(year, annualSeq, input.clientCode);

      const id = randomUUID();
      // La ligne complète est construite d'abord, puis PROJETÉE sur son jeu de
      // champs canoniques : le hash est calculé sur la projection, jamais sur un
      // objet ad hoc. C'est ce qui garantit que l'écriture et la vérification
      // hachent exactement la même chose (cf. incidentCanonicalString).
      // Le `satisfies` fait échouer le type-check si une colonne de l'entité est
      // oubliée ici — deuxième garde-fou lors d'un ajout de colonne.
      const row = {
        id,
        seq,
        reference,
        encodedAt,
        prevHash,
        ...input,
        canonicalVersion: CURRENT_INCIDENT_CANONICAL_VERSION,
        revision: 1,
        supersededById: null,
        updatedBy: null,
        updatedAt: null,
        deletedAt: null,
        deletedBy: null,
      } satisfies Omit<IncidentEntityType, "hash">;

      const canonical = incidentCanonicalString(row, CURRENT_INCIDENT_CANONICAL_VERSION);
      const hash = computeRecordHash(prevHash, canonical);

      const record: IncidentEntityType = { ...row, hash };
      await tx.getRepository(IncidentEntity).insert(record);

      return record;
    });
  }

  // @lat: [[backend/incident-registry#Édition = nouvelle version (append)]]
  // Édite un incident en AJOUTANT une nouvelle version chaînée (l'original reste
  // immuable). Même `reference`, `revision + 1`, identité d'origine préservée
  // (`encodedBy`/`encodedAt`). L'ancienne version est marquée `supersededById`
  // (champ non canonique → la chaîne de hash reste valide).
  public async appendNewVersion(
    previous: IncidentEntityType,
    input: NewIncidentInput,
    editorId: string,
  ): Promise<IncidentEntityType> {
    return this.em.transactional(async (tx) => {
      await tx.execute(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const current = await tx.findOne(IncidentEntity, { id: previous.id });
      if (!current || current.supersededById !== null || current.deletedAt != null) {
        throw new Error("NOT_CURRENT_VERSION");
      }

      const [last] = await tx.findAll(IncidentEntity, {
        orderBy: { seq: "DESC" },
        limit: 1,
      });
      const prevHash = last?.hash ?? GENESIS_HASH;
      const seq = (last?.seq ?? 0) + 1;
      const id = randomUUID();
      const now = new Date().toISOString();

      // Une nouvelle version est une nouvelle ligne : elle est estampillée à la
      // version canonique COURANTE, même si la ligne éditée était en v1. La
      // chaîne devient mixte, ce que verifyIncidentChain gère par construction.
      const row = {
        id,
        seq,
        reference: current.reference,
        encodedAt: current.encodedAt,
        prevHash,
        ...input,
        // Préserve l'auteur d'origine (identité + permission "édite les siens").
        encodedBy: current.encodedBy,
        canonicalVersion: CURRENT_INCIDENT_CANONICAL_VERSION,
        revision: current.revision + 1,
        supersededById: null,
        updatedBy: editorId,
        updatedAt: now,
        deletedAt: null,
        deletedBy: null,
      } satisfies Omit<IncidentEntityType, "hash">;

      const canonical = incidentCanonicalString(row, CURRENT_INCIDENT_CANONICAL_VERSION);
      const hash = computeRecordHash(prevHash, canonical);

      const record: IncidentEntityType = { ...row, hash };
      await tx.getRepository(IncidentEntity).insert(record);

      // Champ non canonique → n'affecte pas le hash de l'ancienne ligne.
      await tx.nativeUpdate(IncidentEntity, { id: current.id }, { supersededById: id });

      return record;
    });
  }

  // Soft-delete : pose deletedAt/deletedBy (non canoniques) — pas de DELETE physique.
  public async softDelete(id: string, byUserId: string): Promise<void> {
    await this.em.nativeUpdate(
      IncidentEntity,
      { id },
      { deletedAt: new Date().toISOString(), deletedBy: byUserId },
    );
  }

  public async restore(id: string): Promise<void> {
    await this.em.nativeUpdate(IncidentEntity, { id }, { deletedAt: null, deletedBy: null });
  }
}
