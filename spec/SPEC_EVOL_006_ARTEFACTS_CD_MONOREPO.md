# SPEC_EVOL_006 - Artefacts versionnés et CD monorepo

## Contexte

Le lot 6 a remis une CI racine de validation. Il ne reconstruit pas encore la CD historique des repos d'origine, qui publiait des images Docker, un package legacy `matchID`, et les snapshots Elasticsearch du dataprep.

Le lot 7 doit remettre cette chaîne de production d'artefacts sous contrôle du monorepo, sans confondre:

- validation CI
- publication d'images
- publication de snapshots
- déploiement distant

## Objectif

Définir puis reconstruire les jobs de build/publication d'artefacts nécessaires au contrat de référence du monorepo.

## Non-objectifs

- exécuter dès ce lot le déploiement préprod `deploy-remote`
- reproduire immédiatement tous les workflows historiques non critiques

## Contrat d'artefacts cible

Les artefacts de référence à produire depuis le monorepo sont:

- image `matchid-backend` issue de `packages/dataprep-backend`
- image `matchid-frontend` issue de `packages/dataprep-frontend`
- image `deces-backend` issue de `packages/deces-backend`
- image `deces-ui` issue de `packages/deces-ui`
- snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}` issu de `packages/deces-dataprep`

Artefact de compatibilité historique:

- package `matchID-${backend_version}-${frontend_version}.tar.gz` / `matchID-latest.tar.gz` publié par `packages/dataprep-backend`

Cet artefact de compatibilité n'entre pas dans le contrat minimal de déploiement décès, mais il reste un artefact historique encore documenté côté site et doit donc être explicitement tranché au lot 7.

## Convention de versionnage retenue

Principe: la version canonique d'un artefact image est la sortie de la cible `make version` du package qui le produit.

Conséquences:

- `packages/deces-backend`: tag image = `make -C packages/deces-backend version`
- `packages/deces-ui`: tag image = `make -C packages/deces-ui version`
- `packages/dataprep-backend`: tag image = `make -C packages/dataprep-backend version | awk '{print $NF}'`
- `packages/dataprep-frontend`: tag image = `make -C packages/dataprep-frontend version | awk '{print $NF}'`

Le nom du snapshot reste:

- `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`

avec:

- `DATAPREP_VERSION` dérivé du code/recipe/index du dataprep
- `DATA_VERSION` dérivé du catalog tag racine

## Convention d'exposition retenue

Le monorepo expose les valeurs de version via `make`:

- `make version` pour l'application décès racine
- `make dataprep-version`
- `make data-version`
- `make -C packages/<package> version` pour les packages image

Le lot 7 doit ajouter des wrappers racine dédiés aux artefacts pour rendre ces conventions explicites et utilisables en workflow CI/CD.

## Sort des jobs CD historiques

### `dataprep-backend`

Workflows historiques:

- `pull.yml`: validation PR
- `push.yml`: build image `matchid-backend`, push Docker Hub, publication du package `matchID-*` sur `master`
- `deploy.yml`: déploiement distant legacy

Décision lot 7:

- conserver le build/publish de l'image `matchid-backend`
- conserver le package `matchID-*` comme artefact de compatibilité tant qu'il reste documenté/consommé
- sortir `deploy.yml` du lot 7; sa reconstruction relève du lot 8

### `dataprep-frontend`

Workflows historiques:

- `pull.yml`: validation PR
- `push.yml`: build image `matchid-frontend`, push Docker Hub

Décision lot 7:

- conserver le build/publish de l'image `matchid-frontend`
- normaliser le workflow historique, qui mélangeait un shell non robuste et un `make build backend-docker-check up`

### `deces-backend`

Workflow historique:

- `dockerimage.yml`: build image `deces-backend`, tests, push Docker Hub, upload d'une archive locale

Décision lot 7:

- conserver le build/publish de l'image `deces-backend`
- conserver les tests en amont via la CI lot 6
- l'upload d'archive locale n'entre pas dans le contrat minimal de déploiement et peut rester hors chemin critique

### `deces-ui`

Workflows historiques:

- `pr.yml`: validation PR
- `push.yml`: build image `deces-ui`, tests, push Docker Hub, déploiement distant
- `logs-*.yml`: calculs de logs/statistiques

Décision lot 7:

- conserver le build/publish de l'image `deces-ui`
- sortir le déploiement distant du lot 7; sa reconstruction relève du lot 8
- sortir les workflows `logs-*` du contrat minimal de déploiement; ils relèvent d'un traitement séparé

### `deces-dataprep`

Workflows historiques:

- `pr.yml` / `small.yml`: runs locaux petits datasets
- `year.yml` / `full.yml` / `push-dev.yml` / `push-master.yml`: runs distants gros datasets, publication de snapshot repository

Décision lot 7:

- conserver la production/publication du snapshot `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
- reconstruire sa publication comme CD du monorepo
- sortir l'orchestration distante complète (`remote-all`) du lot 7; sa reconstruction relève du lot 8

