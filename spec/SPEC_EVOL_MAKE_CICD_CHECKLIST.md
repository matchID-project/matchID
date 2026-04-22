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

## Passe de revalidation arbitree du 2026-04-21

Cette section trace les ecarts issus de la revue H/M/P et leur decision. Aucun
point ne doit etre corrige implicitement hors decision ci-dessous.

```text
ID    | Sujet                         | Constat                                    | Decision / etat
------+-------------------------------+--------------------------------------------+------------------------------
M1    | trigger CI feat/refacto-make   | absent du contrat upstream cible           | supprimer de `ci.yml`
H4    | dataprep-backend tests         | upstream lance `backend tests backend-stop`| restaurer `tests`
H5    | deces-backend CI               | build image seul insuffisant               | restaurer `deploy-dependencies`
      |                               |                                            | puis `backend-test-vitest`
H6    | CD dataprep                    | upstream separe small/year/full/push-*     | reconstruire small/year/full
M3    | NPM_AUDIT_IGNORE               | ecart temporaire de build UI/front dataprep| garder temporaire, revalider
M4    | regex 2026 `[0-9]`             | decision deja acceptee                     | conserver et loguer
M5    | contact@matchid.io             | decision fonctionnelle acceptee            | conserver
P2    | OTP 6h + rate limit            | commits backend deja repris au lot 2       | rien a corriger, loguer
P5    | birthDate                      | pas de `birtDate` residuel trouve          | rien a corriger, surveiller
P6    | webhook content-type           | compat TypeScript/Axios acceptee           | conserver
H1/H2 | noms artefacts UI              | herite du split Makefile monorepo          | focus ci-dessous
H3    | `user: ${UID}:${GID}`          | deja present dans `origin/dev`             | conserver
H7    | `DATA_DIR` image backend       | surcharge build/runtime ambigue            | a trancher avant code
```

Focus H1/H2:

```text
Point                  | Constat
-----------------------+------------------------------------------------------------
origine                | `packages/deces-ui/Makefile` n'existe pas dans `origin/dev`
premiere apparition    | branche de split monorepo `feat/makefile-split`
contrat courant        | CI/CD appellent `make APP=deces-ui build`
risque                 | un `make build` racine sans `APP=deces-ui` peut produire des
                       | noms d'artefacts incoherents avec l'UI
decision courante      | ne pas changer le code avant arbitrage; documenter que le
                       | contrat prouve est `make APP=deces-ui build`
```

Focus H3:

```text
Point                  | Constat
-----------------------+------------------------------------------------------------
source                 | `origin/dev:packages/deces-ui/docker-compose-build.yml`
preuve                 | `user: ${UID}:${GID}` deja present upstream dev
decision               | conserver, car cela evite des fichiers root-owned en build
```

Focus H7:

```text
Point                  | Constat
-----------------------+------------------------------------------------------------
upstream historique    | `COPY ${DATA_DIR}/communes.json`, `disposable-mail.txt`,
                       | `wikidata.json` dans l'image `deces-backend`
monorepo courant       | `COPY ${DATA_DIR} ./data`
CI/CD corrige          | force `DATA_DIR=data` seulement pour le build image Docker
risque                 | `DATA_DIR` designe a la fois le repertoire runtime canonique
                       | racine et le repertoire de contexte build image
decision appliquee     | revenir au repertoire package-local upstream `data`, deja
                       | ignore, sans introduire `build-data`; conserver le
                       | `DATA_DIR` runtime absolu par defaut pour les tests Compose
```

Focus H5:

```text
Point                  | Constat
-----------------------+------------------------------------------------------------
upstream historique    | `backend-build-all`, puis `deploy-dependencies`, puis
                       | `backend-test-vitest`
monorepo avant fix     | `backend-build-image`, puis `backend-test-vitest`
preuve d'ecart         | CI 24756045556: image OK, Redis/SMTP OK, echec vitest apres
                       | `tsoa`; la phase source qui restaure l'index manquait
decision appliquee     | restaurer la cible historique `deploy-dependencies` dans
                       | `packages/deces-backend` en deleguant l'Elasticsearch a
                       | `packages/deces-infra`, puis l'appeler avant Vitest en CI
```

