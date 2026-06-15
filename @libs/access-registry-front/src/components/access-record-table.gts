import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { t, type IntlService } from 'ember-intl';

class AccessRecordTable extends Component<object> {
  @service declare router: RouterService;
  @service declare intl: IntlService;

  get tableParams(): TableParams {
    return {
      entity: 'access-records',
      pageSizes: [10, 30, 50, 75],
      defaultSortColumn: 'accessedAt',
      columns: [
        {
          field: 'accessedAt',
          headerName: this.intl.t('access-records.table.headers.accessedAt'),
          sortable: true,
        },
        {
          field: 'dataSubjectRef',
          headerName: this.intl.t(
            'access-records.table.headers.dataSubjectRef'
          ),
          sortable: false,
        },
        {
          field: 'accessType',
          headerName: this.intl.t('access-records.table.headers.accessType'),
          sortable: false,
        },
        {
          field: 'purpose',
          headerName: this.intl.t('access-records.table.headers.purpose'),
          sortable: false,
        },
        {
          field: 'isSpecialCategory',
          headerName: this.intl.t(
            'access-records.table.headers.isSpecialCategory'
          ),
          sortable: false,
        },
      ],
    };
  }

  onAddRecord = () => {
    this.router.transitionTo('dashboard.access-records.create');
  };

  <template>
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-semibold">
        {{t "access-records.pages.list.title"}}
      </h1>
      <TpkButton
        @label={{t "access-records.table.actions.addRecord"}}
        @onClick={{this.onAddRecord}}
      />
    </div>
    <TableGenericPrefab @tableParams={{this.tableParams}} />
  </template>
}

export default AccessRecordTable;
