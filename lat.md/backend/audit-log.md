# Méta-journal d'audit

Le journal transverse (`audit_event`) enregistre toute action significative de tous les domaines, et l'expose en lecture par son propre module — filtré par le domaine de chaque ligne.

## Journal exposé par son propre module

[[@libs/audit-log-backend/src/init.ts#Module]] monte `GET /audit-events` ; la route vit dans `audit-log-backend` et non plus dans le registre d'accès.

Cela **amende** la décision « audit-log est un noyau sans HTTP » ([[platform#Audit-log : noyau sans HTTP]]) sans en casser la raison d'être : ce qui était voulu, et reste vrai, c'est que les registres n'importent pas ce paquet pour leur logique métier — ils écrivent à travers une interface `AuditLogger` locale dont seul `app.ts` connaît l'implémentation. Le découplage porte sur l'**écriture**, et il est intact. Seule la **lecture** rejoint le noyau.

Deux défauts ont motivé le déplacement, et le second était une faille.

### Un journal transverse ne se loge pas dans un registre métier

La route interroge la table globale `audit_event` : logée dans `access-registry-backend`, elle rendait le journal de TOUS les domaines indisponible dès que ce registre-là n'était pas monté.

Le point est devenu concret avec les drapeaux de fonctionnalité ([[backend-bootstrap#Drapeaux de fonctionnalité par domaine]]) : `FEATURE_ACCESS_REGISTRY=false` aurait emporté la traçabilité du registre d'incidents, dont les événements auraient continué d'être écrits sans que rien ne permette de les relire. Ce module n'est donc lui-même **pas pilotable par drapeau** — la traçabilité d'un registre de conformité ne se démonte pas.

### Le journal est filtré par domaine, pas ouvert en bloc

[[@libs/audit-log-backend/src/utils/audit-scope.ts#canReadAuditEvent]] ne laisse voir un événement qu'à qui peut lire le domaine qu'il concerne.

Sans ce filtre, le journal contournait le RBAC. Constaté en production le 2026-09-18 : `tech_admin` reçoit un 403 sur tout le préfixe `/incidents` — la règle `manage Incident` lui est explicitement refusée — et lisait pourtant 78 événements d'incidents par le journal, dont le garde était `read AccessRecord` : qui a créé, consulté, exporté et supprimé quel incident, horodaté et nominatif. Le journal rendait observable exactement ce que l'interdiction voulait soustraire.

Le garde est désormais son propre sujet, `AuditEvent`, seedé pour `dpo`, `auditor` et `tech_admin` — ce dernier conservant ainsi sa lecture légitime du registre d'accès sans retrouver celle des incidents.

Le rattachement `targetType` → sujet CASL se fait par **préfixe** (`incident*` → `Incident`, `access_record*` → `AccessRecord`) : une route qui écrira `incident_verify` demain reste correctement rattachée sans toucher ce module. Un `targetType` inconnu est **masqué** plutôt qu'exposé — le défaut va vers la discrétion, à l'inverse de la règle des drapeaux de fonctionnalité, parce que l'enjeu est inverse.

### `meta.total` et `meta.filtered` sont distincts

La réponse porte le volume réel du journal pour les filtres demandés, et le volume que cet appelant a le droit de voir.

Les confondre ferait croire à un DPO que le journal est plus court qu'il ne l'est. Les séparer lui dit qu'une partie lui est masquée, sans lui en révéler le contenu.

### Le filtrage est applicatif, pas SQL

Les lignes sont filtrées après la requête, sur leur `targetType`.

La correspondance `targetType` → sujet est une règle applicative, et une condition CASL peut porter sur des champs (`encodedBy: $user.id`) qu'un `where` sur `audit_event` ne saurait pas reproduire. Le journal reste borné par les filtres `filter[action]` / `filter[actorId]`.