Garde-fou CD H6:

- `workflow_dispatch` ne lance que `dataprep-small` par defaut; `year`, `full`
  ou `all` demandent un choix explicite;
- `repository_dispatch` ne lance `dataprep-small` et `dataprep-year` que si
  `client_payload.ref == 'dev'`;
- `repository_dispatch` ne lance `dataprep-full` que si
  `client_payload.ref == 'master'`.

## UAT lot 7 - Presentation

Cette section trace les preuves presentees pour fermer le lot 7 dans `PLAN.md`
et ouvrir le lot 8.

Preuves retenues:

```text
Preuve       | Run / origine      | Event | SHA     | Couverture                         | Statut
-------------+--------------------+-------+---------+------------------------------------+--------
CI monorepo  | GitHub 24616234550 | PR    | 9d2b0b6 | path filter + 6 jobs CI            | pass
CD artefacts | GitHub 24586029288 | push  | 24aad95 | 4 images + snapshot dataprep       | pass
PR actuelle  | GitHub 24633751030 | PR    | 2c09453 | 6 jobs CI apres debut lot 8        | pass
Restore dev  | UAT utilisateur    | make  | n/a     | make clean elasticsearch-restore   | valide
             |                    |       |         | dev                                |
```

Picture cible lots 6/7/8:

```text
Composant         | Lot  | Upstream                         | Monorepo                         | Preuve / statut
------------------+------+----------------------------------+----------------------------------+------------------
tools             | 6    | actions.yml / swift             | ci.yml / build docker swift      | CI 24616234550
                  |      |                                  |                                  | job 71978790565
tools             | 8    | actions.yml / remote            | remote-config-test               | a prouver lot 8
------------------+------+----------------------------------+----------------------------------+------------------
dataprep-backend  | 6    | pull.yml / pull request test    | ci.yml / dataprep-backend        | CI 24616234550
                  |      |                                  | pull request test                | job 71978790566
dataprep-backend  | 7    | push.yml / build image          | cd.yml / Publish matchid-        | CD 24586029288
                  |      |                                  | backend image                    | job 71895732114
dataprep-backend  | 8    | deploy.yml / deploy             | deploy-remote preprod            | a prouver lot 8
------------------+------+----------------------------------+----------------------------------+------------------
dataprep-frontend | 6    | pull.yml / pull request test    | ci.yml / dataprep-frontend       | CI 24616234550
                  |      |                                  | pull request test                | job 71978790569
dataprep-frontend | 7    | push.yml / build image          | cd.yml / Publish matchid-        | CD 24586029288
                  |      |                                  | frontend image                   | job 71895732047
------------------+------+----------------------------------+----------------------------------+------------------
deces-backend     | 6    | dockerimage.yml / build image   | ci.yml / deces-backend build     | a prouver apres
                  |      | + backend-test-vitest           | docker image and tests           | correction H5
deces-backend     | 6    | dockerimage.yml / runtime tests | ci.yml / deces-ui pull request   | CI 24616234550
                  |      | avec index restaure             | test                             | job 71978790570
deces-backend     | 7    | dockerimage.yml / publish image | cd.yml / Publish deces-backend   | CD 24586029288
                  |      |                                  | image                            | job 71895732033
deces-backend     | 9    | dockerimage.yml / bulk perf     | a statuer/reconstruire           | reste avant lot 9
------------------+------+----------------------------------+----------------------------------+------------------
deces-ui          | 6    | pr.yml / Pull request test      | ci.yml / deces-ui pull request   | CI 24616234550
                  |      |                                  | test                             | job 71978790570
deces-ui          | 7    | push.yml / build image          | cd.yml / Publish deces-ui image  | CD 24586029288
                  |      |                                  |                                  | job 71895732121
deces-ui          | 8    | push.yml / deploy               | deploy-remote preprod            | a prouver lot 8
deces-ui          | 8    | logs-full.yml / logs-update.yml | stats / observabilite            | a cadrer lot 8
------------------+------+----------------------------------+----------------------------------+------------------
deces-dataprep    | 6    | pr.yml / locally                | ci.yml / deces-dataprep locally  | CI 24616234550
                  |      |                                  |                                  | job 71978790560
deces-dataprep    | 7    | small/year/full/push* datasets  | cd.yml / dataprep-small,         | a prouver apres
                  |      | remote build                    | dataprep-year, dataprep-full     | correction H6
deces-dataprep    | 8    | remote large datasets           | remote dataprep cible            | a prouver lot 8
------------------+------+----------------------------------+----------------------------------+------------------
deces-infra       | 7    | infra dispersee                 | snapshot publish/restore         | CD + UAT restore
deces-infra       | 8    | deploy-remote infra             | preprod dev-deces.matchid.io     | a prouver lot 8
```

