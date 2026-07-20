import type { TOC } from '@ember/component/template-only';
import type AccessRecordsShowRoute from './show.gts';
import AccessRecordDetail from '#src/components/access-record-detail.gts';

export default <template>
  <AccessRecordDetail @record={{@model}} />
</template> as TOC<{
  model: Awaited<ReturnType<AccessRecordsShowRoute['model']>>;
  controller: undefined;
}>
