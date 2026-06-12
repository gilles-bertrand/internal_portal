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
