# Wizard incident — étapes, validation et erreurs

Le formulaire incident est un wizard à 8 étapes qui déclare une seule `TpkForm` : chaque étape masque les champs des autres, ce qui change complètement la façon de reporter une erreur.

Composant : `IncidentForm` (`@libs/incident-registry-front/src/components/forms/incident-form.gts`).

Le découpage lui-même vient de `INCIDENT_FORM_STEPS` / `INCIDENT_STEP_FIELDS` ([[@libs/incident-registry-front/src/components/forms/incident-validation.ts#INCIDENT_STEP_FIELDS]]) ; les helpers d'erreur sont isolés dans [[@libs/incident-registry-front/src/components/forms/incident-step-errors.ts#issuesToStepFields]] pour être testables sans rendre le formulaire.

## Un champ appartient à une seule étape

`INCIDENT_STEP_FIELDS` associe chaque champ validé à exactement une étape, et `stepForField` fournit la relation inverse.

Deux invariants en découlent, tous deux couverts par les tests : un champ ne peut pas être réclamé par deux étapes, et `validateIncidentStep` d'une étape ne doit jamais échouer sur un champ appartenant à une autre — sinon l'utilisateur reste bloqué à l'étape 1 par une exigence de l'étape 5, sans aucun champ fautif visible à l'écran.

## Erreurs d'étape par champ

Le bouton « étape suivante » ne se contente plus d'un message global : chaque issue Zod est poussée dans le changeset via `addError`, donc chaque champ affiche son erreur inline, exactement comme au submit.

Avant, l'alerte concaténait les messages bruts de Zod (`Invalid input: expected string, received undefined · …`), en anglais, sans indication du champ concerné : sur une étape à douze champs le message était inexploitable. L'alerte ne liste plus que les **libellés** des champs à compléter (`incidents.form.errors.requiredFields`), et les messages de validation eux-mêmes passent par `intl` — ils étaient auparavant soit les défauts anglais de Zod, soit des chaînes françaises codées en dur affichées telles quelles dans l'UI anglaise.

## Navigation entre étapes

`currentStepIndex` avance uniquement si l'étape courante valide ; `furthestStepIndex` mémorise l'étape la plus avancée atteinte et rend l'indicateur cliquable jusque-là.

L'indicateur n'expose un bouton que pour les étapes déjà validées : revenir en arrière est libre, sauter en avant est impossible, donc aucune étape ne peut être franchie sans sa validation. En mode `edit`, `furthestStepIndex` démarre à la dernière étape — l'incident chargé est déjà complet, imposer un parcours linéaire de 8 étapes pour corriger une coquille n'aurait aucun sens. Chaque changement d'étape ramène le haut du formulaire dans la vue, sinon on atterrit au milieu du panneau suivant.

Côté rendu, chaque `.step` porte un `min-w-28` et le conteneur défile horizontalement : la largeur DaisyUI par défaut (4rem) faisait se chevaucher les libellés longs (« Communication & conclusion (§8–§9) » et « Annexes & signatures (§10) » se superposaient, illisibles). Un compteur « Étape X sur 8 » en `aria-live="polite"` annonce le changement.

## Pré-vol du submit sur toutes les étapes

Au clic sur « enregistrer », `checkStepsBeforeSubmit` valide les étapes dans l'ordre et ramène l'utilisateur à la première invalide avant que `TpkForm` ne traite l'événement `submit`.

C'est indispensable parce que `TpkForm` valide le **schéma entier** puis abandonne le submit en silence quand il échoue : le champ fautif appartenant presque toujours à une étape non rendue, l'utilisateur cliquait « enregistrer » et il ne se passait strictement rien, sans message nulle part. Le message `incidents.form.errors.otherStepInvalid` nomme alors l'étape vers laquelle on l'a ramené, et `TpkForm` renseigne les erreurs inline de cette étape désormais visible.

## Règles inter-champs partagées

`refineArt9Impact` et `refineIncidentDates` sont exportées et utilisées **à la fois** par le schéma complet et par la validation d'étape.

Une règle appliquée par le wizard à l'étape N doit être exactement celle que le submit final applique, sinon une étape « valide » se fait refuser au dernier écran. `refineIncidentDates` couvre désormais aussi `incidentEndAt >= incidentStartAt`, règle que seul le backend contrôlait (400 `INCOHERENT_DATES`) — voir [[incident-registry-contract-gaps#Autres écarts mineurs]].

## Les composants Tpk contextuels doivent être invoqués en bloc

`TpkInput` et `TpkTextarea` de `@triptyk/ember-input` sont des composants **contextuels** : leur template entier est `{{yield (hash Input=… Label=…)}}`. Invoqués en auto-fermant ils ne rendent **rien**.

Aucun champ, aucun `<input>`, aucune erreur, aucun avertissement — juste le nœud commentaire vide du `yield`. Les cinq éditeurs répétables du wizard (blocs de description, chronologie, actions correctives, logs d'accès, listes de chaînes) et les quatre champs de signature de l'étape 8 étaient tous écrits sous cette forme : ils s'affichaient comme des cadres vides surmontés d'un seul bouton « Ajouter » inopérant. L'étape 3 était donc infranchissable pour ajouter un bloc de description, et l'étape 5 — dont `timelineEvents` exige `min(1)` — rendait le formulaire tout simplement non soumettable.

Ni TypeScript, ni eslint, ni `ember-template-lint`, ni les 45 tests d'alors ne voyaient le problème : un composant qui ne rend rien est syntaxiquement valide.

La forme correcte vit désormais dans un seul endroit, `@libs/incident-registry-front/src/components/forms/incident-row-fields.gts` (`RowInput` et `RowTextarea`), réutilisé par les cinq éditeurs et par les signatures — le bug ne peut plus revenir éditeur par éditeur. `@changeEvent="input"` y est délibéré : le défaut de `BaseUI` est `change`, qui ne déclenche qu'au blur, alors que le brouillon de ligne doit être à jour au moment du clic sur « Ajouter ».

Un test d'intégration assert désormais la **présence des champs** étape par étape, invariant qu'aucun test ne couvrait.

### Une ligne incomplète doit le dire

Les boutons « Ajouter » sortaient en silence quand la ligne était incomplète : le seul retour visible était que rien ne se passait.

Chaque éditeur affiche maintenant `incidents.form.errors.incompleteRow` au lieu d'ignorer le clic. Même principe que le gate d'étape : un refus sans message est indistinguable d'un bug pour l'utilisateur.

### Les dates de ligne se normalisent en `yyyy-MM-dd`

Un `<input type="date">` remonte `input.valueAsDate`, donc un objet `Date` — pas la chaîne saisie.

Sans normalisation, le brouillon stockait « Thu Aug 20 2026 00:00:00 GMT… », que le backend et le PDF réafficheraient tel quel. Les trois éditeurs concernés (chronologie, actions correctives, logs d'accès) reprojettent en `yyyy-MM-dd`. `correctiveActions.completedAt` est en outre re-projeté en datetime ISO au submit — voir [[incident-registry-contract-gaps#Autres écarts mineurs#completedAt : date saisie, datetime attendu]].

## Le payload soumis n'est PAS la sortie du schéma Zod

`TpkForm.validateAndSubmit` appelle `onSubmit(this.args.changeset.data, …)` : la donnée **brute** du changeset, après l'avoir seulement *validée* contre le schéma.

Les `z.coerce`, `z.preprocess` et `.transform()` du schéma n'atteignent donc jamais le corps envoyé à l'API — la signature `onSubmit(data: ValidatedIncident)` est un mensonge au runtime. Un `<input>` texte remonte toujours une chaîne : `resolutionDurationMinutes` partait en `"240"` et le backend répondait 400 « expected number, received string » sur un champ de l'étape 2, invisible depuis l'étape 8. Idem pour les cinq dates, stockées en `Date` par `setDateField`.

Toutes les coercitions vivent donc dans `incident-form.gts` (`IncidentForm#normalizePayload`), et toute nouvelle coercition ajoutée au schéma doit y être répliquée.

Corollaire RGPD : un compteur laissé vide reste `null`, jamais `0`. `z.coerce.number()` accepte `null` et le coerce en `0` (`Number(null) === 0`) — avec le membre coercitif en tête de l'union, un compteur vide était persisté comme « 0 personne concernée », une affirmation factuelle fausse là où la CNIL demande un nombre *approximatif* et où « non déterminé » est une réponse valide.

## Filet de sécurité sur les refus du serveur

Après `handleSave`, `incident-form.gts` (`IncidentForm#revealServerFieldErrors`) ramène l'utilisateur sur la première étape portant une erreur de champ renvoyée par le serveur.

`HandleSaveService` classe toute erreur JSON:API avec un pointer `/data/attributes/...` en erreur de **champ** : elle est poussée dans le changeset et, volontairement, ne produit **aucun flash**. Sur un wizard le champ visé appartient presque toujours à une étape non rendue — un 400 `MISSING_IMPACT_FIELDS` pointe `severityOverall` (étape 4) alors qu'on soumet depuis l'étape 8. L'erreur existait donc sans être affichable nulle part : « enregistrer » ne faisait visiblement rien et l'incident n'était pas créé.

Aligner la validation front sur les règles métier du backend reste la vraie défense ([[incident-registry-contract-gaps#Validation art. 9 alignée sur le backend]]) ; ce filet couvre toute règle serveur que le front ne reproduit pas encore.