Artefacts publies par le run CD retenu:

```text
Artefact          | Tag / version publiee       | Make monorepo                    | Preuve
------------------+-----------------------------+----------------------------------+------------------
matchid-backend   | 24aad95-e4d91b              | packages/dataprep-backend       | CD 24586029288
                  | digest sha256:ef5acdc5...   | backend-build / backend-        | job 71895732114
                  |                             | docker-push                      |
matchid-frontend  | 24aad95-2d96b8              | packages/dataprep-frontend      | CD 24586029288
                  | digest sha256:93e7ae0c...   | build / frontend-docker-push    | job 71895732047
deces-backend     | 24aad95                     | packages/deces-backend          | CD 24586029288
                  | digest sha256:cef2e810...   | backend-build-image /           | job 71895732033
                  |                             | docker-push-backend             |
deces-ui          | 24aad95                     | APP=deces-ui build /            | CD 24586029288
                  | digest sha256:800e61c6...   | frontend-docker-push            | job 71895732121
dataprep snapshot | esdata_6df42346_d2d7ee21    | artifact-produce-dataprep-      | CD 24586029288
                  | count 679573                | snapshot                         | job 71895732072
                  |                             | artifact-publish-dataprep-      | UAT restore
                  |                             | snapshot                         | valide
```

Decision UAT lot 7:

```text
Gate PLAN.md       | Ce qui est presente                         | Etat
-------------------+---------------------------------------------+-----------------------
picture 6/7/8      | table lots 6/7/8 source -> monorepo          | valide
matrice jobs       | table job source -> job cible -> preuve      | valide
artefacts          | table artefacts publies + snapshot restore  | valide
restore dev        | make clean elasticsearch-restore dev        | valide
```

## CI - Parité job par job

Preuve CI retenue: le run PR GitHub `24616234550` prouve le pipeline CI
monorepo vert sur `9d2b0b6`. Le run `24606521819` avait deja prouvé le retour
au vert de `deces-ui pull request test`, incluant `Appariement Wikidata`; le run
`24616234550` confirme cette preuve apres documentation de la correction. Le run
PR `24633751030` prouve que le meme pipeline reste vert sur le HEAD courant
`2c09453b` apres les premiers commits du lot 8.

Preuve spécifique `Appariement Wikidata`:

```text
Reference | Run id      | Job id      | SHA      | Statut
----------+-------------+-------------+----------+-------------------------------
upstream  | 21919067766 | 63294061207 | 08e33bb  | pass, "Costes" trouve
monorepo  | 24616234550 | 71978790570 | 9d2b0b6  | pass, "Costes" trouve
```

Corrections de parité associées:

```text
Commit   | Portee        | Correction
---------+---------------+------------------------------------------------
1c8235e  | ci.yml        | dataset UI aligne sur `deces-2020-m01.txt.gz`
3269a52  | deces-backend | mounts `JOBS`/`PROOFS` remis sur `/${APP}/data`
```

