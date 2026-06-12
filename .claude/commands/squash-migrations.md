---
model: haiku
---

# Squash Migrations

Supprime toutes les migrations existantes des deux backends et en crée une nouvelle migration initiale. **Réservé au développement.**

## Usage

```
/squash-migrations
```

---

## Prérequis à connaître

Trois contraintes découvertes en pratique :

1. **`find -delete` est bloqué** par le hook `bash-tool-guard`. Utiliser `rm` avec les noms de fichiers explicites.
2. **`schema:drop --run` ne supprime pas `mikro_orm_migrations`** : il ne drope que les tables d'entités. La table de tracking des migrations reste, ce qui bloque `migration:create --initial` avec "Initial migration cannot be created, as some migrations already exist".
3. **`migration:create` sans `--initial` utilise le snapshot comme baseline** : si le snapshot est absent, il répond "No changes required" même si la DB est vide. Il faut impérativement `--initial` pour générer une migration from scratch.

La séquence correcte pour chaque backend est donc :
1. Supprimer les fichiers de migration et le snapshot
2. `schema:drop --run` (vide les tables d'entités)
3. `TRUNCATE mikro_orm_migrations` via `database:import` (vide le tracking)
4. `migration:create --initial` (génère la migration initiale)

---

## Steps

### 1. Avertir et confirmer

Informer l'utilisateur que cette opération va :
- **Supprimer définitivement** tous les fichiers de migration `.ts` et snapshots des deux backends
- **Dropper toutes les tables** des deux bases de données de dev (données perdues)

Backends concernés :
- `packages/front-office/@apps/backend/src/migrations/`
- `packages/back-office/@apps/backend/src/migrations/`

Demander une confirmation explicite avant de continuer. Si l'utilisateur refuse, s'arrêter.

### 2. Front-office backend

**a. Lister les fichiers à supprimer :**
```bash
ls /Users/dramix/project/nox/packages/front-office/@apps/backend/src/migrations/
```

**b. Supprimer les migrations `.ts` et le snapshot avec `rm` explicite** (chemins absolus depuis la racine du projet pour éviter les surprises de CWD) :
```bash
rm packages/front-office/@apps/backend/src/migrations/Migration*.ts
rm packages/front-office/@apps/backend/src/migrations/.snapshot-*.json
```
> Utiliser les noms de fichiers exacts listés à l'étape a. Ne pas utiliser `find -delete` (bloqué par le hook).

**c. Dropper le schéma :**
```bash
cd packages/front-office/@apps/backend && pnpm mikro-orm schema:drop --run
```

**d. Vider la table `mikro_orm_migrations` :**
```bash
echo "TRUNCATE mikro_orm_migrations;" > /tmp/clear_migrations.sql && pnpm mikro-orm database:import /tmp/clear_migrations.sql
```

**e. Créer la migration initiale :**
```bash
pnpm mikro-orm migration:create --initial
```

### 3. Back-office backend

**a. Lister les fichiers à supprimer :**
```bash
ls /Users/dramix/project/nox/packages/back-office/@apps/backend/src/migrations/
```

**b. Supprimer les migrations `.ts` et le snapshot avec `rm` explicite :**
```bash
rm /Users/dramix/project/nox/packages/back-office/@apps/backend/src/migrations/Migration*.ts
rm /Users/dramix/project/nox/packages/back-office/@apps/backend/src/migrations/.snapshot-*.json
```

**c. Dropper le schéma :**
```bash
cd /Users/dramix/project/nox/packages/back-office/@apps/backend && pnpm mikro-orm schema:drop --run
```

**d. Vider la table `mikro_orm_migrations` :**
```bash
echo "TRUNCATE mikro_orm_migrations;" > /tmp/clear_migrations.sql && pnpm mikro-orm database:import /tmp/clear_migrations.sql
```

**e. Créer la migration initiale :**
```bash
pnpm mikro-orm migration:create --initial
```

### 4. Rapport

Lister les nouveaux fichiers de migration créés dans chaque backend et confirmer que le squash est terminé.

Rappeler à l'utilisateur que les bases de données sont vides — il faut relancer `pnpm migration:up` ou `pnpm schema:fresh` dans chaque backend pour remettre le schéma en place.

---

## Failure handling

Si une commande échoue : s'arrêter, rapporter l'erreur verbatim, et attendre les instructions. Ne pas retenter les opérations destructives.

Erreur fréquente — "Initial migration cannot be created, as some migrations already exist" :
- Vérifier que la table `mikro_orm_migrations` est bien vide (étape d oubliée ou échouée silencieusement).
- Vérifier qu'aucun fichier `Migration*.ts` ne reste dans le dossier (vite-node peut les recréer depuis son cache si `migration:fresh` est appelé avant la suppression).
