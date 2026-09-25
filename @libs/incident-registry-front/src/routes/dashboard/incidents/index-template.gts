import type { TOC } from '@ember/component/template-only';
import type IncidentsIndexRoute from './index.gts';
import IncidentTable from '#src/components/incident-table.gts';

export default <template><IncidentTable /></template> as TOC<{
  model: Awaited<ReturnType<IncidentsIndexRoute['model']>>;
  controller: undefined;
}>