```text
Repo source       | Type | Source                       | Monorepo                             | Statut
------------------+------+------------------------------+--------------------------------------+------------------
tools             | make | docker-check CLOUD_CLI=swift | make -C packages/tools config       | job vert GH
                  |      | || docker-build CLOUD_CLI=   | make -C packages/tools docker-check | 24616234550
                  |      | swift                        |   CLOUD_CLI=swift                   |
                  |      |                              | || make -C packages/tools           |
                  |      |                              |   docker-build CLOUD_CLI=swift      |
                  | ci   | actions.yml / build docker   | ci.yml / build docker swift         | job vert GH
                  |      | swift                        |                                      | 24616234550
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-backend  | make | version backend-docker-check | make -C packages/deces-dataprep     | a prouver apres
                  |      | || backend-build backend     |   config                            | 24616234550
                  |      | backend-stop                 | make -C packages/dataprep-backend   |
                  |      |                              |   version backend-docker-check      |
                  |      |                              | || make -C packages/dataprep-       |
                  |      |                              |   backend backend-build backend     |
                  |      |                              |   tests backend-stop                |
                  | ci   | pull.yml / pull request test | ci.yml / dataprep-backend           | job vert GH
                  |      |                              |   pull request test                 | 24616234550
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-frontend | make | version-files; version       | make -C packages/deces-dataprep     | job vert GH
                  |      | frontend-docker-check        |   config frontend-config            | 24616234550
                  |      | || build backend-docker-     | make -C packages/dataprep-frontend  |
                  |      | check up                     |   version-files                     |
                  |      |                              | make -C packages/dataprep-frontend  |
                  |      |                              |   version                           |
                  |      |                              | make -C packages/dataprep-frontend  |
                  |      |                              |   frontend-docker-check             |
                  |      |                              | || make -C packages/dataprep-       |
                  |      |                              |   frontend build backend-docker-    |
                  |      |                              |   check up                          |
                  | ci   | pull.yml / pull request test | ci.yml / dataprep-frontend          | job vert GH
                  |      |                              |   pull request test                 | 24616234550
------------------+------+------------------------------+--------------------------------------+------------------
deces-backend     | make | backend-build-image          | make -C packages/deces-backend      | a prouver apres
                  |      |                              |   DATA_DIR=data backend-            |
                  |      |                              |   build-image                       |
                  | make | deploy-dependencies          | make -C packages/deces-backend      | correction H5
                  |      |                              |   deploy-dependencies               |
                  | make | backend-test-vitest          | make -C packages/deces-backend      | correction H5
                  |      |                              |   backend-test-vitest               |
                  | ci   | dockerimage.yml / build      | ci.yml / deces-backend build        | a prouver apres
                  |      | + vitest                     | docker image and tests              | correction H5
------------------+------+------------------------------+--------------------------------------+------------------
deces-ui          | make | version config               | make version config                 | job vert GH
                  |      | docker-check || build        | make frontend-docker-check          | 24616234550
                  |      | deploy-local backend-test    | || make APP=deces-ui build          | Appariement
                  |      | frontend-test                | make -C packages/deces-backend      | Wikidata inclus
                  |      |                              |   DATA_DIR=data backend-            |
                  |      |                              |   build-image                       |
                  |      |                              | make deploy-local backend-test      |
                  |      |                              |   frontend-test                     |
                  | ci   | pr.yml / Pull request test   | ci.yml / deces-ui pull request test | job vert GH
                  |      |                              |                                      | 24616234550
------------------+------+------------------------------+--------------------------------------+------------------
deces-dataprep    | make | all FILES_TO_PROCESS=deces- | make -C packages/deces-dataprep all | job vert GH
                  |      | 2020-m01.txt.gz ES_MEM=     |   FILES_TO_PROCESS=deces-2020-      | 24616234550
                  |      | 4000m                        |   m01.txt.gz ES_MEM=1024m           |
                  | ci   | pr.yml / locally             | ci.yml / deces-dataprep locally     | job vert GH
                  |      |                              |                                      | 24616234550
```

