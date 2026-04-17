# SPEC EVOL - Checklist make, CI et CD

## Objet

Cette spec est la matrice de parité entre les repos sources et le monorepo. Elle
sert de checklist opérationnelle pour les lots 6, 7 et 8.

Règles:

- toutes les validations passent par `make`;
- pas de validation directe par `npm`, `docker` ou script hors `make`;
- les noms de jobs et cibles restent alignés sur les repos sources;
- les publications d'images et de snapshots sont dans `cd.yml`, pas dans `ci.yml`;
- `deploy-remote`, SCW et `dev-deces.matchid.io` restent lot 8.

## CI - Parité job par job

Statut courant: le premier run GitHub après réalignement a exposé des écarts
d'exécution CI, sans remettre en cause le contrat make. Les corrections sont:
configuration explicite de `tools`, chemins monorepo pour le compose local
dataprep, build UI via l'artefact racine, audit npm frontend dataprep ignoré via
la variable prévue par le Dockerfile, et `ES_MEM=1024m` pour tenir sur runner
GitHub.

```text
Repo source       | Make source                                               | Make monorepo                                             | Job CI source                  | Job CI monorepo                         | Statut
------------------+-----------------------------------------------------------+-----------------------------------------------------------+--------------------------------+-----------------------------------------+----------------------------
tools             | docker-check CLOUD_CLI=swift || docker-build CLOUD_CLI=swift | make -C packages/tools config; make -C packages/tools docker-check CLOUD_CLI=swift || make -C packages/tools docker-build CLOUD_CLI=swift | actions.yml / build docker swift | ci.yml / build docker swift             | à prouver prochain CI
dataprep-backend  | version backend-docker-check || backend-build backend backend-stop | make -C packages/deces-dataprep config; make -C packages/dataprep-backend version backend-docker-check || make -C packages/dataprep-backend backend-build backend backend-stop | pull.yml / pull request test  | ci.yml / dataprep-backend pull request test | à prouver prochain CI
dataprep-frontend | version-files; version; frontend-docker-check || build backend-docker-check up | make -C packages/deces-dataprep config frontend-config; make -C packages/dataprep-frontend version-files; make -C packages/dataprep-frontend version; make -C packages/dataprep-frontend frontend-docker-check || make -C packages/dataprep-frontend build backend-docker-check up | pull.yml / pull request test | ci.yml / dataprep-frontend pull request test | à prouver prochain CI
deces-backend     | backend-build-image                                       | make artifact-build-deces-backend                         | dockerimage.yml / build       | ci.yml / deces-backend build docker image | à prouver prochain CI
deces-ui          | version config; docker-check || build; deploy-local backend-test frontend-test | make version config; make frontend-docker-check || make artifact-build-deces-ui; make artifact-build-deces-backend; make deploy-local backend-test frontend-test | pr.yml / Pull request test | ci.yml / deces-ui pull request test     | à prouver prochain CI
deces-dataprep    | all FILES_TO_PROCESS=deces-2020-m01.txt.gz ... ES_MEM=4000m | make -C packages/deces-dataprep all FILES_TO_PROCESS=deces-2020-m01.txt.gz ... ES_MEM=1024m | pr.yml / locally              | ci.yml / deces-dataprep locally         | à prouver prochain CI
```

Notes de parité:

- `deces-backend` est validé en CI par le build de l'image; l'exécution runtime
  backend + index + frontend reste couverte par le job `deces-ui pull request
  test`, comme dans le flux historique UI.
- `deces-ui` source appelait `docker-check`; dans le monorepo, l'image frontend
  est vérifiée par `frontend-docker-check` et construite par
  `artifact-build-deces-ui`, pour éviter les collisions de variables introduites
  par les `Makefile` inclus à la racine.
- `dataprep-backend` et `dataprep-frontend` gardent leurs commandes historiques;
  la CI fixe seulement `TOOLS_PATH`, `BACKEND` et les variables de projet
  dataprep pour pointer vers les packages frères du monorepo au lieu de cloner
  des repos.
- `dataprep-frontend` utilise `NPM_AUDIT_IGNORE=true` en CI pour neutraliser la
  vulnérabilité low severity déjà connue dans l'image historique, sans appel npm
  direct hors make.
- `deces-dataprep` garde le rôle du job PR `locally`; seul `ES_MEM` est adapté à
  la capacité du runner GitHub, pas à la logique d'indexation.
- `tools` ne publie pas l'image dans `ci.yml`; la publication éventuelle d'image
  est un sujet CD/lot 8.

## CD - Artefacts publiés

Dernière preuve verte avant réalignement CI:

```text
Workflow | Event | Run id      | Statut | Commentaire
---------+-------+-------------+--------+-------------------------------
CD       | push  | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch | 24533977844 | pass | run debug snapshot + artefacts
```

