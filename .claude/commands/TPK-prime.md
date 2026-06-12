---
description: Gain a general understanding of the codebase
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

> **Démarrage** : affiche immédiatement `[TPK-prime] 🤖 Modèle : sonnet` comme première ligne de sortie.

# Prime

## Purpose

Quickly understand any codebase by reading key files and summarizing the project structure. Run this when starting work on a new or unfamiliar project.

## Workflow

1. Run `git ls-files` to list all tracked files in the repository
2. Read `README.md` for project overview (if it exists)
3. Identify the main technology stack from package.json, requirements.txt, or similar
4. Note the folder structure and key directories
5. Identify entry points (main.py, index.ts, app.js, etc.)
6. **Verify stack health** — For full-stack projects, confirm services are reachable:
   - Check running ports with `lsof -nP -iTCP -sTCP:LISTEN | grep node`
   - For Fastify backends: try `curl -sf http://localhost:<PORT>/docs` or `/api/v1/auth/login` (OPTIONS)
   - Note which port the backend and frontend use (do NOT assume 3000/4200 — read CLAUDE.md)
   - Check Docker services: `docker compose ps 2>/dev/null`
   - If seed data is expected (e.g. dev seeder), confirm a `pnpm seed` is needed
7. Identify each folder and sub folder you think necessary to create a claude.md file
8. Create a claude.md file in those files after asking my validation
## Report

Summarize your understanding:

```
Project: [name]
Stack: [technologies identified]

Structure:
- [key folder]: [purpose]
- [key folder]: [purpose]

Entry Points:
- [file]: [description]

Key Files:
- [file]: [what it does]

Services:
- Backend: http://localhost:[PORT] — [status UP/DOWN]
- Frontend: http://localhost:[PORT] — [status UP/DOWN]
- DB/Docker: [running / needs `docker compose up -d`]
- Seed needed: [yes/no — command: ...]

Ready to work. What would you like to do?
```