Notes de parité:

- `deces-backend` est validé en CI par le build de l'image puis par la cible
  Make historique `deploy-dependencies`, puis par `backend-test-vitest`; le
  runtime backend + index + frontend reste aussi couvert par le job
  `deces-ui pull request test`, comme dans le flux historique UI.
- `deploy-dependencies` est restauré côté `packages/deces-backend` comme cible
  historique; l'implémentation monorepo délègue la restauration Elasticsearch et
  le readiness check à `packages/deces-infra`.
- Le job lourd upstream `bulk` / artillery (`backend-perf-clinic`,
  `test-perf-v1`) reste volontairement hors CI courte et doit être statué avant
  le lot 9.
- `deces-ui` source appelait `docker-check`; dans le monorepo, l'image frontend
  est vérifiée par `frontend-docker-check` et construite par `APP=deces-ui
  build`, sans cible Make ad hoc.
- `dataprep-backend` et `dataprep-frontend` gardent leurs commandes historiques;
  la CI fixe seulement `TOOLS_PATH`, `BACKEND` et les variables de projet
  dataprep pour pointer vers les packages frères du monorepo au lieu de cloner
  des repos.
- `dataprep-frontend` utilise temporairement `NPM_AUDIT_IGNORE=true` en CI pour
  neutraliser la vulnérabilité low severity déjà connue dans l'image historique,
  sans appel npm direct hors make; cette exemption doit disparaître à
  l'alignement sécurité.
- `deces-dataprep` garde le rôle du job PR `locally`; seul `ES_MEM` est adapté à
  la capacité du runner GitHub, pas à la logique d'indexation.
- `tools` ne publie pas l'image dans `ci.yml`; la publication éventuelle d'image
  est un sujet CD/lot 8.

## CD - Artefacts publiés

Déclenchement cible: `cd.yml` publie automatiquement uniquement sur `push` vers
`dev`. Les runs listés ci-dessous prouvent l'exécution technique des jobs CD
déjà reconstruits; ils ne changent pas la règle de déclenchement cible.

```text
Workflow | Event    | Run id      | Statut | Commentaire
---------+----------+-------------+--------+------------------------------
CD       | push     | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch | 24533977844 | pass   | debug snapshot + artefacts
CD       | n/a      | n/a         | a prouver | H6 separe dataprep-small/year/full
```

```text
Repo source       | Type | Source                       | Monorepo                             | Preuve
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-backend  | make | backend-build                | make -C packages/dataprep-backend   | CD vert GH
                  |      |                              |   backend-build                     | 24586029288
                  | make | backend-docker-push          | make -C packages/dataprep-backend   | image publiee
                  |      |                              |   backend-docker-push               |
                  | cd   | push.yml / build             | cd.yml / Publish matchid-backend    | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-frontend | make | build                        | make -C packages/dataprep-frontend  | CD vert GH
                  |      |                              |   build                             | 24586029288
                  | make | frontend-docker-push         | make -C packages/dataprep-frontend  | image publiee
                  |      |                              |   frontend-docker-push              |
                  | cd   | push.yml / build             | cd.yml / Publish matchid-frontend   | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
deces-backend     | make | backend-build-image          | make -C packages/deces-backend      | CD vert GH
                  |      |                              |   DATA_DIR=data backend-            | correction H7
                  |      |                              |   build-image                       |
                  | make | docker-push-backend          | make -C packages/deces-backend      | image publiee
                  |      |                              |   docker-push-backend               |
                  | cd   | dockerimage.yml / build      | cd.yml / Publish deces-backend      | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
deces-ui          | make | frontend-build; nginx-build  | make APP=deces-ui build            | CD vert GH
                  | make | frontend-docker-push         | make frontend-docker-push          | 24586029288
                  | cd   | push.yml / build             | cd.yml / Publish deces-ui image     | image publiee
------------------+------+------------------------------+--------------------------------------+------------------
deces-dataprep    | make | small.yml / all petit jeu    | artifact-produce-dataprep-snapshot  | a prouver apres
                  |      |                              | FILES_TO_PROCESS=deces-2020-m01     | correction H6
                  | cd   | small.yml / build            | cd.yml / dataprep-small             | snapshot publie
deces-dataprep    | make | year.yml, push-dev.yml       | artifact-produce-dataprep-snapshot  | a prouver apres
                  |      | / full-check + remote-all    | FILES_TO_PROCESS=deces-2020-m*      | correction H6
                  | cd   | year.yml / build             | cd.yml / dataprep-year              | snapshot publie
deces-dataprep    | make | full.yml, push-master.yml    | artifact-produce-dataprep-snapshot  | a prouver apres
                  |      | / full-check + remote-all    | FILES_TO_PROCESS=full regex         | correction H6
                  | cd   | full.yml / build             | cd.yml / dataprep-full              | snapshot publie
------------------+------+------------------------------+--------------------------------------+------------------
deces-infra       | make | elasticsearch-repository-    | artifact-publish-dataprep-snapshot  | CD vert GH
                  |      | backup                       |                                      | 24586029288
                  | make | elasticsearch-restore        | artifact-restore-dataprep-snapshot  | pass lot 5
                  | cd   | small/year/full / build      | cd.yml / dataprep-small/year/full   | a prouver apres H6
                  | cd   | aucun                        | restore local                       | preuve locale
```

