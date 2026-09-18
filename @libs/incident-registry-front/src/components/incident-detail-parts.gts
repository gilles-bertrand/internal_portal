import type { TOC } from '@ember/component/template-only';
import type { DescriptionSection } from '#src/schemas/incidents.ts';

// Vues aplaties des colonnes JSON de l'incident. Le schéma WarpDrive les expose
// en `unknown` (aucun sous-schéma côté front) : elles sont normalisées par
// `IncidentDetail` — dates formatées incluses — avant d'arriver ici, pour être
// rendues champ par champ plutôt qu'en « [object Object] ».
export interface TimelineRow {
  when: string;
  event: string;
}

export interface ActionRow {
  phase?: string;
  title: string;
  detail: string;
  completedAt: string;
}

export interface AccessLogRow {
  when: string;
  user: string;
  email: string;
  files: string;
  count: number;
}

// Le plan de communication est un tableau d'objets libres côté backend
// (`Record<string, unknown>[]`) : on le normalise en paires libellé/valeur pour
// l'afficher sans connaître sa forme.
export interface PlanRow {
  label: string;
  value: string;
}

// Carte thématique regroupant un sous-ensemble de champs. Le regroupement suit
// les 8 étapes du wizard et les sections du rapport PDF, pas l'ordre des
// colonnes en base — c'est ainsi qu'un DPO relit un incident.
export const DetailSection: TOC<{
  Args: { title: string };
  Blocks: { default: [] };
}> = <template>
  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-4 p-5">
      <h2
        class="text-xs font-semibold uppercase tracking-wider text-base-content/60"
      >
        {{@title}}
      </h2>
      <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {{yield}}
      </dl>
    </div>
  </section>
</template>;

// Paire libellé/valeur. `wide` occupe toute la largeur pour les champs longs
// (description, listes d'actions, empreintes d'intégrité).
export const Field: TOC<{
  Args: { label: string; wide?: boolean };
  Blocks: { default: [] };
}> = <template>
  <div class="{{if @wide 'sm:col-span-2'}} min-w-0">
    <dt
      class="text-xs font-medium uppercase tracking-wide text-base-content/50"
    >
      {{@label}}
    </dt>
    <dd class="mt-1 text-sm font-medium text-base-content">
      {{yield}}
    </dd>
  </div>
</template>;

// Texte long : les sauts de ligne saisis au formulaire sont préservés.
export const LongText: TOC<{ Args: { value: string } }> = <template>
  <span class="block whitespace-pre-line font-normal leading-relaxed">
    {{@value}}
  </span>
</template>;

// Tableau de chaînes rendu en chips : une énumération séparée par des virgules
// devenait illisible dès trois entrées.
export const Chips: TOC<{ Args: { values: string[]; empty: string } }> =
  <template>
    {{#if @values}}
      <span class="flex flex-wrap gap-1.5">
        {{#each @values key="@index" as |value|}}
          <span class="badge badge-outline badge-sm">{{value}}</span>
        {{/each}}
      </span>
    {{else}}
      {{@empty}}
    {{/if}}
  </template>;

export const DescriptionBlocks: TOC<{
  Args: { blocks: DescriptionSection[]; empty: string };
}> = <template>
  {{#if @blocks}}
    <div class="space-y-3">
      {{#each @blocks key="@index" as |block|}}
        <div class="rounded border border-base-300 bg-base-200/40 p-3">
          <p class="font-semibold">{{block.title}}</p>
          {{#if block.body}}
            <p class="mt-1 whitespace-pre-line font-normal leading-relaxed">
              {{block.body}}
            </p>
          {{/if}}
          {{#if block.items}}
            <ul class="mt-2 list-disc space-y-1 pl-5 font-normal">
              {{#each block.items key="@index" as |item|}}
                <li>{{item}}</li>
              {{/each}}
            </ul>
          {{/if}}
        </div>
      {{/each}}
    </div>
  {{else}}
    {{@empty}}
  {{/if}}
</template>;

export const Timeline: TOC<{
  Args: { events: TimelineRow[]; empty: string };
}> = <template>
  {{#if @events}}
    <ol class="space-y-1.5">
      {{#each @events key="@index" as |event|}}
        <li class="flex flex-wrap items-baseline gap-x-2 font-normal">
          <span class="font-mono text-xs text-base-content/60">
            {{event.when}}
          </span>
          <span>{{event.event}}</span>
        </li>
      {{/each}}
    </ol>
  {{else}}
    {{@empty}}
  {{/if}}
</template>;

export const ActionList: TOC<{
  Args: { actions: ActionRow[]; empty: string };
}> = <template>
  {{#if @actions}}
    <ol class="space-y-2">
      {{#each @actions key="@index" as |row|}}
        <li class="rounded border border-base-300 p-3">
          <div class="flex flex-wrap items-center gap-2">
            {{#if row.phase}}
              <span class="badge badge-outline badge-xs">{{row.phase}}</span>
            {{/if}}
            <span class="font-semibold">{{row.title}}</span>
            {{#if row.completedAt}}
              <span class="text-xs font-normal text-base-content/60">
                {{row.completedAt}}
              </span>
            {{/if}}
          </div>
          {{#if row.detail}}
            <p class="mt-1 whitespace-pre-line font-normal leading-relaxed">
              {{row.detail}}
            </p>
          {{/if}}
        </li>
      {{/each}}
    </ol>
  {{else}}
    {{@empty}}
  {{/if}}
</template>;

export const AccessLogList: TOC<{
  Args: { logs: AccessLogRow[]; empty: string };
}> = <template>
  {{#if @logs}}
    <ul class="space-y-1.5">
      {{#each @logs key="@index" as |entry|}}
        <li class="flex flex-wrap items-baseline gap-x-2 font-normal">
          <span
            class="font-mono text-xs text-base-content/60"
          >{{entry.when}}</span>
          <span class="font-medium">{{entry.user}}</span>
          <span class="text-xs text-base-content/60">{{entry.email}}</span>
          <span>{{entry.files}}</span>
          <span
            class="badge badge-ghost badge-xs font-mono"
          >{{entry.count}}</span>
        </li>
      {{/each}}
    </ul>
  {{else}}
    {{@empty}}
  {{/if}}
</template>;

export const PlanList: TOC<{
  Args: { entries: PlanRow[][]; empty: string };
}> = <template>
  {{#if @entries}}
    <div class="space-y-2">
      {{#each @entries key="@index" as |entry|}}
        <dl class="rounded border border-base-300 p-3">
          {{#each entry key="label" as |row|}}
            <div class="flex flex-wrap gap-x-2">
              <dt class="text-xs uppercase tracking-wide text-base-content/50">
                {{row.label}}
              </dt>
              <dd class="font-normal">{{row.value}}</dd>
            </div>
          {{/each}}
        </dl>
      {{/each}}
    </div>
  {{else}}
    {{@empty}}
  {{/if}}
</template>;

// Signataire : nom en valeur principale, rôle/organisation en second plan —
// il n'existe pas de libellé i18n dédié pour `role`/`org`.
export const Signer: TOC<{ Args: { name: string; detail: string } }> =
  <template>
    {{@name}}
    {{#if @detail}}
      <span class="block text-xs font-normal text-base-content/60">
        {{@detail}}
      </span>
    {{/if}}
  </template>;

// Empreinte d'intégrité : `break-all` car un SHA-256 déborde de la carte.
export const Hash: TOC<{ Args: { value: string } }> = <template>
  <code
    class="block break-all rounded bg-base-200 px-2 py-1 text-xs font-normal"
  >{{@value}}</code>
</template>;
