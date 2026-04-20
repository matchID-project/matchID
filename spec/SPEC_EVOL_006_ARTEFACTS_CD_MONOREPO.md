# SPEC_EVOL_006 - Artefacts et CD monorepo

## Objet

Définir le contrat de production des artefacts de référence depuis le monorepo:
images `matchid-backend`, `matchid-frontend`, `deces-backend`, `deces-ui`, et
snapshot Elasticsearch produit par `deces-dataprep`.

La CI de validation est cadrée dans
[SPEC_EVOL_004_VALIDATION_DEV_ET_CI](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md).
La matrice exhaustive make/CI/CD est tenue dans
[SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md).

## Artefacts

```text
Artefact                    | Source monorepo                  | Make build                         | Make publish
----------------------------+----------------------------------+------------------------------------+--------------------------------------
matchid-backend             | packages/dataprep-backend        | backend-build                      | backend-docker-push
matchid-frontend            | packages/dataprep-frontend       | build                              | frontend-docker-push
deces-backend               | packages/deces-backend           | backend-build-image                | docker-push-backend
deces-ui                    | packages/deces-ui via racine     | APP=deces-ui build                 | frontend-docker-push
snapshot dataprep ES        | packages/deces-dataprep + infra  | artifact-produce-dataprep-snapshot | artifact-publish-dataprep-snapshot
package legacy matchID      | packages/dataprep-backend        | package                            | package-publish
```

## Workflow CD cible

`cd.yml` est déclenché par `workflow_dispatch` et par `push` sur
`feat/refacto-make`, `dev`, `master`.

```text
Job CD monorepo                  | Rôle
---------------------------------+------------------------------------------------------------
Publish matchid-backend image    | build/push image historique du backend dataprep
Publish matchid-frontend image   | build/push image historique du frontend dataprep
Publish deces-backend image      | build/push image backend applicatif deces
Publish deces-ui image           | build/push image frontend applicatif deces
Publish dataprep snapshot        | produire, publier et tracer le snapshot Elasticsearch
```

## Preuves CD acquises

```text
Workflow | Event    | Run id      | Statut | Couverture
---------+----------+-------------+--------+----------------------------------------------
CD       | push     | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch | 24533977844 | pass   | run debug snapshot + artefacts
```

```text
Composant         | Job CD monorepo                  | Preuve
------------------+----------------------------------+------------------------------------------
dataprep-backend  | Publish matchid-backend image    | CD push 24586029288 pass
dataprep-frontend | Publish matchid-frontend image   | CD push 24586029288 pass
deces-backend     | Publish deces-backend image      | CD push 24586029288 pass
deces-ui          | Publish deces-ui image           | CD push 24586029288 pass
deces-dataprep    | Publish dataprep snapshot        | CD push 24586029288 pass
```

Snapshot de référence non-prod:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
bucket           | fichier-des-personnes-decedees-elasticsearch-dev
files_to_process | deces-2020.txt.gz
run id           | 24586029288
statut           | pass
```

## CI/CD avant/après par composant

```text
Composant         | Avant source                                      | Après monorepo
------------------+---------------------------------------------------+------------------------------------------------------------
tools             | actions.yml / build docker swift                  | ci.yml / build docker swift; publication éventuelle hors lot 7
dataprep-backend  | pull.yml / test; push.yml / build; deploy.yml     | ci.yml / dataprep-backend pull request test; cd.yml / Publish matchid-backend image; deploy lot 8
dataprep-frontend | pull.yml / test; push.yml / build                 | ci.yml / dataprep-frontend pull request test; cd.yml / Publish matchid-frontend image
deces-backend     | dockerimage.yml / build                           | ci.yml / deces-backend build docker image; cd.yml / Publish deces-backend image
deces-ui          | pr.yml / test; push.yml / build; push.yml / deploy| ci.yml / deces-ui pull request test; cd.yml / Publish deces-ui image; deploy lot 8
deces-dataprep    | pr.yml/small/year/full/push-*                     | ci.yml / deces-dataprep locally; cd.yml / Publish dataprep snapshot; remote lot 8
```

## Écarts assumés

- `deces-backend` est construit et publié par les cibles artefact racine; la
  preuve runtime avec données restaurées reste portée par `deces-ui`, comme dans
  les jobs historiques UI.
- `deces-ui` construit l'image `deces-backend` monorepo avant `deploy-local` pour
  éviter de valider contre une image backend déjà publiée par un repo source.
- `dataprep-backend` et `dataprep-frontend` reçoivent les chemins monorepo
  nécessaires en CI, sans cible intermédiaire.
- Les jobs de déploiement distant restent exclus du lot 7 et seront prouvés sur
  `dev-deces.matchid.io` au lot 8.

## UAT lot 7

Entrée en UAT seulement si:

- les jobs CD de publication restent verts après le réalignement CI;
- les jobs CI de validation passent sur `push` et `pull_request`;
- le tableau de
  [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md) contient les
  run ids GitHub à jour.
