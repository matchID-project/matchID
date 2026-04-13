# SPEC_EVOL_001 - Rattrapage upstream des dépôts de référence

## Contexte

Le monorepo a importé plusieurs dépôts via subtree, mais quatre packages ont encore des écarts non voulus par rapport à leurs références GitHub:

- `packages/deces-ui`
- `packages/deces-backend`
- `packages/deces-dataprep`
- `packages/tools`

À l'inverse, `packages/dataprep-backend` et `packages/dataprep-frontend` sont déjà alignés avec `backend/dev` et `frontend/dev`.

## Objectif

Ramener les packages cibles au niveau de leurs branches de référence upstream, sans perdre les adaptations nécessaires au monorepo.

## Non-objectifs

- refondre immédiatement le runtime monorepo
- basculer la prod
- fusionner conceptuellement `deces-*` et `dataprep-*`

## Périmètre

Branches cibles:

- `matchID-project/tools:master`
- `matchID-project/deces-dataprep:dev`
- `matchID-project/deces-backend:dev`
- `matchID-project/deces-ui:dev`

SHAs importés de référence:

- `tools`: `028d99058940d2f214c4a6d6fcb97214873e2dc3`
- `deces-dataprep`: `41cdbd9bb09275d325c9f97a3110288d15749b82`
- `deces-backend`: `87e7811cb323315ea70815a3271de4ea8cbbfaf5`
- `deces-ui`: `43cbcb656b845f3ac6924559210589dc31838e6f`

## Inventaire initial

À la date du 2026-04-08:

- `tools`: +2 commits upstream après le 2025-04-27
- `deces-dataprep`: +2 commits upstream après le 2025-06-11
- `deces-backend`: +12 commits upstream après le 2025-08-23
- `deces-ui`: +18 commits upstream après le 2025-08-23

## Méthode recommandée

1. Produire un diff package vs upstream tip.
2. Séparer les changements en trois catégories:
   - upstream pur à reprendre
   - adaptation monorepo à conserver
   - dette locale à arbitrer
3. Intégrer package par package dans l'ordre:
   - `tools`
   - `deces-dataprep`
   - `deces-backend`
   - `deces-ui`
4. Après chaque intégration, exécuter les checks minimaux du package.
5. Documenter explicitement les écarts volontairement maintenus.

## Règles d'intégration

- un commit ou lot de commits de sync par package
- ne pas mélanger sync upstream et refactor monorepo dans le même commit si évitable
- garder un journal d'arbitrage quand un commit upstream ne peut pas être repris tel quel

## Points d'attention par package

### `tools`

- impact direct sur Data.gouv et opérations de catalogue/checksum
- effet de bord potentiel sur `deces-dataprep` et `deces-backend`
- écarts résiduels actuellement conservés après rattrapage upstream:
  - aucun écart fonctionnel volontaire conservé dans `packages/tools` après reprise des 2 commits upstream du lot 1
  - les sujets de normalisation d'exécution monorepo qui consomment `tools` restent traités hors de ce lot, dans [SPEC_EVOL_002](SPEC_EVOL_002_NORMALISATION_RUNTIME_MONOREPO.md)

### `deces-dataprep`

- impact direct sur `FILES_TO_PROCESS`
- sensible à l'année courante et aux règles de rafraîchissement mensuel
- dépendance structurelle à la normalisation runtime du monorepo
- écarts résiduels actuellement conservés après rattrapage upstream:
  - le rattrapage upstream de `FILES_TO_PROCESS` a été importé `as is`, puis harmonisé dans un commit monorepo séparé vers une forme POSIX-compatible (`[0-9]`) pour rester cohérent entre shell et Python
  - les dépendances implicites du package à la structure historique multi-repos restent hors périmètre du lot 1 et seront traitées dans [SPEC_EVOL_002](SPEC_EVOL_002_NORMALISATION_RUNTIME_MONOREPO.md)
  - le `frontend` historique utilisé par `deces-dataprep` est lancé en dev local avec `NPM_AUDIT_IGNORE=true` pour éviter qu'un audit npm bloque la validation `make` du lot 1

### `deces-backend`

- changements concentrés sur mail, score, lockfile et Makefile
- impact fonctionnel direct sur les flux OTP / bulk / validation
- écarts résiduels actuellement conservés après rattrapage upstream:
  - aucun écart fonctionnel volontaire conservé dans `packages/deces-backend` après clôture du lot 2

### `deces-ui`

