import { createHash, createHmac } from "node:crypto";
import { GENESIS_HASH } from "@libs/backend-shared";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";
import {
  jsonApiSerializeManyIncidents,
  jsonApiSerializeIncident,
} from "#src/serializers/incident.serializer.js";
import { verifyIncidentChain } from "#src/utils/integrity.js";
import { buildRegistryPdf } from "#src/utils/export-registry-pdf.js";
import { buildIncidentPdf } from "#src/utils/export-incident-pdf.js";

export type ExportFormat = "json" | "csv" | "pdf";

export interface ExportManifest {
  generatedAt: string;
  generatedBy: string;
  count: number;
  chainHeadHash: string;
  contentSha256: string;
  integrityOk: boolean;
  integrityBrokenAt?: number;
  integrityReason?: string;
}

export interface ExportResult {
  format: ExportFormat;
  encoding: "utf-8" | "base64";
  content: string;
  manifest: ExportManifest;
  signature: string;
}

const CSV_COLUMNS = [
  "seq",
  "id",
  "reference",
  "reportDate",
  "encodedAt",
  "encodedBy",
  "clientCode",
  "clientName",
  "status",
  "classification",
  "environment",
  "applicationName",
  "specialCategoryData",
  "personalDataImpacted",
  "severityOverall",
  "incidentStartAt",
  "detectedAt",
  "resolvedAt",
  "prevHash",
  "hash",
] as const;

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(records: IncidentEntityType[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) =>
    CSV_COLUMNS.map((c) => {
      const v = r[c as keyof IncidentEntityType];
      return csvEscape(v as string | number | boolean | null | undefined);
    }).join(","),
  );
  return [header, ...rows].join("\n");
}

function signContent(signingKey: string, rawContent: Buffer) {
  const contentSha256 = createHash("sha256").update(rawContent).digest("hex");
  const signature = createHmac("sha256", signingKey).update(rawContent).digest("hex");
  return { contentSha256, signature };
}

export class ExportService {
  public constructor(private signingKey: string) {}

  public async buildRegistry(
    records: IncidentEntityType[],
    format: ExportFormat,
    generatedBy: string,
    generatedAt: string,
  ): Promise<ExportResult> {
    const integrity = verifyIncidentChain(records);
    const chainHeadHash = records.length > 0 ? records[records.length - 1]!.hash : GENESIS_HASH;

    const manifestBase = {
      generatedAt,
      generatedBy,
      count: records.length,
      chainHeadHash,
      integrityOk: integrity.ok,
      ...(integrity.brokenAt !== undefined ? { integrityBrokenAt: integrity.brokenAt } : {}),
      ...(integrity.reason !== undefined ? { integrityReason: integrity.reason } : {}),
    };

    let rawContent: Buffer;
    let encoding: "utf-8" | "base64";

    if (format === "json") {
      rawContent = Buffer.from(
        JSON.stringify({
          integrity: {
            ok: integrity.ok,
            total: integrity.total,
            chainHeadHash,
            ...(integrity.brokenAt !== undefined ? { brokenAt: integrity.brokenAt } : {}),
            ...(integrity.reason !== undefined ? { reason: integrity.reason } : {}),
          },
          data: jsonApiSerializeManyIncidents(records),
        }),
        "utf-8",
      );
      encoding = "utf-8";
    } else if (format === "csv") {
      const integrityLine = integrity.ok
        ? `# integrity:OK count=${integrity.total} chainHeadHash=${chainHeadHash}`
        : `# integrity:BROKEN at=${integrity.brokenAt ?? ""} reason=${integrity.reason ?? ""}`;
      rawContent = Buffer.from([integrityLine, buildCsv(records)].join("\n"), "utf-8");
      encoding = "utf-8";
    } else {
      rawContent = await buildRegistryPdf(records, manifestBase);
      encoding = "base64";
    }

    const { contentSha256, signature } = signContent(this.signingKey, rawContent);

    return {
      format,
      encoding,
      content: encoding === "base64" ? rawContent.toString("base64") : rawContent.toString("utf-8"),
      manifest: { ...manifestBase, contentSha256 },
      signature,
    };
  }

  public async buildOne(
    incident: IncidentEntityType,
    generatedBy: string,
    generatedAt: string,
  ): Promise<ExportResult> {
    const integrity = verifyIncidentChain([incident]);
    const chainHeadHash = incident.hash;

    const manifestBase = {
      generatedAt,
      generatedBy,
      count: 1,
      chainHeadHash,
      integrityOk: integrity.ok,
    };

    const rawContent = await buildIncidentPdf(incident);
    const { contentSha256, signature } = signContent(this.signingKey, rawContent);

    return {
      format: "pdf",
      encoding: "base64",
      content: rawContent.toString("base64"),
      manifest: { ...manifestBase, contentSha256 },
      signature,
    };
  }
}

export { jsonApiSerializeIncident };
