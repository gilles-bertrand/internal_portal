import type { TOC } from '@ember/component/template-only';
import type AuditEventsIndexRoute from './index.gts';
import AuditEventTable from '#src/components/audit-event-table.gts';

export default <template><AuditEventTable /></template> as TOC<{
  model: Awaited<ReturnType<AuditEventsIndexRoute['model']>>;
  controller: undefined;
}>