Snapshot prouvé:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
run id           | 24586029288
bucket non-prod  | fichier-des-personnes-decedees-elasticsearch-dev
files_to_process | deces-2020.txt.gz
snapshot_name    | esdata_6df42346_d2d7ee21
count            | 679573
artifact id      | 6504778931
job              | Publish dataprep snapshot
statut           | pass
```

Correction H6 à prouver:

```text
Job monorepo   | Branche push | Scope upstream       | Files / bucket
---------------+--------------+----------------------+---------------------------------------
dataprep-small | dev          | small.yml            | deces-2020-m01.txt.gz / bucket dev
dataprep-year  | dev          | year.yml, push-dev   | deces-2020-m[0-1][0-9].txt.gz / bucket dev
dataprep-full  | master       | full.yml, push-master| regex full 1970-2024 + 2025/2026 monthly / bucket prod
```

Preuve UAT lot 7:

```text
Commande utilisateur                 | Statut | Portee
-------------------------------------+--------+-------------------------------
make clean elasticsearch-restore dev | valide | restore snapshot + dev local
```

## Make runtime et dev

```text
Repo source       | Make source             | Make monorepo              | Usage cible        | Statut
------------------+-------------------------+----------------------------+--------------------+--------------
root monorepo     | n/a                     | dev                        | dev local complet  | pass lot 5
root monorepo     | n/a                     | dev-stop                   | arret dev local    | pass indirect
root monorepo     | n/a                     | docker-check               | deploy-local       | restaure
deces-ui          | frontend-test           | frontend-test              | tests UI via make  | pass lot 5
deces-ui          | deploy-local            | deploy-local               | CI PR + preprod    | pass GH
                  |                         |                            |                    | 24616234550
deces-backend     | backend-test            | backend-test               | tests backend CI   | pass via
                  |                         |                            |                    | deces-ui CI
                  |                         |                            |                    | 24616234550
deces-dataprep    | recipe-run; watch-run   | dataprep-run               | indexation via     | pass lot 5
                  |                         |                            | backend monorepo   |
deces-dataprep    | all                     | packages/deces-dataprep    | CI PR petit        | job vert GH
                  |                         | all                        | dataset            | 24616234550
deces-infra       | elasticsearch-restore   | elasticsearch-restore      | donnees dev depuis | pass lot 5
                  |                         |                            | snapshot           |
