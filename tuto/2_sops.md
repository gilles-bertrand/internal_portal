# Chiffrer les secrets backend avec SOPS + age

Ce tutoriel met en place [SOPS](https://getsops.io/docs/) avec le backend de
chiffrement [age](https://github.com/FiloSottile/age) pour versionner les
secrets du backend de façon chiffrée dans git.

## Concept

Aujourd'hui `@apps/backend/.env` est gitignoré : les secrets ne sont pas
versionnés, chaque dev recopie `.env.example` à la main. Avec SOPS on commite
une version **chiffrée** (`@apps/backend/.env.enc`) que seuls les détenteurs
d'une clé age peuvent déchiffrer. Les **clés** restent lisibles dans git (bons
diffs), seules les **valeurs** sont chiffrées.

```
.env.enc   (chiffré, COMMITÉ)  ──sops decrypt──▶   .env   (clair, GITIGNORÉ, lu par l'app)
```

## Prérequis

`sops` et `age` sont déjà installés (vérifié : `sops 3.13.1`, `age` via Homebrew).
Sinon : `brew install sops age`.

## Étape 1 — Générer ta clé age

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

La sortie affiche ta **clé publique** (`age1xxxx…`). Note-la. Le fichier
`keys.txt` contient ta clé **privée** — ne la commite jamais, ne la partage
jamais.

Exporte le chemin de la clé (à ajouter à ton `~/.zshrc`) pour que SOPS la trouve
automatiquement :

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
```

## Étape 2 — Créer `.sops.yaml` à la racine

Fichier `/.sops.yaml`. Remplace la clé publique par la tienne (ajoute celles de
tes collègues séparées par des virgules) :

```yaml
creation_rules:
  - path_regex: \.env\.enc$
    input_type: dotenv
    output_type: dotenv
    age: >-
      age1TA_CLE_PUBLIQUE_ICI
```

Le `path_regex` ne matche que les fichiers `*.env.enc` ;
`input/output_type: dotenv` garde le format clé=valeur.

## Étape 3 — Chiffrer le `.env` backend existant

> ⚠️ `sops encrypt` choisit la règle de chiffrement d'après le **nom du fichier
> d'entrée**. Comme l'entrée est `.env` (qui ne matche pas `\.env\.enc$`), il
> faut `--filename-override .env.enc`, sinon SOPS échoue avec
> `error loading config: no matching creation rules found`.

```bash
cd @apps/backend
sops encrypt --input-type dotenv --output-type dotenv --filename-override .env.enc .env > .env.enc
```

Vérifie que `.env.enc` contient bien `SESSION_KEY=ENC[AES256_GCM,data:...]`
(clés lisibles, valeurs chiffrées).

> ⚠️ **Même quirk en lecture.** SOPS détecte le format via l'extension : `.env`
> → dotenv, mais `.enc` n'est pas reconnu → il tombe sur le store « binary » qui
> attend du JSON et échoue avec `Could not unmarshal input data: invalid
> character 'S'`. Il faut donc passer `--input-type dotenv --output-type dotenv`
> à **chaque** commande de lecture (`edit`, `decrypt`). Pour éditer ensuite :

```bash
sops edit --input-type dotenv --output-type dotenv .env.enc   # rechiffre à la sauvegarde
```

> 💡 **Alternative sans flags répétés** : nomme le fichier chiffré avec une
> extension `.env` reconnue (ex. `secrets.env` au lieu de `.env.enc`) et adapte
> le `path_regex` en `secrets\.env$`. SOPS détecte alors le format dotenv
> automatiquement et tu n'as plus jamais besoin de `--input-type`. `gitignore`
> n'ignore que `.env` exact, donc `secrets.env` reste versionné.

## Étape 4 — Vérifier `.gitignore`

`.gitignore` ignore `.env` (correspondance exacte) — `.env.enc` n'est donc pas
concerné et sera bien versionné. Vérifie :

```bash
git add @apps/backend/.env.enc
git check-ignore @apps/backend/.env.enc   # ne doit RIEN afficher
```

Pour être explicite, tu peux ajouter dans `.gitignore` :

```
# secrets déchiffrés (jamais commités)
@apps/backend/.env
# la version chiffrée EST versionnée
!@apps/backend/.env.enc
```

## Étape 5 — Déchiffrer au setup (approche recommandée)

`scripts/dev-setup.mjs` tourne déjà sur `predev`/`setup`. Ajoute une étape de
déchiffrement après `pnpm i`, avant le bloc base de données :

```js
// 1.5 Déchiffrement des secrets backend (SOPS)
run('sops decrypt --input-type dotenv --output-type dotenv @apps/backend/.env.enc > @apps/backend/.env');
```

`run()` existe déjà. À chaque `pnpm dev` / `pnpm setup`, le `.env` en clair est
régénéré depuis la source chiffrée. L'app lit `process.env` comme avant —
**aucun changement de code**.

### Alternative — `sops exec-env` (zéro secret sur disque)

Si tu préfères qu'aucun `.env` clair n'existe, enveloppe le lancement. Dans
`@apps/backend/package.json` :

```jsonc
"start": "pnpm build:deps && sops exec-env @apps/backend/.env.enc 'vite-node src/app.bootstrap.ts'"
```

Plus sûr, mais il faut adapter chaque script (`dev`, `start`, `start:e2e`).
L'approche setup reste la plus simple pour démarrer.

## Étape 6 — CI (GitHub Actions)

La CI e2e tourne en `--mode=e2e` : vite-node charge `.env` **et** `.env.e2e`
dans `process.env`. C'est donc `.env.e2e` qu'il faut déchiffrer en CI (voir
l'étape 7 pour le chiffrer). Génère une clé age dédiée à la CI, mets sa **clé
privée** dans le secret GitHub `SOPS_AGE_KEY`, ajoute sa **clé publique** dans
`.sops.yaml`, puis `sops updatekeys --input-type dotenv` sur les fichiers `.enc`.

Le workflow `.github/workflows/playwright.yml` expose le secret au niveau du job
et déchiffre avant le build :

```yaml
jobs:
  test:
    env:
      SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: wyvox/action-setup-pnpm@v3
      - name: Decrypt e2e secrets (SOPS)
        run: |
          SOPS_VERSION=v3.13.1
          curl -fsSL "https://github.com/getsops/sops/releases/download/${SOPS_VERSION}/sops-${SOPS_VERSION}.linux.amd64" -o /usr/local/bin/sops
          chmod +x /usr/local/bin/sops
          sops decrypt --input-type dotenv --output-type dotenv @apps/backend/.env.e2e.enc > @apps/backend/.env.e2e
      - name: Build
        run: pnpm turbo build
      # … setup db, playwright, tests
```

> ⚠️ Cette étape n'est **pas** gardée : une fois `.env.e2e` en clair retiré de
> git, le secret `SOPS_AGE_KEY` devient **obligatoire**, sinon la CI échoue.
> Configure le secret + `updatekeys` **avant** de pousser (voir étape 7).

## Étape 7 — Chiffrer aussi les secrets e2e

`@apps/backend/.env.e2e` est versionné en clair par défaut. Pour le protéger :

**1. Élargir le regex** dans `.sops.yaml` pour couvrir les deux fichiers :

```yaml
creation_rules:
  - path_regex: \.env(\.\w+)?\.enc$
    input_type: dotenv
    output_type: dotenv
    age: age1TA_CLE,age1CLE_CI
```

**2. Chiffrer** (`--filename-override` pour que le regex matche le nom voulu) :

```bash
cd @apps/backend
sops encrypt --input-type dotenv --output-type dotenv \
  --filename-override .env.e2e.enc .env.e2e > .env.e2e.enc
```

**3. `.gitignore`** — ignorer le clair, versionner le `.enc` :

```
@apps/backend/.env.e2e
!@apps/backend/.env.e2e.enc
```

**4. Retirer le clair du suivi** : `git rm --cached @apps/backend/.env.e2e`

**5. Déchiffrement local** : `scripts/dev-setup.mjs` déchiffre aussi
`.env.e2e.enc → .env.e2e` (best-effort, ne bloque pas `pnpm dev`).

> ⚠️ **Ordre impératif avant le push** : (a) chiffrer, (b) créer le secret
> `SOPS_AGE_KEY` + clé publique CI dans `.sops.yaml` + `updatekeys`, (c)
> `git rm --cached`, (d) push. Si tu pousses avant (b), la CI n'a plus de
> `.env.e2e` et ne peut pas le déchiffrer → échec.
>
> L'historique git garde les anciennes valeurs en clair → fais une **rotation**
> des secrets e2e s'ils avaient de la valeur.

## Workflow quotidien

| Action | Commande |
|---|---|
| Éditer un secret | `sops edit --input-type dotenv --output-type dotenv @apps/backend/.env.enc` |
| Ajouter un collègue | clé publique dans `.sops.yaml` puis `sops updatekeys --input-type dotenv @apps/backend/.env.enc` |
| Retirer un accès | retirer la clé de `.sops.yaml`, `sops updatekeys --input-type dotenv …` **et** `sops rotate -i --input-type dotenv --output-type dotenv @apps/backend/.env.enc` |
| Voir un secret | `sops decrypt --input-type dotenv --output-type dotenv @apps/backend/.env.enc` |

> ⚠️ **Le `--input-type dotenv` est requis sur TOUTES les sous-commandes** qui
> relisent un `.env.enc` (`edit`, `decrypt`, `updatekeys`, `rotate`), à cause de
> l'extension `.enc` non reconnue (cf. encadré à l'étape 3). `updatekeys` n'a pas
> de `--output-type` ; `rotate` prend les deux. Sans ça :
> `Could not unmarshal input data: invalid character 'S'`.

## Pièges spécifiques au projet

- **Secrets e2e** : voir l'étape 7 (chiffrement de `.env.e2e`).
- **`.env.enc` doit contenir TOUTES les clés** du schéma zod
  (`@apps/backend/src/configuration.ts` : `PORT`, `SERVER_URL`, `DATABASE_URI`,
  `SESSION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_*`…) sinon
  `loadConfiguration()` plante au démarrage.
- **`SOPS_AGE_KEY_FILE`** doit être exporté dans ton shell *et* dans le
  devcontainer si tu l'utilises (monte `~/.config/sops` comme le `.devcontainer`
  monte déjà `~/.claude`).
