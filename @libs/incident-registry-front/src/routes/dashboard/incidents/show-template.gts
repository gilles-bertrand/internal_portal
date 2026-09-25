import type { TOC } from '@ember/component/template-only';
import type IncidentsShowRoute from './show.gts';
import IncidentDetail from '#src/components/incident-detail.gts';

export default <template>
  <IncidentDetail @incident={{@model}} />
</template> as TOC<{
  model: Awaited<ReturnType<IncidentsShowRoute['model']>>;
  controller: undefined;
}>
