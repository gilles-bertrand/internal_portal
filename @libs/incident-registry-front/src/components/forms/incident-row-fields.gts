import type { TOC } from '@ember/component/template-only';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
import TpkTextarea from '@triptyk/ember-input/components/tpk-textarea';

// Champs d'une ligne d'éditeur répétable (timeline, blocs de description,
// actions correctives, logs d'accès, listes de chaînes).
//
// RAISON D'ÊTRE : `TpkInput` et `TpkTextarea` sont des composants CONTEXTUELS.
// Leur template entier est `{{yield (hash Input=… Label=…)}}` — invoqués en
// auto-fermant (`<TpkInput @label="" @value=… />`) ils ne rendent QUE le noeud
// commentaire vide du yield : aucun `<input>`, aucun `<textarea>`, aucune
// erreur, aucun avertissement. C'est exactement ainsi que les cinq éditeurs
// répétables du wizard incident ont perdu la totalité de leurs champs, rendant
// l'étape 5 (timeline, `min(1)` obligatoire) infranchissable et le formulaire
// non soumettable.
//
// Ces deux wrappers sont le SEUL endroit du lib qui connaît la forme en bloc :
// un futur éditeur les réutilise et le bug ne peut plus revenir éditeur par
// éditeur. `@changeEvent="input"` est délibéré : la valeur par défaut de
// `BaseUI` est `change`, qui ne déclenche qu'au blur — le brouillon de ligne
// doit être à jour au moment où l'utilisateur clique « Ajouter ».
//
// Les classes reprennent celles des prefabs de `@triptyk/ember-input-validation`
// (`tpk-input-container` / `tpk-label` / `tpk-input-input`) pour hériter des
// règles de `@apps/front/app/styles/incidents.css`.

export const RowInput: TOC<{
  Element: HTMLInputElement;
  Args: {
    label: string;
    value?: string | number;
    placeholder?: string;
    type?: string;
    onChange: (value: string | number | Date | null) => void;
  };
}> = <template>
  <TpkInput
    @label={{@label}}
    @value={{@value}}
    @type={{@type}}
    @placeholder={{@placeholder}}
    @changeEvent="input"
    @onChange={{@onChange}}
    as |I|
  >
    <div class="tpk-input-container">
      <I.Label class="tpk-label" />
      <I.Input class="tpk-input-input" ...attributes />
    </div>
  </TpkInput>
</template>;

export const RowTextarea: TOC<{
  Element: HTMLTextAreaElement;
  Args: {
    label: string;
    value?: string;
    placeholder?: string;
    onChange: (value: string) => void;
  };
}> = <template>
  <TpkTextarea
    @label={{@label}}
    @value={{@value}}
    @placeholder={{@placeholder}}
    @changeEvent="input"
    @onChange={{@onChange}}
    as |T|
  >
    <div class="tpk-textarea-container">
      <T.Label class="tpk-label" />
      <T.Input class="tpk-textarea-input" rows="2" ...attributes />
    </div>
  </TpkTextarea>
</template>;
