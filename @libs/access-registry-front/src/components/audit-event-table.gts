import { service } from '@ember/service';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import { hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { t, type IntlService } from 'ember-intl';
import type { AuditEvent } from '#src/schemas/audit-events.ts';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';

// Cellule date : UTC stocké, affiché en local selon la locale active.
class OccurredAtCell extends Component<{ Args: { row: AuditEvent } }> {
  @service declare intl: IntlService;

  get formatted(): string {
    const raw = this.args.row.occurredAt;
    if (!raw) {
      return '';
    }
    return new Date(raw).toLocaleString(this.intl.primaryLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  <template>{{this.formatted}}</template>
}

class AuditEventTable extends Component<object> {
  @service declare intl: IntlService;

  get tableParams(): TableParams {
    return {
      entity: 'audit-events',
      pageSizes: [10, 30, 50, 75],
      defaultSortColumn: 'occurredAt',
      columns: [
        {
          field: 'occurredAt',
          headerName: this.intl.t('audit-events.table.headers.occurredAt'),
          sortable: true,
          component: 'occurredAt',
        },
        {
          field: 'action',
          headerName: this.intl.t('audit-events.table.headers.action'),
          sortable: false,
        },
        {
          field: 'targetType',
          headerName: this.intl.t('audit-events.table.headers.targetType'),
          sortable: false,
        },
        {
          field: 'actorName',
          headerName: this.intl.t('audit-events.table.headers.actor'),
          sortable: false,
        },
        {
          field: 'outcome',
          headerName: this.intl.t('audit-events.table.headers.outcome'),
          sortable: false,
        },
      ],
    };
  }

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    {{! Wrapper catches bubbled clicks from the pager buttons to scroll back to top }}
    <div {{on "click" scrollToListTopOnPager}}>
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold">
          {{t "audit-events.pages.list.title"}}
        </h1>
      </div>
      <TableGenericPrefab
        @tableParams={{this.tableParams}}
        @columnsComponent={{hash occurredAt=(component OccurredAtCell)}}
      />
    </div>
  </template>
}

export default AuditEventTable;
