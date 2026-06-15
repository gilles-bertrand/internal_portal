#!/usr/bin/env node
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

// Déchiffrement SOPS sûr : on écrit dans un fichier temporaire et on ne
// remplace la cible qu'en cas de succès. Évite de vider un .env existant si
// le déchiffrement échoue (la redirection `>` tronque sinon avant l'erreur).
const decryptEnv = (enc, dest, { fatal }) => {
  if (!existsSync(enc)) {
    console.log(`\n⚠ ${enc} introuvable — déchiffrement SOPS ignoré.`);
    return;
  }
  const tmp = `${dest}.sops-tmp`;
  try {
    run(`sops decrypt --input-type dotenv --output-type dotenv ${enc} > ${tmp} && mv ${tmp} ${dest}`);
  } catch {
    run(`rm -f ${tmp}`);
    const msg =
      `Échec du déchiffrement SOPS de ${enc}. Vérifie que \`sops\` est installé` +
      ' et que ta clé age est accessible. Voir tuto/2_sops.md.';
    if (fatal) {
      console.error(`\n✗ ${msg}`);
      process.exit(1);
    }
    console.warn(`\n⚠ ${msg} (les tests e2e échoueront)`);
  }
};

// 1.5 Secrets backend dev (source de vérité = .env.enc chiffré, versionné).
decryptEnv('@apps/backend/.env.enc', '@apps/backend/.env', { fatal: true });

// 1.6 Secrets e2e — best-effort : `pnpm dev` n'en a pas besoin.
decryptEnv('@apps/backend/.env.e2e.enc', '@apps/backend/.env.e2e', { fatal: false });

// 2. Base de données (idempotent)
run('docker compose up -d');

// 3. Attendre que Postgres accepte les connexions (timeout 30s)
const waitForDb = () => {
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        'docker compose exec -T database pg_isready -U backend_user -d database_dev',
        { stdio: 'ignore' },
      );
      return true;
    } catch {
      execSync('node --input-type=module --eval "await new Promise(r=>setTimeout(r,1000))"', {
        stdio: 'ignore',
      });
    }
  }
  return false;
};

if (!waitForDb()) {
  console.error('\n✗ PostgreSQL not ready after 30s — aborting');
  process.exit(1);
}

// 4. schema:fresh — destructif, uniquement au premier run ou si FRESH=1
if (FORCE_FRESH || !existsSync(SENTINEL)) {
  run('pnpm --filter @apps/backend schema:fresh');
  mkdirSync(dirname(SENTINEL), { recursive: true });
  writeFileSync(SENTINEL, new Date().toISOString());
  console.log('\n✓ schema:fresh done, sentinel written');
} else {
  console.log('\n✓ schema already initialized — skipping schema:fresh (use FRESH=1 to force)');
}