```

## Lot 8 - À prouver

Preuve manuelle preprod du 2026-04-21:

```text
Etape             | Commande / preuve make                    | Resultat
------------------+--------------------------------------------+-------------------------------
Commit deploye    | git describe / git rev-parse               | 0.4.0-4339-g039223f5
Images            | make backend-build-image/docker-push       | deces-backend publie:
                  | make build/frontend-docker-push            | sha256:ff8db4a9443...
                  |                                            | deces-ui publie:
                  |                                            | sha256:07d9d565b2...
Remote instance   | make deploy-remote                         | instance SCW:
                  |                                            | bbc27157-6c9c-428b-
                  |                                            | 9a00-90a41ec13363
                  |                                            | 51.158.99.108
Remote restore    | make deploy-remote                         | snapshot restaure:
                  |                                            | esdata_fa194c98_e0735a1a
Elasticsearch     | make -C packages/tools remote-cmd          | cluster green;
                  |                                            | index deces: 679573 docs
Remote services   | make deploy-remote                         | backend demarre;
                  |                                            | all components started
Remote API VPC    | make deploy-remote                         | localhost:8083 search ok
Publish preprod   | make -C packages/tools nginx-conf-apply    | upstream nginx:
                  |                                            | 51.158.99.108:8083
Public API        | make -C packages/tools remote-test-api     | api public dev-deces ok
CDN               | make deploy-cdn-purge-cache                | cache purged
Cleanup           | make deploy-delete-old                     | no invalid server to delete
Public UI         | curl https://dev-deces.matchid.io/         | GET 200 text/html
Public health     | curl /deces/api/v1/healthcheck             | GET 200 application/json
Public search     | curl POST /deces/api/v1/search             | POST 200 application/json
Monitoring        | make deploy-monitor                        | cible executee sans erreur
```

Limite de preuve:

- `make deploy-remote` a provisionne l'instance, restaure le snapshot et demarre
  les services; l'etape `deploy-remote-publish` a ensuite bloque localement sur
  l'authentification SSH du serveur nginx (`Too many authentication failures`),
  sans echec applicatif ni echec HTTPS;
- les sous-cibles officielles restantes (`deploy-remote-publish`,
  `deploy-cdn-purge-cache`, `deploy-delete-old`, `deploy-monitor`) ont ete
  executees ensuite avec l'utilisateur et la cle nginx corrects, puis ont publie
  `dev-deces.matchid.io`;
- il reste a obtenir un run GitHub CD ou un run local strictement equivalent qui
  sorte en `0` de bout en bout sur instance fraiche avant de cocher la ligne
  `Executer le flux deploy-remote de bout en bout`.

```text
Repo source       | Make source              | Make monorepo             | Job source        | Statut
------------------+--------------------------+---------------------------+-------------------+-------------
tools             | remote-config-test       | packages/tools remote-    | actions.yml /     | cible remote
                  |                          | config-test + REMOTE_*    | remote            | parametree
deces-ui          | deploy-remote            | cd.yml / deploy           | push.yml / deploy | job cree;
                  |                          | -> preflight +            |                   | preflight local OK,
                  |                          | deploy-remote             |                   | preuve manuelle
                  |                          |                           |                   | publiee; single-run
                  |                          |                           |                   | GH a venir
deces-ui/tools    | deploy-remote-instance   | deploy-remote-instance    | push.yml / deploy | route monorepo
                  |                          | REMOTE_TOOLS_*/APP_*      |                   | instance 51.158.99.108
deces-ui/tools    | deploy-remote-services   | deploy-remote-services    | push.yml / deploy | route monorepo
                  |                          | REMOTE_TOOLS_*/APP_*      |                   | services ok apres
                  |                          |                           |                   | readiness nginx
deces-ui/tools    | deploy-remote-publish    | deploy-remote-publish     | push.yml / deploy | public API ok
deces-ui/tools    | deploy-delete-old        | deploy-delete-old         | push.yml / deploy | no invalid server
deces-dataprep    | remote-all               | cible racine a definir    | full/push* /      | lot 8
                  |                          |                           | build             |
```
