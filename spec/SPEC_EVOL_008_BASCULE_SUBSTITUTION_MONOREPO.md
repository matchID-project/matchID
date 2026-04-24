# SPEC_EVOL_008 - Runbook de bascule et rollback monorepo

## Objet

Definir la sequence operative du lot 9 pour substituer le processus historique
par le monorepo, sans coupler la production du snapshot dataprep et le
deploiement UI prod.

## Contrat cible

Le monorepo devient la seule source de:

- build et publication des images `matchid-backend`, `matchid-frontend`,
  `deces-backend`, `deces-ui`;
- production du snapshot Elasticsearch dataprep;
- deploiement `deploy-remote` de `deces-ui`/`deces-backend`.

Le comportement cible conserve la separation amont:

- `dataprep-small`, `dataprep-year`, `dataprep-full` produisent un snapshot;
- le deploiement applicatif reste un acte distinct;
- le deploiement prod n'est pas declenche par `dataprep-full`.

## Workflow monorepo retenu

`cd.yml` porte desormais deux usages distincts:

```text
Usage                         | Ref cible | Inputs workflow_dispatch                | Effet
-----------------------------+-----------+-----------------------------------------+----------------------------------------------
snapshot dev petit jeu       | dev       | dataprep_scope=small, deploy_target=none | snapshot dev petit jeu
snapshot dev annuel          | dev       | dataprep_scope=year, deploy_target=none  | snapshot dev annuel
snapshot prod full           | master    | dataprep_scope=full, deploy_target=none  | snapshot prod full
deploy dev explicite         | dev       | dataprep_scope=none, deploy_target=dev   | deploy-remote dev
deploy prod explicite        | master    | dataprep_scope=none, deploy_target=prod  | deploy-remote prod
push dev applicatif          | dev       | n/a                                     | publication images + deploy dev
push master avec `deces-ui`  | master    | n/a                                     | publication images + deploy prod
push master hors `deces-ui`  | master    | n/a                                     | publication images/snapshot seulement
```

Garde-fous:

- `push master` ne deploie la prod que si `packages/deces-ui/**` a evolue;
- `dataprep-full` ne deploie pas la prod;
- le deploy prod demande `workflow_dispatch` sur `master` avec
  `deploy_target=prod`;
- le deploy dev manuel demande `workflow_dispatch` sur `dev` avec
  `deploy_target=dev`;
- `dataprep_scope=none` est obligatoire pour un deploy explicite sans run
  dataprep associe.

## Preconditions de bascule

- CI verte sur la branche cible;
- jobs de publication d'images verts sur `master`;
- snapshot prod `dataprep-full` produit et verifie dans le bucket prod;
- preprod monorepo `dev-deces.matchid.io` validee;
- secrets `deploy-remote` disponibles;
- decision prise sur le sort du job lourd `deces-backend` `bulk/artillery`.

## Runbook de bascule

### 1. Gel d'entree

- annoncer la fenetre de bascule;
- interdire tout merge non critique pendant la fenetre;
- identifier le commit `master` candidat;
- noter le dernier commit prod connu comme point de retour.

### 2. Publication des images monorepo

- merger le commit candidat sur `master`;
- attendre le run `cd.yml` sur `push master`;
- verifier:
  - publication `matchid-backend`;
  - publication `matchid-frontend`;
  - publication `deces-backend`;
  - publication `deces-ui`;
- si `packages/deces-ui/**` a evolue dans le merge, verifier que le job
  `deploy` a bien tourne;
- sinon verifier qu'aucun deploy prod n'a ete declenche sur ce `push master`.

### 3. Production du snapshot prod

- declencher `cd.yml` sur `master` avec:
  - `dataprep_scope=full`
  - `deploy_target=none`
- attendre `dataprep-full`;
- verifier l'artefact metadata du run;
- verifier le snapshot attendu dans le bucket
  `fichier-des-personnes-decedees-elasticsearch`.

### 4. Deploiement prod explicite si necessaire

- declencher `cd.yml` sur `master` avec:
  - `dataprep_scope=none`
  - `deploy_target=prod`
- attendre le job `deploy`;
- verifier:
  - `https://deces.matchid.io/deces/api/v1/healthcheck`
  - chargement UI;
  - restauration du snapshot attendu;
  - version/image attendue cote serveur;
  - purge CDN si active.

Cette etape est obligatoire:

- pour un redeploy prod sans nouveau changement `deces-ui`;
- pour un changement `dataprep` seul;
- pour toute reprise manuelle apres incident.

### 5. Validation post-bascule

- executer les checks de sante applicatifs;
- verifier les journaux backend/UI;
- verifier le monitoring si `MONITOR_BUCKET` est disponible;
- confirmer que les anciens repos n'ont pas ete utilises dans le run.

## Runbook de rollback

Le rollback doit reutiliser `deploy-remote`, sans reintroduire les anciens repos
comme source de build ou de deploiement.

### 1. Point de retour

- identifier le dernier commit/tag monorepo connu bon pour la prod;
- verifier que son snapshot
  `esdata_${DATAPREP_VERSION}_${DATA_VERSION}` existe toujours dans le bucket
  prod;
- verifier que les images Docker correspondantes existent toujours.

### 2. Reploi monorepo du ref precedent

Depuis un checkout local du monorepo positionne sur le ref de retour:

```text
make deploy-remote \
  GIT_BRANCH=master \
  REMOTE_DEPLOY_BRANCH=<ref-precedent> \
  NGINX_USER=... NGINX_HOST=... \
  STORAGE_ACCESS_KEY=... STORAGE_SECRET_KEY=... \
  TOOLS_STORAGE_ACCESS_KEY=... TOOLS_STORAGE_SECRET_KEY=... \
  LOG_BUCKET=... LOG_DB_BUCKET=... STATS_BUCKET=... PROOFS_BUCKET=... \
  BACKEND_TOKEN_KEY=... BACKEND_TOKEN_PASSWORD=... \
  SCW_SECRET_TOKEN=... SCW_PROJECT_ID=... SCW_IMAGE_ID=... \
  CDN_TOKEN=... CDN_ZONE_ID=... \
  SMTP_TLS_SELFSIGNED=... SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PWD=... \
  remote_http_proxy=... remote_https_proxy=... remote_no_proxy=localhost \
  GOOGLE_ANALYTICS_ID=... GOOGLE_ADSENSE_ID=... \
  MMDB_TOKEN=... \
  NEW_RELIC_INGEST_KEY=... NEW_RELIC_API_KEY=... NEW_RELIC_ACCOUNT_ID=...
```

Notes:

- `GIT_BRANCH=master` conserve la cible prod;
- `REMOTE_DEPLOY_BRANCH=<ref-precedent>` force le clone distant a reutiliser le
  code precedent;
- le snapshot restaure et les images consommees redeviennent ceux du ref de
  retour.

### 3. Validation rollback

- verifier le healthcheck API;
- verifier l'UI;
- verifier le snapshot restaure;
- verifier l'absence de regression critique dans les journaux.

## Sort des anciens repos

Une fois la bascule validee:

- les anciens repos cessent d'etre sources de build ou deploy;
- ils passent en lecture seule ou archive;
- la documentation d'exploitation pointe uniquement vers le monorepo.

## Dependances

- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
- [SPEC_EVOL_006](SPEC_EVOL_006_ARTEFACTS_CD_MONOREPO.md)
- [SPEC_EVOL_007](SPEC_EVOL_007_PREUVE_PARITE_DATAPREP.md)
- [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md)
