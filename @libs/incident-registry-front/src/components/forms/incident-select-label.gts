import Component from '@glimmer/component';
import type { ComponentLike } from '@glint/template';
import type { LabelledOption } from '#src/utils/incident-options.ts';

// Same plumbing as access-record-form.gts's `selectedOptionComponent`, reused
// for the incident wizard's enum selects.
//
// TpkValidationSelect binds `@selected` to the CHANGESET value, i.e. the stored
// code, and power-select renders it with `String(...)`. Without a
// `@selectedItemComponent` the trigger therefore shows `in_progress` /
// `CONFIDENTIEL` even when the dropdown lists translated labels.

// power-select hands back `unknown`: either the stored code string, or (before
// our onChange normalises it) the option object itself.
export function codeOf(selected: unknown): string {
  if (typeof selected === 'string') {
    return selected;
  }
  if (selected && typeof selected === 'object' && 'value' in selected) {
    return String((selected as LabelledOption).value);
  }
  return '';
}

// EXPORTÉE, et ce n'est pas cosmétique : `incident-form.gts` expose quatre
// propriétés publiques typées `ComponentLike<SelectedItemSignature>`. Non
// exportée, ember-tsc ne peut pas la nommer dans les déclarations et le build
// échoue en TS4029 — invisible pour `lint:types` (--noEmit) comme pour les
// tests, seul `pnpm build` / `pnpm dev` le voit.
export interface SelectedItemSignature {
  Args: {
    selected: unknown;
    extra?: unknown;
  };
  Blocks: { default: [] };
  Element: HTMLElement;
}

// The options list is passed BY REFERENCE (a thunk) so the trigger always
// resolves against the current list rather than a snapshot.
//
// The explicit `ComponentLike<…>` return type is required: ember-tsc's
// declaration build cannot name the anonymous class type inferred from a bare
// class expression here (TS2883/TS4041). `lint:types` (--noEmit) does not catch
// it — only `pnpm build` / `pnpm dev` does. Same note as in access-record-form.
export function selectedOptionComponent(
  getOptions: () => LabelledOption[]
): ComponentLike<SelectedItemSignature> {
  return class extends Component<SelectedItemSignature> {
    get label(): string {
      const code = codeOf(this.args.selected);
      if (!code) {
        return '';
      }
      // Fall back to the code itself: a historical value outside the enum must
      // stay readable instead of rendering as an empty trigger.
      return getOptions().find((o) => o.value === code)?.label ?? code;
    }

    <template>
      <span ...attributes>{{this.label}}{{yield}}</span>
    </template>
  };
}
