---
description: Audit visuel Playwright vs Figma, génère un rapport de bugs, corrige itérativement
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_snapshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_resize
model: opus
argument-hint: [--routes "/ /projects /kanban"] [--no-fix] [--figma-dir docs/figma-screenshots]
---

> **Démarrage** : affiche immédiatement `[TPK-audit-fixes] 🤖 Modèle : opus` comme première ligne de sortie.

# TPK-Audit-Fixes

## Purpose

Compare the running frontend against Figma reference screenshots, produce a prioritised bug report, then apply fixes iteratively (route crash > i18n > visual diff > theme).

## Arguments

- `--routes "r1 r2 ..."` — Space-separated list of routes to audit (default: all routes from router)
- `--no-fix` — Audit only, skip the fix phase
- `--figma-dir <path>` — Path to Figma reference screenshots (default: `docs/figma-screenshots`)

## Prerequisite checklist

Before running:

1. **Stack healthy?** — `lsof -nP -iTCP:4200 -sTCP:LISTEN` + `curl http://localhost:8888/docs`
2. **Authenticated?** — If login form is not headlessly testable, inject JWT:
   ```js
   const j = await fetch('http://localhost:8888/api/v1/auth/login', {
     method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ email:'<seed_email>', password:'<seed_password>' })
   }).then(r=>r.json());
   const d = j.data;
   localStorage.setItem('ember_simple_auth-session', JSON.stringify({
     authenticated: { authenticator:'authenticator:jwt', data: d }
   }));
   location.reload();
   ```
3. **Default project selected?** — Confirm `localStorage.getItem('sprintforge:current-project')` is set or let the route auto-select.

## Workflow

### Step 1 — Collect routes

```bash
# Ember: grep forRouter() or router.ts
grep -nE "this\.route|route\(" @apps/front/app/router.ts @libs/*/src/index.ts 2>/dev/null | head -40
```

### Step 2 — Screenshot each route

For each route:
- Resize to 1440×900
- Navigate, wait 3s
- Take full-page screenshot → `audit-screenshots/[route-slug].png`
- Collect console errors
- Capture page title to confirm not redirected to /login or blank

### Step 3 — Compare with Figma

For each route where a `figma-screenshots/*.png` exists (match by filename convention):

| Route | Figma file |
|-------|-----------|
| `/` | `01-dashboard.png` |
| `/projects` | `02-projects.png` |
| `/backlog` | `03-backlog.png` |
| `/kanban` | `04-kanban.png` |
| `/user-story-map` | `05-user-story-map.png` |
| `/sprints` | `06-sprints.png` |
| `/time-tracking` | `07-time-tracking.png` |
| `/users` | `08-users.png` |
| `/settings` | `09-settings.png` |
| `/login` | `10-login.png` |

Read both images and describe differences.

### Step 4 — Classify bugs

Assign a severity to each finding:

| Severity | Definition |
|----------|-----------|
| **P0 Bloquant** | Route crashes (blank screen, JS error in model hook), auth fails silently |
| **P1 Critique** | Wrong locale (EN vs FR), missing data (all-zero counters), 401 on API calls |
| **P2 Mineur** | Visual diff (spacing, colors), missing avatar, wrong button label |

### Step 5 — Fix phase (unless `--no-fix`)

Fix in order of severity:

1. **P0 first** — Identify root cause (raw `fetch()` without auth? Unguarded `.map()` on API response? Vite cache?). Apply fix.
2. **P1 next** — i18n locale, missing schema, auto-select project.
3. **P2 last** — CSS overrides, token fixes.

After each fix group: rebuild affected libs, reload Playwright, re-screenshot, confirm fix.

**Auth fix pattern (raw fetch → authFetch):**
```ts
// @libs/shared-front/src/utils/auth-fetch.ts must exist
import { authFetch } from '@libs/shared-front/utils/auth-fetch';
// Replace: const res = await fetch(`/api/v1/...`);
// With:    const res = await authFetch(`/api/v1/...`);
// Add guard: if (!res.ok) { this.list = []; return this.list; }
// Add guard: json.data ?? []
```

**Lib rebuild + Vite restart pattern:**
```bash
cd @libs/<changed-lib> && pnpm build
# Then in @apps/front:
kill $(lsof -nP -iTCP:4200 -sTCP:LISTEN | awk 'NR>1{print $2}')
nohup pnpm start > /tmp/front.log 2>&1 &
until curl -sf http://localhost:4200 -o /dev/null; do sleep 2; done
```

### Step 6 — Generate report

```markdown
## Audit-Fixes Report — [date]

### Routes audited: [N]

| Route | Figma match | Console errors | Status |
|-------|------------|----------------|--------|
| /     | 95%        | 0              | ✅ |
...

### Bugs found: P0=[x] P1=[y] P2=[z]
### Bugs fixed: [n]

### Remaining issues
- [list]
```

## Notes

- Screenshots saved to `audit-screenshots/` (gitignored or review-only)
- Never edit node_modules; fix source in `@libs/*/src`
- After editing source, always `pnpm build` the lib + restart Vite if needed
- JWT expires in 15 min by default — refresh token via `authFetch` fetch before long sessions
