# Plan — Script de bootstrap automatique au `pnpm dev`

## Contexte du dépôt

> ⚠️ Le worktree courant (`task-20260612-161821`) ne contient que `.claude/`.
> Le code réel à modifier est dans le dépôt principal : **`/Users/gilles/www/internal_portal`**.
> Toutes les modifications de ce plan visent ce répertoire.

État actuel des scripts pertinents :

- **`package.json` (racine)**
  ```json
  "dev:front": "pnpm --filter run --filter=@apps/front start:with-back",
  "dev:back": "pnpm --filter run --filter=@apps/backend dev",
  "dev": "concurrently \"pnpm:dev:*\" --names \"dev:\" --prefixColors auto",
  ```
- **`docker-compose.yaml`** : service `database` (`postgres:18`, port `5432`, db `database_dev`, user/pass `backend_user`). **Pas de `healthcheck`.**
- **`@apps/backend/package.json`** : `"schema:fresh": "vite-node src/cli/schema-fresh.ts"` — **opération destructive** (drop schema + recreate + seed).
- Outil de parallélisme déjà présent dans le catalog : `concurrently`.

## Problème & objectif

Quand on lance `pnpm dev` à la racine, on veut pouvoir exécuter automatiquement la séquence de préparation de l'environnement :

1. `pnpm i` — installer/synchroniser les dépendances
2. `docker compose up -d` — démarrer PostgreSQL
3. `pnpm schema:fresh` — (re)créer le schéma et seeder la base

**Contrainte forte (« quand nous en avons besoin »)** : `schema:fresh` est destructif. Il ne doit **pas** s'exécuter aveuglément à chaque `pnpm dev`, sinon la base de dev est réinitialisée à chaque démarrage. Le bootstrap doit donc être **idempotent** :

- `pnpm i` et `docker compose up -d` sont sûrs à relancer (idempotents par nature) → on peut les jouer à chaque fois.
- `schema:fresh` ne doit tourner **qu'au premier démarrage** (base non initialisée) **ou** sur demande explicite (flag).

## Approche technique

Créer un script Node unique **`scripts/dev-setup.mjs`** (sans dépendance externe, ESM, cohérent avec `scripts/pack-tuto.mjs` déjà présent) qui orchestre les 3 étapes avec garde-fou, puis le brancher sur le **cycle de vie `predev`** de pnpm (exécuté automatiquement avant `dev`).

### Garde-fou d'idempotence pour `schema:fresh`

Sentinelle sur le système de fichiers : `node_modules/.cache/.dev-setup-initialized`.
- Absente → premier run → on joue `schema:fresh` puis on crée la sentinelle.
- Présente → on saute `schema:fresh`.
- `node_modules/.cache/` est régénérable et hors-git → la sentinelle disparaît naturellement à un `node_modules` neuf (donc nouveau clone = nouveau seed). Bon comportement.

Forçage explicite via variable d'env `FRESH=1` (ou script dédié `dev:fresh`).

### Attente de disponibilité de PostgreSQL

`docker compose up -d` rend la main avant que Postgres accepte les connexions. `schema:fresh` échouerait sur un démarrage à froid. Deux mesures complémentaires :

1. Ajouter un `healthcheck` au service `database` dans `docker-compose.yaml`.
2. Dans le script, boucle d'attente via `docker compose exec -T database pg_isready -U backend_user -d database_dev` (timeout ~30 s) avant `schema:fresh`.

### Pourquoi `predev` plutôt que d'enchaîner dans `dev`

- `predev` est joué automatiquement par pnpm **avant** `dev`, sans modifier la commande `concurrently` existante.
- Le setup se termine (et bloque sur erreur) **avant** que back+front démarrent → pas de course avec une base absente.

## Étapes d'implémentation

### Phase 1 — Script d'orchestration `scripts/dev-setup.mjs`

```js
#!/usr/bin/env node
// scripts/dev-setup.mjs
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SENTINEL = 'node_modules/.cache/.dev-setup-initialized';
const FORCE_FRESH = process.env.FRESH === '1';

const run = (cmd) => {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

// 1. Dépendances (idempotent)
run('pnpm i');

// 2. Base de données (idempotent)
run('docker compose up -d');

// 3. Attendre que Postgres accepte les connexions
const waitForDb = () => {
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        'docker compose exec -T database pg_isready -U backend_user -d database_dev',
        { stdio: 'ignore' },
      );
      return true;
    } catch {
      execSync('node -e "setTimeout(()=>{},1000)"'); // pause ~1s, sans dépendance
    }
  }
  return false;
};
if (!waitForDb()) {
  console.error('✗ PostgreSQL not ready after 30s');
  process.exit(1);
}

// 4. schema:fresh — uniquement au premier run ou si FRESH=1 (opération destructive)
if (FORCE_FRESH || !existsSync(SENTINEL)) {
  run('pnpm --filter @apps/backend schema:fresh');
  mkdirSync(dirname(SENTINEL), { recursive: true });
  writeFileSync(SENTINEL, new Date().toISOString());
  console.log('✓ schema:fresh done, sentinel written');
} else {
  console.log('✓ schema already initialized — skipping schema:fresh (use FRESH=1 to force)');
}
```

