# Backend

Documentation des conventions et règles métier backend (Fastify, MikroORM/Postgres, libs `*-backend`).

- [[hash-chain-integrity]] — chaîne d'intégrité cryptographique partagée entre registres, et triggers Postgres append-only
- [[access-registry]] — RBAC, règle art. 9, rétention, export signé et audit du registre d'accès
- [[incident-registry]] — référence/séquence, RBAC, validation métier, export PDF du registre d'incidents
- [[platform]] — contrat de module Fastify, enveloppe JSON:API, audit-log comme noyau sans HTTP
- [[users-auth]] — rôles utilisateur, authentification JWT et refresh tokens
- [[permissions]] — rôles/permissions CASL pilotés en base, module portable, UI d'administration
- [[todos]] — portée strictement privée, pas de règle métier au-delà du CRUD scoped