```text
Repo source       | Make source                          | Make monorepo                         | Job CD source             | Job CD monorepo                    | Preuve
------------------+--------------------------------------+---------------------------------------+---------------------------+------------------------------------+-----------------------------------------
dataprep-backend  | backend-build                        | artifact-build-dataprep-backend       | push.yml / build          | cd.yml / Publish matchid-backend image | CD push 24586029288 pass
dataprep-backend  | backend-docker-push                  | artifact-publish-dataprep-backend     | push.yml / build          | cd.yml / Publish matchid-backend image | CD push 24586029288 pass
dataprep-frontend | build                                | artifact-build-dataprep-frontend      | push.yml / build          | cd.yml / Publish matchid-frontend image | CD push 24586029288 pass
dataprep-frontend | frontend-docker-push                 | artifact-publish-dataprep-frontend    | push.yml / build          | cd.yml / Publish matchid-frontend image | CD push 24586029288 pass
deces-backend     | backend-build-image                  | artifact-build-deces-backend          | dockerimage.yml / build   | cd.yml / Publish deces-backend image | CD push 24586029288 pass
deces-backend     | docker-push-backend                  | artifact-publish-deces-backend        | dockerimage.yml / build   | cd.yml / Publish deces-backend image | CD push 24586029288 pass
deces-ui          | frontend-build; nginx-build          | artifact-build-deces-ui               | push.yml / build          | cd.yml / Publish deces-ui image    | CD push 24586029288 pass
deces-ui          | frontend-docker-push                 | artifact-publish-deces-ui             | push.yml / build          | cd.yml / Publish deces-ui image    | CD push 24586029288 pass
deces-dataprep    | full-check; recipe-run               | artifact-produce-dataprep-snapshot    | year/full/push* / build   | cd.yml / Publish dataprep snapshot | CD push 24586029288 pass
deces-infra       | elasticsearch-repository-backup      | artifact-publish-dataprep-snapshot    | year/full/push* / build   | cd.yml / Publish dataprep snapshot | CD push 24586029288 pass
deces-infra       | elasticsearch-restore                | artifact-restore-dataprep-snapshot    | aucun                     | restore local                      | preuve locale lot 5
```

Snapshot prouvé:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
run id           | 24586029288
bucket non-prod  | fichier-des-personnes-decedees-elasticsearch-dev
files_to_process | deces-2020.txt.gz
job              | Publish dataprep snapshot
statut           | pass
```

## Make runtime et dev

```text
Repo source       | Make source                 | Make monorepo                  | Usage cible                 | Statut
------------------+-----------------------------+--------------------------------+-----------------------------+----------------
root monorepo     | n/a                         | dev                            | dev local complet           | pass lot 5
root monorepo     | n/a                         | dev-stop                       | arrêt dev local             | pass indirect
root monorepo     | n/a                         | docker-check                   | compat deploy-local         | restauré
deces-ui          | frontend-test               | frontend-test                  | tests UI via make           | pass lot 5
deces-ui          | deploy-local                | deploy-local                   | CI PR + lot 8 local/preprod | à reprouver CI
deces-backend     | backend-test-vitest         | backend-test-vitest            | tests backend via make      | à reprouver CI
deces-dataprep    | recipe-run; watch-run       | dataprep-run                   | indexation via backend monorepo | pass lot 5
deces-dataprep    | all                         | packages/deces-dataprep all    | CI PR petit dataset         | à reprouver CI
deces-infra       | elasticsearch-restore       | elasticsearch-restore          | données dev depuis snapshot | pass lot 5
```

## Lot 8 - À prouver

```text
Repo source       | Make source                 | Make monorepo                  | Job source          | Job cible            | Statut
------------------+-----------------------------+--------------------------------+---------------------+----------------------+-------------
tools             | remote-config-test           | packages/tools remote-config-test | actions.yml / remote | déploiement preprod | lot 8
deces-ui          | deploy-remote                | deploy-remote                  | push.yml / deploy   | déploiement preprod  | lot 8
deces-ui/tools    | deploy-remote-instance       | deploy-remote-instance         | push.yml / deploy   | déploiement preprod  | lot 8
deces-ui/tools    | deploy-remote-services       | deploy-remote-services         | push.yml / deploy   | déploiement preprod  | lot 8
deces-ui/tools    | deploy-remote-publish        | deploy-remote-publish          | push.yml / deploy   | déploiement preprod  | lot 8
deces-ui/tools    | deploy-delete-old            | deploy-delete-old              | push.yml / deploy   | déploiement preprod  | lot 8
deces-dataprep    | remote-all                   | cible racine à définir         | full/push* / build  | dataprep distant     | lot 8
```