## Travaux du lot 7

### A. Wrappers racine

- ajouter des cibles racine `make` pour build/publish des images
- ajouter des cibles racine `make` pour exposer les versions d'artefacts
- ajouter des cibles racine `make` pour produire/publier/restaurer le snapshot dataprep

### B. Workflow CD racine

- ajouter un workflow racine `cd.yml`
- déclenchement sur `push` vers `dev` et `master`
- possibilité de `workflow_dispatch`
- jobs conditionnels par zone modifiée

### C. Discipline de publication

- `push` `dev`: publication des tags de branche `dev`
- `push` `master`: publication des tags `master`/release et des artefacts de compatibilité requis
- aucun déploiement distant dans ce workflow; seulement production/publication

### D. Preuve de parité job à job

Le lot 7 ne doit pas être validé sur une impression globale du workflow `cd.yml`.

La preuve attendue est explicite, job par job:

- une matrice exhaustive `workflow source -> workflow monorepo -> statut`
- une picture complete lots 6/7/8 `upstream -> monorepo`, service par service et job par job
- une preuve locale `make` du comportement attendu
- une preuve GitHub Actions du job monorepo correspondant
- quand le job produit un artefact, une vérification du contenu ou des métadonnées de cet artefact

Format attendu pour l'UAT du lot 7:

- tableau paddé
- une ligne par job historique
- colonnes minimales:
  - composant
  - workflow/job source
  - workflow/job monorepo
  - lot cible
  - preuve `make`
  - preuve GitHub
  - statut

## Picture complete lots 6/7/8 au 15 avril 2026