- changements visibles utilisateur
- dépendance aux comportements backend actualisés
- risque de divergence fonctionnelle si UI sync sans backend sync
- écarts résiduels actuellement conservés après rattrapage upstream:
  - aucun écart fonctionnel volontaire conservé dans `packages/deces-ui` après exécution du lot 3
  - les changements upstream `deces-ui` qui ciblaient le `Makefile` racine du dépôt source ont été transposés vers le `Makefile` racine du monorepo, car les variables correspondantes n'existent plus dans `packages/deces-ui/Makefile`
  - le support `year 2026` a été transposé dans la racine avec une forme monorepo compatible avec le filtre shell déjà utilisé (`deces-([0-9]{4}|202[56]-m[0-9]{2}).txt.gz`)
  - la cible `make frontend-test` a été rendue compatible monorepo sans changer le périmètre fonctionnel UI: elle pointe explicitement sur `docker-compose-test.yml`, réexpose l'alias `FRONTEND` attendu par le compose de test et cible `nginx-development` pendant la validation locale du lot 3

## Critères d'acceptation

- chaque package cible est ramené à la référence upstream choisie
- les écarts résiduels sont exclusivement des adaptations monorepo documentées
- les composants continuent de builder ou de démarrer selon leur niveau de maturité cible

## Validation lot 1

Commandes exécutées uniquement via `make`:

- `make data-version`
  - succès
  - retourne la version de données courante (`c88006ac` lors de la validation)
  - émet encore `cat: tagfiles.version: No such file or directory`, sujet déjà classé pour le lot 4
- `make -C packages/deces-dataprep data-tag`
  - succès
  - cible résolue sans erreur; pas de recalcul quand le fichier `data-tag` est déjà à jour
- `make -C packages/deces-dataprep recipe-run`
  - succès
  - passe par l'Elasticsearch mutualisé du monorepo, puis lance correctement le run de recette
- `make -C packages/deces-dataprep dev`
  - succès
  - passe par `config`, `network` et `vm_max` mutualisés
  - démarre `deces-elasticsearch`, `matchid-backend`, `matchid-frontend-development` et `matchid-nginx-development`

## Validation lot 2

Commandes exécutées uniquement via `make`:

- `MAILDEV_UI_PORT=37343 make backend-test-vitest`
  - succès
  - `9` fichiers de tests passés, `164` tests passés
  - exécute désormais `backend-test-reset` avant Vitest pour purger Redis, supprimer les `.enc` transitoires et arrêter un éventuel `backend-dev` résident
  - couvre explicitement les comportements bulk, OTP/mail et score touchés par le rattrapage upstream
- `MAILDEV_UI_PORT=37343 make backend-dev-test`
  - succès
  - `backend-dev` attend désormais une vraie disponibilité côté hôte sur une requête `search`, pas seulement une réponse intra-conteneur
  - le smoke shell GET/POST passe intégralement
  - le contrôle `fuzzy=false` ne dépend plus d'un total figé de dataset; il est vérifié via deux assertions JSON supplémentaires sur GET et POST
  - l'exécution racine consomme bien `packages/tools` et non un repo externe `../tools`
- bruit non bloquant encore observé pendant les validations:
  - `cat: tagfiles.version: No such file or directory`
  - sujet déjà classé hors lot 2, à reprendre au lot 4
- revalidation finale d'entrée en UAT:
  - rejouée sur un worktree backend propre
  - `auth.controller.ts` a été écarté du worktree actif pour ne pas biaiser la validation
  - l'autofix ESLint déclenché par `make backend-dev` sur `processStream.ts` a été intégré en source, puis `make backend-dev-test` a été rejoué avec succès sans réintroduire de diff backend actif

## Validation lot 3

Commandes exécutées uniquement via `make`:

- `make frontend-dev`
  - succès
  - l'audit npm n'est neutralisé que sur ce chemin de dev local UI
  - démarre `deces-ui-frontend-development` et `deces-ui-nginx-development`
- `MAILDEV_UI_PORT=37343 make frontend-test`
  - succès
  - exécute les trois scénarios Playwright via `docker-compose-test.yml`
  - `Recherche Simple`: 8 étapes passées
  - `Recherche Avancée`: 9 étapes passées
  - `Appariement Wikidata`: 10 étapes passées
  - bilan final: `3` tests réussis, `0` échec, `27` étapes passées
- comportements explicitement couverts par ces validations:
  - chargement et navigation UI sur la recherche simple
  - recherche avancée avec `fuzzy=false`
  - flux OTP UI complet jusqu'au lancement de l'appariement Wikidata
  - présence du résultat attendu `Costes` après traitement
- bruit non bloquant encore observé pendant les validations:
  - `cat: tagfiles.version: No such file or directory`
  - sujet déjà classé hors lot 3, à reprendre au lot 4

## Dépendances

- [SPEC_EVOL_000](SPEC_EVOL_000_CADRAGE_MIGRATION_MONOREPO.md)
- [SPEC_EVOL_002](SPEC_EVOL_002_NORMALISATION_RUNTIME_MONOREPO.md)
- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
