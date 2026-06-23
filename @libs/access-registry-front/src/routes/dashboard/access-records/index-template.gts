import type { TOC } from '@ember/component/template-only';
import type AccessRecordsIndexRoute from './index.gts';
import AccessRecordTable from '#src/components/access-record-table.gts';

export default <template><AccessRecordTable /></template> as TOC<{
  model: Awaited<ReturnType<AccessRecordsIndexRoute['model']>>;
  controller: undefined;
}>
