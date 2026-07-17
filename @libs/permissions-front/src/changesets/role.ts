import ImmerChangeset from 'ember-immer-changeset';

/**
 * Les règles de permission ne passent pas par ce changeset : elles sont
 * gérées séparément par RolePermissionMatrix (état local + appel API direct),
 * pas par TpkForm — cf. la note "scope UI v1" du plan.
 */
export interface DraftRole {
  id?: string | null;
  name?: string;
  description?: string | null;
}

export class RoleChangeset extends ImmerChangeset<DraftRole> {}
