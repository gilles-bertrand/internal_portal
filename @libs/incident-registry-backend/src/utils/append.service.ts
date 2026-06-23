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
      const partialRecord = {
        id,
        seq,
        reference,
        encodedAt,
        prevHash,
        ...input,
      };

      const canonical = canonicalSerialize(partialRecord as unknown as Record<string, unknown>);
      const hash = computeRecordHash(prevHash, canonical);

      const record: IncidentEntityType = { ...partialRecord, hash };
      await tx.getRepository(IncidentEntity).insert(record);

      return record;
    });
  }
}