> Note : remplacer la pause `node -e setTimeout` par une approche plus propre si une dépendance d'attente (`wait-on`, `delay`) est ajoutée au catalog. Garder zéro-dépendance par défaut.

### Phase 2 — Scripts `package.json` (racine)

```json
"scripts": {
  "predev": "node scripts/dev-setup.mjs",
  "dev": "concurrently \"pnpm:dev:*\" --names \"dev:\" --prefixColors auto",
  "dev:fresh": "FRESH=1 node scripts/dev-setup.mjs && pnpm dev",
  "setup": "node scripts/dev-setup.mjs"
}
```

- `predev` : joué automatiquement avant `dev`.
- `dev:fresh` : force la réinitialisation du schéma (quand on en a besoin).
- `setup` : permet de jouer le bootstrap seul.
- ⚠️ Ne pas créer de nouveaux scripts `dev:*` susceptibles d'être capturés par le glob `pnpm:dev:*` de `concurrently` — `dev:fresh` ne doit donc PAS matcher au point d'être lancé par `concurrently`. Vérifier : `concurrently "pnpm:dev:*"` matche `dev:back`, `dev:front` **et** `dev:fresh`. → Renommer en **`fresh`** (sans préfixe `dev:`) pour éviter la capture :
  ```json
  "fresh": "FRESH=1 node scripts/dev-setup.mjs && pnpm dev"
  ```

### Phase 3 — Healthcheck PostgreSQL dans `docker-compose.yaml`

```yaml
services:
  database:
    image: postgres:18
    environment:
      POSTGRES_USER: backend_user
      POSTGRES_PASSWORD: backend_user
      POSTGRES_DB: database_dev
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U backend_user -d database_dev"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - internal-portal-network
```

## Cas limites & gestion d'erreurs

- **Docker non démarré** : `docker compose up -d` échoue → `execSync` lève → `predev` s'arrête (code ≠ 0), `dev` ne démarre pas. Message clair attendu.
- **Postgres lent à démarrer** : géré par la boucle `pg_isready` (timeout 30 s) + healthcheck compose.
- **`schema:fresh` rejoué par erreur** : impossible hors premier run / `FRESH=1` grâce à la sentinelle.
- **`node_modules` reconstruit** : sentinelle perdue → re-seed automatique au prochain `dev` (comportement voulu pour un clone neuf).
- **CI / e2e** : ne pas réutiliser ce flux — l'e2e a déjà `@apps/backend e2e:setup`. Le bootstrap cible le dev local uniquement.
- **`pnpm i` pendant `predev`** : pnpm autorise un install imbriqué ; vérifier l'absence de boucle/verrou de lockfile lors du test.

## Stratégie de test

Tests manuels (pas de tests d'intégration automatisés requis pour ce plan d'outillage) :

1. Depuis `/Users/gilles/www/internal_portal`, supprimer la sentinelle + `docker compose down -v`, puis `pnpm dev` → vérifier l'enchaînement `pnpm i` → `docker up` → attente → `schema:fresh` → démarrage back+front.
2. Relancer `pnpm dev` → vérifier que `schema:fresh` est **sauté** (message « skipping ») et que la base n'est pas réinitialisée.
3. `pnpm fresh` → vérifier que `schema:fresh` est **rejoué** (réinitialisation).
4. Arrêter Docker → `pnpm dev` → vérifier l'échec propre avant démarrage des apps.

## Critères de succès (vérifiables)

1. `scripts/dev-setup.mjs` existe et est exécutable en ESM sans dépendance externe.
2. `pnpm dev` déclenche automatiquement le bootstrap via `predev`.
3. `pnpm i` et `docker compose up -d` sont joués à chaque `pnpm dev` (idempotents).
4. `schema:fresh` n'est joué qu'au **premier** `pnpm dev` (sentinelle absente) — confirmé par le test n°2 (pas de re-seed au 2ᵉ lancement).
5. `pnpm fresh` (ou `FRESH=1`) force la réexécution de `schema:fresh` — confirmé par le test n°3.
6. Le script attend la disponibilité de Postgres (`pg_isready`) avant `schema:fresh` ; `docker-compose.yaml` a un `healthcheck`.
7. Aucun nouveau script ne perturbe le glob `concurrently "pnpm:dev:*"` (back+front uniquement démarrés).
8. Échec propre (code ≠ 0, sans démarrer les apps) si Docker est indisponible.

---

**Next :** `pnpm install` non requis ici. Lancer `/TPK-build specs/todo/dev-setup-bootstrap-script.md` pour implémenter (cible : `/Users/gilles/www/internal_portal`).
