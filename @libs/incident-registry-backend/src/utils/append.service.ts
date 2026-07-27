import type { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { canonicalSerialize, computeRecordHash, GENESIS_HASH } from "@libs/backend-shared";
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
      // contentRecord = source canonique (hors champs lifecycle) : ce sur quoi
      // le hash est calculé. Les champs lifecycle sont ajoutés ensuite et ne
      // participent PAS au hash (cf. incidentCanonicalFields).
      const contentRecord = {
        id,
        seq,
        reference,
        encodedAt,
        prevHash,
        ...input,
      };

      const canonical = canonicalSerialize(contentRecord as unknown as Record<string, unknown>);
      const hash = computeRecordHash(prevHash, canonical);

      const record: IncidentEntityType = {
        ...contentRecord,
        hash,
        revision: 1,
        supersededById: null,
        updatedBy: null,
        updatedAt: null,
        deletedAt: null,
        deletedBy: null,
      };
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

      const contentRecord = {
        id,
        seq,
        reference: current.reference,
        encodedAt: current.encodedAt,
        prevHash,
        ...input,
        // Préserve l'auteur d'origine (identité + permission "édite les siens").
        encodedBy: current.encodedBy,
      };

      const canonical = canonicalSerialize(contentRecord as unknown as Record<string, unknown>);
      const hash = computeRecordHash(prevHash, canonical);

      const record: IncidentEntityType = {
        ...contentRecord,
        hash,
        revision: current.revision + 1,
        supersededById: null,
        updatedBy: editorId,
        updatedAt: now,
        deletedAt: null,
        deletedBy: null,
      };
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