| Composant | Workflow/job source | Avant | Workflow/job monorepo | Lot cible | Preuve `make` | Preuve GitHub | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tools` | `actions.yml` / `swift` | build/push image `tools` sur `push` | aucun | hors contrat critique | n/a | n/a | retire du contrat |
| `tools` | `actions.yml` / `remote` | configuration distante sur `push master` | workflow de deploiement monorepo | lot 8 | n/a | n/a | reporte lot 8 |
| `dataprep-backend` | `pull.yml` / `test` | validation PR `make version backend-docker-check ...` | `ci.yml` / `Dataprep smoke` | lot 6 | `make smoke-dataprep` | `CI` push `24483907269` job `Dataprep smoke` vert; `CI` PR `24483908784` job `Dataprep smoke` vert | migre lot 6 |
| `dataprep-backend` | `push.yml` / `build` | build/push image `matchid-backend`, package legacy sur `push dev/master` | `cd.yml` / `Publish matchid-backend image` | lot 7 | `make artifact-build-dataprep-backend`, `make artifact-publish-dataprep-backend` | `CD` rerun `24483907271` job `Publish matchid-backend image`: step build vert, step publish rouge (`docker login` unauthorized pour `matchid`) | job reconstruit, cred Docker Hub invalide |
| `dataprep-backend` | `deploy.yml` / `deploy` | deploy legacy sur `push tuto` | workflow de deploiement monorepo | lot 8 | n/a | n/a | reporte lot 8 |
| `dataprep-frontend` | `pull.yml` / `test` | validation PR `frontend-docker-check || make build ...` | `ci.yml` / `Dataprep smoke` + `End-to-end smoke` | lot 6 | `make smoke-dataprep`, `make smoke-e2e` | `CI` push `24483907269`: `Dataprep smoke` et `End-to-end smoke` verts; `CI` PR `24483908784`: `Dataprep smoke` et `End-to-end smoke` verts | migre lot 6 |
| `dataprep-frontend` | `push.yml` / `build` | build/push image `matchid-frontend` sur `push dev/master` | `cd.yml` / `Publish matchid-frontend image` | lot 7 | `make artifact-build-dataprep-frontend`, `make artifact-publish-dataprep-frontend` | `CD` rerun `24483907271` job `Publish matchid-frontend image`: step build vert, step publish rouge (`docker login` unauthorized pour `matchid`) | job reconstruit, cred Docker Hub invalide |
| `deces-backend` | `dockerimage.yml` / `build` | build, tests, push image, upload tar sur `push` | `ci.yml` / `Backend smoke` + `cd.yml` / `Publish deces-backend image` | lots 6/7 | `make smoke-backend`, `make artifact-build-deces-backend`, `make artifact-publish-deces-backend` | `CI` push `24483907269` job `Backend smoke` vert; `CI` PR `24483908784` job `Backend smoke` vert; `CD` rerun `24483907271` job `Publish deces-backend image`: step build vert, step publish rouge (`docker login` unauthorized pour `matchid`) | migre lots 6/7, cred Docker Hub invalide |
| `deces-backend` | `dockerimage.yml` / `bulk` | tests perf et upload rapports | aucun | hors contrat critique | n/a | n/a | retire du contrat critique |
| `deces-ui` | `pr.yml` / `test` | build + `deploy-local backend-test frontend-test` sur PR | `ci.yml` / `UI smoke` + `End-to-end smoke` | lot 6 | `make smoke-e2e`; `make smoke-ui` encore instable localement au head courant | `CI` push `24483907269`: `UI smoke` et `End-to-end smoke` verts; `CI` PR `24483908784`: `End-to-end smoke` vert, `UI smoke` rouge | parite non encore demontree sur `UI smoke` |
| `deces-ui` | `push.yml` / `build` | build, test, push image sur `push dev/master` | `ci.yml` / `UI smoke` + `cd.yml` / `Publish deces-ui image` | lots 6/7 | `make artifact-build-deces-ui`, `make artifact-publish-deces-ui` | `CD` rerun `24483907271` job `Publish deces-ui image`: step build vert, step publish rouge (`docker login` unauthorized pour `matchid`) | job reconstruit, cred Docker Hub invalide |
| `deces-ui` | `push.yml` / `deploy` | `deploy-remote` sur `push dev/master` / dispatch | workflow de deploiement monorepo | lot 8 | n/a | n/a | reporte lot 8 |
| `deces-ui` | `logs-full.yml` / `logs` | calcul stats complet | aucun | hors contrat critique | n/a | n/a | retire du contrat critique |
| `deces-ui` | `logs-update.yml` / `logs` | calcul stats incremental | aucun | hors contrat critique | n/a | n/a | retire du contrat critique |
| `deces-dataprep` | `pr.yml` / `test` | run local `make all` sur petit dataset PR | `ci.yml` / `Dataprep smoke` | lot 6 | `make smoke-dataprep` | `CI` push `24483907269` job `Dataprep smoke` vert; `CI` PR `24483908784` job `Dataprep smoke` vert | migre lot 6 |
| `deces-dataprep` | `small.yml` / `build` | runs locaux petits datasets sur `push dev/schedule` | `ci.yml` / `Dataprep smoke` | lot 6 | `make smoke-dataprep` | `CI` push `24483907269` job `Dataprep smoke` vert; `CI` PR `24483908784` job `Dataprep smoke` vert | migre lot 6 |
| `deces-dataprep` | `year.yml` / `build` | `full-check` + `remote-all` annuel distant | `cd.yml` / `Publish dataprep snapshot` + workflow de deploiement monorepo | lots 7/8 | `make artifact-produce-dataprep-snapshot`, `make artifact-publish-dataprep-snapshot`, `make artifact-restore-dataprep-snapshot` | `CD` push `24483907271` job `Publish dataprep snapshot` vert, metadata `dataprep-snapshot-metadata` publiee | job snapshot reconstruit, deploiement reporte lot 8 |
| `deces-dataprep` | `full.yml` / `check-previous-failure` | garde anti rerun sur schedule | workflow de deploiement monorepo | lot 8 | n/a | n/a | reporte lot 8 |
| `deces-dataprep` | `full.yml` / `build` | `full-check` + `remote-all` full distant | `cd.yml` / `Publish dataprep snapshot` + workflow de deploiement monorepo | lots 7/8 | `make artifact-produce-dataprep-snapshot`, `make artifact-publish-dataprep-snapshot`, `make artifact-restore-dataprep-snapshot` | `CD` push `24483907271` job `Publish dataprep snapshot` vert | job snapshot reconstruit, deploiement reporte lot 8 |
| `deces-dataprep` | `push-dev.yml` / `build` | `full-check` + `remote-all` annuel sur `push dev` | `cd.yml` / `Publish dataprep snapshot` + workflow de deploiement monorepo | lots 7/8 | `make artifact-produce-dataprep-snapshot`, `make artifact-publish-dataprep-snapshot`, `make artifact-restore-dataprep-snapshot` | `CD` push `24483907271` job `Publish dataprep snapshot` vert | job snapshot reconstruit, deploiement reporte lot 8 |
| `deces-dataprep` | `push-master.yml` / `build` | `full-check` + `remote-all` full sur `push master` | `cd.yml` / `Publish dataprep snapshot` + workflow de deploiement monorepo | lots 7/8 | `make artifact-produce-dataprep-snapshot`, `make artifact-publish-dataprep-snapshot`, `make artifact-restore-dataprep-snapshot` | `CD` push `24483907271` job `Publish dataprep snapshot` vert | job snapshot reconstruit, deploiement reporte lot 8 |

## Matrice exhaustive à couvrir au lot 7

- `packages/tools/.github/workflows/actions.yml` / `swift`
- `packages/tools/.github/workflows/actions.yml` / `remote`
- `packages/dataprep-backend/.github/workflows/pull.yml` / `test`
- `packages/dataprep-backend/.github/workflows/push.yml` / `build`
- `packages/dataprep-backend/.github/workflows/deploy.yml` / `deploy`
- `packages/dataprep-frontend/.github/workflows/pull.yml` / `test`
- `packages/dataprep-frontend/.github/workflows/push.yml` / `build`
- `packages/deces-backend/.github/workflows/dockerimage.yml` / `build`
- `packages/deces-backend/.github/workflows/dockerimage.yml` / `bulk`
- `packages/deces-ui/.github/workflows/pr.yml` / `test`
- `packages/deces-ui/.github/workflows/push.yml` / `build`
- `packages/deces-ui/.github/workflows/push.yml` / `deploy`
- `packages/deces-ui/.github/workflows/logs-full.yml`
- `packages/deces-ui/.github/workflows/logs-update.yml`
- `packages/deces-dataprep/.github/workflows/pr.yml` / `test`
- `packages/deces-dataprep/.github/workflows/small.yml` / `build`
- `packages/deces-dataprep/.github/workflows/year.yml` / `build`
- `packages/deces-dataprep/.github/workflows/full.yml` / `check-previous-failure`
- `packages/deces-dataprep/.github/workflows/full.yml` / `build`
- `packages/deces-dataprep/.github/workflows/push-dev.yml` / `build`
- `packages/deces-dataprep/.github/workflows/push-master.yml` / `build`

## Affectation cible décidée

| Composant | Workflow/job source | Workflow/job monorepo cible | Statut cible |
| --- | --- | --- | --- |
| `tools` | `actions.yml` / `swift` | aucun | retiré du contrat d'artefacts critique |
| `tools` | `actions.yml` / `remote` | workflow de déploiement lot 8 | reporté lot 8 |
| `dataprep-backend` | `pull.yml` / `test` | `ci.yml` / `Dataprep smoke` | migré lot 6 |
| `dataprep-backend` | `push.yml` / `build` | `cd.yml` / `Publish matchid-backend image` | migré lot 7 |
| `dataprep-backend` | `deploy.yml` / `deploy` | workflow de déploiement lot 8 | reporté lot 8 |
| `dataprep-frontend` | `pull.yml` / `test` | `ci.yml` / `Dataprep smoke` + `End-to-end smoke` | migré lot 6 |
| `dataprep-frontend` | `push.yml` / `build` | `cd.yml` / `Publish matchid-frontend image` | migré lot 7 |
| `deces-backend` | `dockerimage.yml` / `build` | `ci.yml` / `Backend smoke` + `cd.yml` / `Publish deces-backend image` | migré lots 6/7 |
| `deces-backend` | `dockerimage.yml` / `bulk` | aucun | retiré du contrat critique, piste perf séparée |
| `deces-ui` | `pr.yml` / `test` | `ci.yml` / `UI smoke` + `End-to-end smoke` | migré lot 6 |
| `deces-ui` | `push.yml` / `build` | `ci.yml` / `UI smoke` + `cd.yml` / `Publish deces-ui image` | migré lots 6/7 |
| `deces-ui` | `push.yml` / `deploy` | workflow de déploiement lot 8 | reporté lot 8 |
| `deces-ui` | `logs-full.yml` / `logs` | aucun | retiré du contrat de déploiement critique |
| `deces-ui` | `logs-update.yml` / `logs` | aucun | retiré du contrat de déploiement critique |
| `deces-dataprep` | `pr.yml` / `test` | `ci.yml` / `Dataprep smoke` | migré lot 6 |
| `deces-dataprep` | `small.yml` / `build` | `ci.yml` / `Dataprep smoke` | migré lot 6 |
| `deces-dataprep` | `year.yml` / `build` | `cd.yml` / `Publish dataprep snapshot` + workflow de déploiement lot 8 | scindé lots 7/8 |
| `deces-dataprep` | `full.yml` / `check-previous-failure` | workflow distant lot 8 si conservé | reporté lot 8 |
| `deces-dataprep` | `full.yml` / `build` | `cd.yml` / `Publish dataprep snapshot` + workflow de déploiement lot 8 | scindé lots 7/8 |
| `deces-dataprep` | `push-dev.yml` / `build` | `cd.yml` / `Publish dataprep snapshot` + workflow de déploiement lot 8 | scindé lots 7/8 |
| `deces-dataprep` | `push-master.yml` / `build` | `cd.yml` / `Publish dataprep snapshot` + workflow de déploiement lot 8 | scindé lots 7/8 |

## Etat lot 7 au 15 avril 2026

### Implémentation réalisée

- ajout des wrappers racine:
  - `make artifact-versions`
  - `make artifact-build-dataprep-backend`
  - `make artifact-publish-dataprep-backend`
  - `make artifact-build-dataprep-frontend`
  - `make artifact-publish-dataprep-frontend`
  - `make artifact-build-deces-backend`
  - `make artifact-publish-deces-backend`
  - `make artifact-build-deces-ui`
  - `make artifact-publish-deces-ui`
  - `make artifact-build-legacy-package`
  - `make artifact-publish-legacy-package`
  - `make artifact-produce-dataprep-snapshot`
  - `make artifact-publish-dataprep-snapshot`
  - `make artifact-restore-dataprep-snapshot`
- ajout du workflow racine [`.github/workflows/cd.yml`](/home/antoinefa/src/matchID/matchID/.github/workflows/cd.yml)
- reconstruction des jobs CD image pour:
  - `matchid-backend`
  - `matchid-frontend`
  - `deces-backend`
  - `deces-ui`
- reconstruction du job CD GitHub `Publish dataprep snapshot`
- adaptations monorepo de build:
  - configuration explicite de `packages/deces-dataprep` avant build `dataprep-backend` / `dataprep-frontend`
  - propagation des variables `DATA_DIR`, `NPM_AUDIT_DRY_RUN` et `NPM_AUDIT_IGNORE` dans les compose de build concernes
  - correction de typage de test dans [bulk.spec.ts](/home/antoinefa/src/matchID/matchID/packages/deces-backend/src/controllers/bulk.spec.ts) pour laisser compiler `deces-backend` en image sans patch produit
- adaptations monorepo de publication et snapshot:
  - normalisation du tag de branche Docker via `GIT_BRANCH_TAG` pour accepter une branche du type `feat/refacto-make`
  - `vm_max` de [packages/dataprep-backend/Makefile](/home/antoinefa/src/matchID/matchID/packages/dataprep-backend/Makefile) ne demande plus `sudo` si la valeur runtime est deja correcte
  - [packages/deces-dataprep/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-dataprep/Makefile) laisse `REPOSITORY_BUCKET` surchargeable
  - [Makefile](/home/antoinefa/src/matchID/matchID/Makefile) publie desormais le snapshot dataprep via [packages/deces-infra/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-infra/Makefile) sur `deces-elasticsearch`, au lieu du backend legacy `matchid-elasticsearch`
  - [packages/deces-infra/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-infra/Makefile) porte maintenant `elasticsearch-freeze`, `elasticsearch-repository-backup`, `elasticsearch-repository-delete` et `elasticsearch-repository-list`
  - la publication du snapshot Elasticsearch est idempotente: un rerun supprime d'abord le snapshot du meme nom avant recreation

### Vérification `make` exécutée

- `make artifact-versions`
  - `matchid-backend: 0.4.0-e4d91b`
  - `matchid-frontend: 0.4.0-2d96b8`
  - `deces-backend: 0.4.0-4255-gb972f151`
  - `deces-ui: 0.4.0-4255-gb972f151`
- `make artifact-build-dataprep-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/matchid-backend:0.4.0-e4d91b`
- `make artifact-publish-dataprep-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-e4d91b`, `feat-refacto-make`
  - digest: `sha256:f3da456ec3e76b67cf8ab870a9669abd4a255af992a26b194acf30981944ca72`
- `make artifact-build-dataprep-frontend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/matchid-frontend:0.4.0-2d96b8`
  - artefact produit: `packages/dataprep-frontend/nginx/dist/matchID-frontend-0.4.0-2d96b8-dist.tar.gz`
  - checksum: `485ba86be4d5c0d8cdfe04d1b43bd770473d9fd7`
- `make artifact-publish-dataprep-frontend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-2d96b8`, `feat-refacto-make`
  - digest: `sha256:e1c7d89a54b7b148ad609919e1893b2d3bd0ce6dbcc8a7faf9a3318b14b71e62`
- `make artifact-build-deces-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/deces-backend:0.4.0-4255-gb972f151`
  - adaptation monorepo necessaire: staging explicite de `communes.json`, `disposable-mail.txt` et `wikidata.json` dans un contexte de build temporaire, plus propagation de `NPM_AUDIT_DRY_RUN=true`
- `make artifact-publish-deces-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-4255-gb972f151`, `feat-refacto-make`
  - digest: `sha256:6403e3884118b2d32a8d1d11517b197763d90d5676fd0e6d1a3c6455ce153974`
- `make artifact-build-deces-ui GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/deces-ui:0.4.0-4255-gb972f151`
  - artefact produit: `deces-ui-build/deces-ui-0.4.0-4255-gb972f151-frontend-dist.tar.gz`
  - checksum: `2fe5edbaf08395a2a80e28e8485720bb4367c9b1`
  - adaptation monorepo necessaire: build dist/Nginx orchestre depuis la racine sans repasser par la cible racine `build`, plus propagation de `NPM_AUDIT_IGNORE`
- `make artifact-publish-deces-ui GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-4255-gb972f151`, `feat-refacto-make`
  - digest: `sha256:3366224f4bf7f600658c9d68653a7e472702b62dc86ba4073f713171e9e13e3a`
- `make artifact-produce-dataprep-snapshot FILES_TO_PROCESS=deces-2020.txt.gz`
  - succes
  - `679924 lines processed`
  - `679593 lines written`
- `make artifact-publish-dataprep-snapshot FILES_TO_PROCESS=deces-2020.txt.gz`
  - succes
  - snapshot publie: `esdata_6df42346_d2d7ee21`
- rerun `make artifact-publish-dataprep-snapshot FILES_TO_PROCESS=deces-2020.txt.gz REPOSITORY_BUCKET=fichier-des-personnes-decedees-elasticsearch-dev`
  - succes
  - publication idempotente validee localement sur `esdata_6df42346_c88006ac`
- `make -C packages/deces-infra elasticsearch-index-delete ES_INDEX=deces`
  - succes
- `make artifact-restore-dataprep-snapshot FILES_TO_PROCESS=deces-2020.txt.gz`
  - succes
- `make -C packages/deces-infra elasticsearch-index-export ...`
  - export avant suppression puis apres restore reussis
  - verification stricte:
    - `before_count=679573`
    - `after_count=679573`
    - `count_match=yes`
    - `sample_match=yes`
- `make smoke-backend MAILDEV_UI_PORT=37343`
  - succes apres correction du target `config` dans [packages/deces-backend/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-backend/Makefile)
  - preuve utile: la plomberie racine lot 6 reste compatible avec les changements lot 7
- `GITHUB_HEAD_REF=feat/refacto-make MAILDEV_UI_PORT=37343 PLAYWRIGHT_VERSION=1.59.1 SMOKE_FILES_TO_PROCESS=deces-2020.txt.gz make smoke-e2e`
  - succes
  - preuve utile: la chaine `dataprep -> index -> backend -> ui` reste validee localement sur le chemin PR-like
- `GITHUB_HEAD_REF=feat/refacto-make MAILDEV_UI_PORT=37343 PLAYWRIGHT_VERSION=1.59.1 SMOKE_FILES_TO_PROCESS=deces-2020.txt.gz make smoke-ui`
  - rerun 1: echec local sur conflit de conteneur `deces-backend-redis`
  - rerun 2: blocage local autour de `99951` lignes ecrites, sans reproduire l'erreur PR GitHub
  - conclusion: la cible `smoke-ui` n'est pas encore une preuve locale stable au head courant

### Vérification GitHub Actions exécutée

- run `24483907269` (`CI`, push, commit `406f90f5`)
  - workflow vert
  - `Tools smoke` (`71554442047`): vert
  - `Backend smoke` (`71554442053`): vert
  - `UI smoke` (`71554442057`): vert
  - `Dataprep smoke` (`71554442061`): vert
  - `End-to-end smoke` (`71554442068`): vert
- run `24483908784` (`CI`, pull_request, commit `406f90f5`)
  - workflow rouge
  - `Tools smoke` (`71554442187`): vert
  - `Backend smoke` (`71554442170`): vert
  - `Dataprep smoke` (`71554442185`): vert
  - `End-to-end smoke` (`71554442159`): vert
  - `UI smoke` (`71554442182`): rouge
    - la cible echoue dans `smoke-dataprep-run`, pas dans Playwright
    - erreur observee: deux chunks Elasticsearch en `400` (`x_content_parse_exception` et `illegal_argument_exception`)
    - l'ecart PR/push/local reste ouvert
- run `24483907271` (`CD`, push, commit `406f90f5`)
  - `Detect artifact changes` (`71554419432`): vert
  - `Publish matchid-frontend image` (`71558662570`):
    - step `Build matchid-frontend image`: vert
    - step `Publish matchid-frontend image`: rouge
    - cause: `docker login` retourne `unauthorized: incorrect username or password`
  - `Publish deces-ui image` (`71558662562`):
    - step `Build deces-ui image`: vert
    - step `Publish deces-ui image`: rouge
    - cause: `docker login` retourne `unauthorized: incorrect username or password`
  - `Publish deces-backend image` (`71558662580`):
    - step `Build deces-backend image`: vert
    - step `Publish deces-backend image`: rouge
    - cause: `docker login` retourne `unauthorized: incorrect username or password`
  - `Publish matchid-backend image` (`71558662559`):
    - step `Build matchid-backend image`: vert
    - step `Publish matchid-backend image`: rouge
    - cause: `docker login` retourne `unauthorized: incorrect username or password`
  - `Publish dataprep snapshot` (`71554440661`):
    - step `Produce dataprep snapshot`: vert
    - step `Export dataprep snapshot metadata`: vert
    - step `Publish dataprep snapshot`: vert
    - artifact GitHub: `dataprep-snapshot-metadata`

### Matrice de preuve job à job

```text
Composant         | Job source                                 | Job monorepo                                    | Preuve make                                   | Preuve GitHub                               | Statut
----------------- | ------------------------------------------ | ----------------------------------------------- | --------------------------------------------- | ------------------------------------------- | -----------------------------------------------
tools             | actions.yml / swift                        | aucun                                           | n/a                                           | n/a                                         | retire du contrat critique
tools             | actions.yml / remote                       | workflow de deploiement lot 8                   | n/a                                           | n/a                                         | reporte lot 8
dataprep-backend  | pull.yml / test                            | ci.yml / Dataprep smoke                         | `make smoke-dataprep`                         | CI push `24483907269` + PR `24483908784`    | vert lot 6
dataprep-backend  | push.yml / build                           | cd.yml / Publish matchid-backend image          | build/publish locaux verts                    | CD `24483907271` build vert, publish rouge  | cred Docker Hub invalide
dataprep-backend  | deploy.yml / deploy                        | workflow de deploiement lot 8                   | n/a                                           | n/a                                         | reporte lot 8
dataprep-frontend | pull.yml / test                            | ci.yml / Dataprep smoke + End-to-end smoke      | `make smoke-dataprep`, `make smoke-e2e`       | CI push `24483907269` + PR `24483908784`    | vert lot 6
dataprep-frontend | push.yml / build                           | cd.yml / Publish matchid-frontend image         | build/publish locaux verts                    | CD `24483907271` build vert, publish rouge  | cred Docker Hub invalide
deces-backend     | dockerimage.yml / build                    | ci.yml / Backend smoke + cd.yml / Publish deces-backend image | `make smoke-backend`, build/publish locaux verts | CI push `24483907269`, CI PR `24483908784`, CD `24483907271` | build prouve, cred Docker Hub invalide
deces-backend     | dockerimage.yml / bulk                     | aucun                                           | n/a                                           | n/a                                         | retire du contrat critique
deces-ui          | pr.yml / test                              | ci.yml / UI smoke + End-to-end smoke            | `make smoke-e2e` vert; `make smoke-ui` instable | CI push `24483907269` vert; CI PR `24483908784` rouge sur `UI smoke` | ecart ouvert
deces-ui          | push.yml / build                           | ci.yml / UI smoke + cd.yml / Publish deces-ui image | build/publish locaux verts                    | CD `24483907271` build vert, publish rouge  | cred Docker Hub invalide + ecart `UI smoke`
deces-ui          | push.yml / deploy                          | workflow de deploiement lot 8                   | n/a                                           | n/a                                         | reporte lot 8
deces-ui          | logs-full.yml / logs                       | aucun                                           | n/a                                           | n/a                                         | retire du contrat critique
deces-ui          | logs-update.yml / logs                     | aucun                                           | n/a                                           | n/a                                         | retire du contrat critique
deces-dataprep    | pr.yml / test                              | ci.yml / Dataprep smoke                         | `make smoke-dataprep`                         | CI push `24483907269` + PR `24483908784`    | vert lot 6
deces-dataprep    | small.yml / build                          | ci.yml / Dataprep smoke                         | `make smoke-dataprep`                         | CI push `24483907269` + PR `24483908784`    | vert lot 6
deces-dataprep    | year/full/push-dev/push-master / build     | cd.yml / Publish dataprep snapshot + lot 8      | produce/publish/restore locaux verts          | CD `24483907271` snapshot vert              | lot 7 prouve pour snapshot, lot 8 ouvert
deces-dataprep    | full.yml / check-previous-failure          | workflow distant lot 8 si conserve              | non prouve                                    | non prouve                                  | reporte lot 8
```

### Reste ouvert

- la preuve GitHub de `publish` des quatre jobs image est maintenant bloquee par des credentials Docker Hub invalides pour l'utilisateur `matchid`
- l'ecart `UI smoke` entre `push` (vert), `pull_request` (rouge) et les reruns locaux (instables) n'est pas encore explique
- les jobs `deces-dataprep` distants `year/full/push-*` n'ont pas encore d'equivalent monorepo prouve cote deploiement, uniquement cote snapshot
- le workflow lot 8 de deploiement `deploy-remote` n'est pas encore reconstruit ni prouve
- le traitement du package de compatibilite `matchID-latest.tar.gz` est seulement branche sur `matchid-backend`, pas encore revalide

## Critères d'acceptation

- les artefacts cibles sont nommés et versionnés de manière explicite
- un workflow racine sait construire et publier les images requises
- chaque job historique listé a un sort explicite: migré, reporté ou retiré
- chaque job migré a une preuve `make` et une preuve GitHub documentées
- le snapshot dataprep peut être produit, publié, puis restauré via des cibles `make`
- la frontière lot 7 / lot 8 est claire: publication ici, déploiement en lot 8

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
