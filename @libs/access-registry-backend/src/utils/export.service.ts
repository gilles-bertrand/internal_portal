import { createHash, createHmac } from "node:crypto";
import { GENESIS_HASH } from "@libs/backend-shared";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { jsonApiSerializeManyAccessRecords } from "#src/serializers/access-record.serializer.js";
import { verifyAccessRecordChain } from "#src/utils/integrity.js";
import { buildPdf } from "#src/utils/export-pdf.js";

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
  "accessedAt",
  "encodedAt",
  "encodedBy",
  "accessorRef",
  "dataSubjectRef",
  "dataCategories",
  "isSpecialCategory",
  "accessType",
  "purpose",
  "legalBasis",
  "sourceSystem",
  "recipient",
  "justification",
  "retentionUntil",
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

function buildCsv(records: AccessRecordEntityType[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) =>
    CSV_COLUMNS.map((c) => {
      const v = r[c as keyof AccessRecordEntityType];
      if (Array.isArray(v)) {
        return csvEscape((v as string[]).join("|"));
      }
      return csvEscape(v as string | number | boolean | null | undefined);
    }).join(","),
  );
  return [header, ...rows].join("\n");
}

interface IntegrityResult {
  ok: boolean;
  total: number;
  brokenAt?: number;
  reason?: string;
}

function buildManifestBase(
  integrity: IntegrityResult,
  chainHeadHash: string,
  generatedAt: string,
  generatedBy: string,
  count: number,
): Omit<ExportManifest, "contentSha256"> {
  return {
    generatedAt,
    generatedBy,
    count,
    chainHeadHash,
    integrityOk: integrity.ok,
    ...(integrity.brokenAt !== undefined ? { integrityBrokenAt: integrity.brokenAt } : {}),
    ...(integrity.reason !== undefined ? { integrityReason: integrity.reason } : {}),
  };
}

function buildJsonContent(
  records: AccessRecordEntityType[],
  integrity: IntegrityResult,
  chainHeadHash: string,
): Buffer {
  return Buffer.from(
    JSON.stringify({
      integrity: {
        ok: integrity.ok,
        total: integrity.total,
        chainHeadHash,
        ...(integrity.brokenAt !== undefined ? { brokenAt: integrity.brokenAt } : {}),
        ...(integrity.reason !== undefined ? { reason: integrity.reason } : {}),
      },
      data: jsonApiSerializeManyAccessRecords(records),
    }),
    "utf-8",
  );
}

function buildCsvContent(
  records: AccessRecordEntityType[],
  integrity: IntegrityResult,
  chainHeadHash: string,
): Buffer {
  const integrityLine = integrity.ok
    ? `# integrity:OK count=${integrity.total} chainHeadHash=${chainHeadHash}`
    : `# integrity:BROKEN at=${integrity.brokenAt ?? ""} reason=${integrity.reason ?? ""}`;
  return Buffer.from([integrityLine, buildCsv(records)].join("\n"), "utf-8");
}

async function buildRawContent(
  records: AccessRecordEntityType[],
  format: ExportFormat,
  integrity: IntegrityResult,
  chainHeadHash: string,
  manifestBase: Omit<ExportManifest, "contentSha256">,
): Promise<{ rawContent: Buffer; encoding: "utf-8" | "base64" }> {
  if (format === "json") {
    return { rawContent: buildJsonContent(records, integrity, chainHeadHash), encoding: "utf-8" };
  }
  if (format === "csv") {
    return { rawContent: buildCsvContent(records, integrity, chainHeadHash), encoding: "utf-8" };
  }
  return { rawContent: await buildPdf(records, manifestBase), encoding: "base64" };
}

export class ExportService {
  public constructor(private signingKey: string) {}

  public async build(
    records: AccessRecordEntityType[],
    format: ExportFormat,
    generatedBy: string,
    generatedAt: string,
  ): Promise<ExportResult> {
    const integrity = verifyAccessRecordChain(records);
    const chainHeadHash = records.length > 0 ? records[records.length - 1]!.hash : GENESIS_HASH;
    const manifestBase = buildManifestBase(
      integrity,
      chainHeadHash,
      generatedAt,
      generatedBy,
      records.length,
    );

    const { rawContent, encoding } = await buildRawContent(
      records,
      format,
      integrity,
      chainHeadHash,
      manifestBase,
    );
    const contentSha256 = createHash("sha256").update(rawContent).digest("hex");
    const signature = createHmac("sha256", this.signingKey).update(rawContent).digest("hex");

    return {
      format,
      encoding,
      content: encoding === "base64" ? rawContent.toString("base64") : rawContent.toString("utf-8"),
      manifest: { ...manifestBase, contentSha256 },
      signature,
    };
  }
}
