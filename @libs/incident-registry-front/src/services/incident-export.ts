import Service, { service } from '@ember/service';
import type SessionService from 'ember-simple-auth/services/session';

export type ExportFormat = 'json' | 'csv' | 'pdf';

interface ExportResultData {
  format: ExportFormat;
  encoding: 'utf-8' | 'base64';
  content: string;
  manifest: { generatedAt: string; generatedBy: string; count: number };
  signature: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
};

export default class IncidentExportService extends Service {
  @service declare session: SessionService;

  public async downloadRegistryPdf(): Promise<void> {
    await this.download(
      '/api/v1/incidents/export',
      { format: 'pdf' },
      'registre-incidents'
    );
  }

  public async downloadIncidentPdf(incidentId: string): Promise<void> {
    await this.download(
      `/api/v1/incidents/${incidentId}/export`,
      {},
      `rapport-incident-${incidentId}`
    );
  }

  private async download(
    endpoint: string,
    body: Record<string, unknown>,
    namePrefix: string
  ): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authorizationHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`);
    }

    const payload = (await response.json()) as { data: ExportResultData };
    const { content, encoding, manifest, format } = payload.data;
    const blob =
      encoding === 'base64'
        ? new Blob([base64ToBytes(content)], { type: MIME_TYPES[format] })
        : new Blob([content], { type: MIME_TYPES[format] });

    triggerBrowserDownload(
      blob,
      `${namePrefix}-${manifest.generatedAt.replace(/[:.]/g, '-')}.${format}`
    );
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
