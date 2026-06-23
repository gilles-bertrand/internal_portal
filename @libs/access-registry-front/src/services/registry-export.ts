import Service, { service } from '@ember/service';
import type SessionService from 'ember-simple-auth/services/session';

export type ExportFormat = 'json' | 'csv' | 'pdf';

interface ExportResultData {
  format: ExportFormat;
  encoding: 'utf-8' | 'base64';
  content: string;
  manifest: {
    generatedAt: string;
    generatedBy: string;
    count: number;
    chainHeadHash: string;
    contentSha256: string;
  };
  signature: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
};

const EXPORT_ENDPOINT = '/api/v1/access-records/export';

// Génère le rapport du registre côté backend (réservé au DPO) puis déclenche
// le téléchargement du fichier signé dans le navigateur.
export default class RegistryExportService extends Service {
  @service declare session: SessionService;

  public async downloadReport(format: ExportFormat = 'pdf'): Promise<void> {
    const response = await fetch(EXPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authorizationHeader(),
      },
      body: JSON.stringify({ format }),
    });

    if (!response.ok) {
      throw new Error(`Export request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { data: ExportResultData };
    const { content, encoding, manifest } = payload.data;

    const blob =
      encoding === 'base64'
        ? new Blob([base64ToBytes(content)], { type: MIME_TYPES[format] })
        : new Blob([content], { type: MIME_TYPES[format] });

    triggerBrowserDownload(blob, buildFileName(format, manifest.generatedAt));
  }

  private authorizationHeader(): string {
    const authData = this.session.data.authenticated as Record<string, unknown>;
    const accessToken = (
      authData?.['data'] as Record<string, unknown> | undefined
    )?.['accessToken'] as string | undefined;
    return accessToken ? `Bearer ${accessToken}` : '';
  }
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildFileName(format: ExportFormat, generatedAt: string): string {
  const stamp = generatedAt.replace(/[:.]/g, '-');
  return `registre-acces-${stamp}.${format}`;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
