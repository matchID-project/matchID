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

`cd.yml` est déclenché par `repository_dispatch`, `workflow_dispatch` et par
`push` sur `dev` et `master`.

Le dispatch manuel expose `dataprep_scope` et `deploy_target`.
`dataprep_scope` garde `small` par défaut pour éviter un run `full`/prod
implicite. `deploy_target` vaut `none` par défaut. Le deploy explicite passe
par `dataprep_scope=none` avec `deploy_target=dev` ou `deploy_target=prod`.

Pour `repository_dispatch`, les scopes dataprep restent attachés à la branche
portée par `client_payload.ref`: `small`/`year` sur `dev`, `full` sur `master`.
Le deploy applicatif n'est plus couplé à `repository_dispatch`: la prod reste
déclenchée explicitement par `workflow_dispatch`.

```text
Job CD monorepo                  | Rôle
---------------------------------+------------------------------------------------------------
Publish matchid-backend image    | build/push image historique du backend dataprep
Publish matchid-frontend image   | build/push image historique du frontend dataprep
Publish deces-backend image      | build/push image backend applicatif deces
Publish deces-ui image           | build/push image frontend applicatif deces
Publish dataprep small snapshot  | produire, publier et tracer le snapshot Elasticsearch petit jeu dev
Publish dataprep year snapshot   | produire, publier et tracer le snapshot Elasticsearch annuel dev
Publish dataprep full snapshot   | produire, publier et tracer le snapshot Elasticsearch full master
Deploy deces-ui/deces-backend    | deploy-remote explicite dev/prod, séparé des jobs dataprep
```

Scopes dataprep:

```text
Job CD monorepo | Branche push | Upstream aligne          | FILES_TO_PROCESS
----------------+--------------+--------------------------+------------------------------------------------------------
dataprep-small  | dev          | small.yml                | deces-2020-m01.txt.gz
dataprep-year   | dev          | year.yml, push-dev.yml   | deces-2020-m[0-1][0-9].txt.gz
dataprep-full   | master       | full.yml, push-master.yml| deces-((19[7-9][0-9]|20(0[0-9]|1[0-9]|2[0-4]))|202[56]-m(0[1-9]|1[0-2]))\.txt\.gz
```

Déploiement applicatif:

```text
Mode                  | Ref  | Inputs                                | Effet
----------------------+-----+----------------------------------------+--------------------------------------
push dev applicatif   | dev | n/a                                    | publication images + deploy preprod
push master applicatif| master | n/a                                 | publication images seulement
deploy dev explicite  | dev | dataprep_scope=none, deploy_target=dev | deploy-remote preprod
deploy prod explicite | master | dataprep_scope=none, deploy_target=prod | deploy-remote prod
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
deces-dataprep    | dataprep-small/year/full         | à prouver après correction H6
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
deces-dataprep    | pr.yml/small/year/full/push-*                     | ci.yml / deces-dataprep locally; cd.yml / dataprep-small, dataprep-year, dataprep-full; remote lot 8
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
- Le CD dataprep ne masque plus les scopes historiques derrière un unique job
  snapshot: `dataprep-small`, `dataprep-year` et `dataprep-full` restent
  visibles dans le workflow, tout en appelant les cibles Make racine existantes
  `artifact-produce-dataprep-snapshot` et `artifact-publish-dataprep-snapshot`.

## UAT lot 7

Entrée en UAT seulement si:

- les jobs CD de publication restent verts après le réalignement CI;
- les jobs CI de validation passent sur `push` et `pull_request`;
- le tableau de
  [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md) contient les
  run ids GitHub à jour.
