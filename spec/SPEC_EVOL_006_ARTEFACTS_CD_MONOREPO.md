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
- adaptations monorepo de build:
  - configuration explicite de `packages/deces-dataprep` avant build `dataprep-backend` / `dataprep-frontend`
  - propagation des variables `DATA_DIR`, `NPM_AUDIT_DRY_RUN` et `NPM_AUDIT_IGNORE` dans les compose de build concernes
  - correction de typage de test dans [bulk.spec.ts](/home/antoinefa/src/matchID/matchID/packages/deces-backend/src/controllers/bulk.spec.ts) pour laisser compiler `deces-backend` en image sans patch produit
- adaptations monorepo de publication et snapshot:
  - normalisation du tag de branche Docker via `GIT_BRANCH_TAG` pour accepter une branche du type `feat/refacto-make`
  - `vm_max` de [packages/dataprep-backend/Makefile](/home/antoinefa/src/matchID/matchID/packages/dataprep-backend/Makefile) ne demande plus `sudo` si la valeur runtime est deja correcte
  - [packages/deces-dataprep/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-dataprep/Makefile) laisse `REPOSITORY_BUCKET` surchargeable
  - [Makefile](/home/antoinefa/src/matchID/matchID/Makefile) publie desormais le snapshot dataprep via [packages/deces-infra/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-infra/Makefile) sur `deces-elasticsearch`, au lieu du backend legacy `matchid-elasticsearch`
  - [packages/deces-infra/Makefile](/home/antoinefa/src/matchID/matchID/packages/deces-infra/Makefile) porte maintenant `elasticsearch-freeze` et `elasticsearch-repository-backup`

### Vérification `make` exécutée

- `make artifact-versions DATA_VERSION_SOURCE=local DATA_VERSION_INPUT_DIR=packages/dataprep-backend/upload FILES_TO_PROCESS=deces-2020.txt.gz`
  - `matchid-backend: 0.4.0-4fe0da`
  - `matchid-frontend: 0.4.0-267541`
  - `deces-backend: 0.4.0-4245-gb41f37fb`
  - `deces-ui: 0.4.0-4245-gb41f37fb`
  - `snapshot: esdata_8b11c8f9_d2d7ee21`
- `make artifact-build-dataprep-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/matchid-backend:0.4.0-4fe0da`
- `make artifact-publish-dataprep-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-4fe0da`, `feat-refacto-make`
  - digest: `sha256:b09dc452f7cd6e9bf93fa6ce4038cd5f7508e5b1340df6fb953281e62c3cb81f`
- `make artifact-build-dataprep-frontend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/matchid-frontend:0.4.0-267541`
- `make artifact-publish-dataprep-frontend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-267541`, `feat-refacto-make`
  - digest: `sha256:ca8b12d30c6fa000b786ba1981d73507385f3ffdd1697385c3b3f7b40fc78d90`
- `make artifact-build-deces-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/deces-backend:0.4.0-4245-gb41f37fb`
  - adaptation monorepo necessaire: staging explicite de `communes.json`, `disposable-mail.txt` et `wikidata.json` dans un contexte de build temporaire, plus propagation de `NPM_AUDIT_DRY_RUN=true`
- `make artifact-publish-deces-backend GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-4245-gb41f37fb`, `feat-refacto-make`
  - digest: `sha256:6096bd1f99944740908519be8c4b63efd113dfd56d2403e4d4d30c6880d2bac9`
- `make artifact-build-deces-ui GIT_BRANCH=feat/refacto-make`
  - succes
  - image produite: `docker.io/matchid/deces-ui:0.4.0-4245-gb41f37fb`
  - adaptation monorepo necessaire: build dist/Nginx orchestre depuis la racine sans repasser par la cible racine `build`, plus propagation de `NPM_AUDIT_IGNORE`
- `make artifact-publish-deces-ui GIT_BRANCH=feat/refacto-make`
  - succes
  - tags publies: `0.4.0-4245-gb41f37fb`, `feat-refacto-make`
  - digest: `sha256:e78c3af2df15e9dc279d5b18e8f40a4edda3dd3ebce747801d4b568e20ae3dab`

### Reste ouvert

- le workflow `cd.yml` ne reconstruit pas encore la publication du snapshot dataprep
- le traitement du package de compatibilité `matchID-latest.tar.gz` est seulement branché sur `matchid-backend`, pas encore revalidé
- la premiere tentative de publication/restauration du snapshot dataprep etait invalide: elle visait le mauvais bucket et le mauvais noeud Elasticsearch
- la production/publication/restauration effective du snapshot dataprep reste a rejouer completement via `make` sur le chemin corrige `deces-infra`

## Critères d'acceptation

- les artefacts cibles sont nommés et versionnés de manière explicite
- un workflow racine sait construire et publier les images requises
- le snapshot dataprep peut être produit, publié, puis restauré via des cibles `make`
- la frontière lot 7 / lot 8 est claire: publication ici, déploiement en lot 8

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
