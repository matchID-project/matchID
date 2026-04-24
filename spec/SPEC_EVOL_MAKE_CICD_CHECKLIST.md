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
CI/CD corrige          | force `DATA_DIR=data` seulement pour le build image Docker,
                       | puis `DATA_DIR=${GITHUB_WORKSPACE}/packages/deces-backend/data`
                       | pour le runtime Vitest Compose
risque                 | `DATA_DIR` designe a la fois le repertoire runtime canonique
                       | racine et le repertoire de contexte build image
decision appliquee     | revenir au repertoire package-local upstream `data`, deja
                       | ignore, sans introduire `build-data`; monter ce meme
                       | repertoire en chemin absolu pour les tests Compose, car
                       | `DATA_DIR=data` serait interprete comme volume Docker nomme
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
preuve intermediaire   | CI 24756469461: `deploy-dependencies` passe; echec restant
                       | dans `backend-test-vitest`, avec commande test non upstream
preuve H7              | CI 24756715376: `deploy-dependencies` passe et les jobs
                       | `deces-ui`, `dataprep-backend`, `dataprep-frontend`,
                       | `deces-dataprep` passent; `backend-test-vitest` echoue car
                       | `wikidata` est absent du `DATA_DIR` runtime Compose
preuve finale          | CI 24757045362 sur 74ca822f: tous les jobs passent,
                       | dont `deces-backend build docker image and tests`,
                       | `deces-ui pull request test`, `dataprep-backend`,
                       | `dataprep-frontend`, `deces-dataprep` et `tools`
decision appliquee     | restaurer la cible historique `deploy-dependencies` dans
                       | `packages/deces-backend` en deleguant l'Elasticsearch a
                       | `packages/deces-infra`, puis l'appeler avant Vitest en CI;
                       | realigner Vitest sur `npm run test --verbose`; monter le
                       | `DATA_DIR` package-local absolu pour Vitest
```

Garde-fou CD H6:

- `workflow_dispatch` ne lance que `dataprep-small` par defaut; `year`, `full`
  ou `all` demandent un choix explicite;
- `workflow_dispatch` autorise aussi un deploy explicite avec
  `dataprep_scope=none` et `deploy_target=dev|prod`;
- `repository_dispatch` ne lance `dataprep-small` et `dataprep-year` que si
  `client_payload.ref == 'dev'`;
- `repository_dispatch` ne lance `dataprep-full` que si
  `client_payload.ref == 'master'`.
- `repository_dispatch` ne declenche plus le deploy prod;
- `push master` ne deploie la prod que si `packages/deces-ui/**` a evolue;
- un pur changement dataprep sur `master` ne redeploie pas `deces-ui`.

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
tools             | 8    | actions.yml / remote            | remote-config-test               | preuve manuelle
                  |      |                                  |                                  | deploy-remote
------------------+------+----------------------------------+----------------------------------+------------------
dataprep-backend  | 6    | pull.yml / pull request test    | ci.yml / dataprep-backend        | CI 24616234550
                  |      |                                  | pull request test                | job 71978790566
dataprep-backend  | 7    | push.yml / build image          | cd.yml / Publish matchid-        | CD 24586029288
                  |      |                                  | backend image                    | job 71895732114
dataprep-backend  | 8    | deploy.yml / deploy             | deploy-remote preprod            | image backend
                  |      |                                  |                                  | disponible
------------------+------+----------------------------------+----------------------------------+------------------
dataprep-frontend | 6    | pull.yml / pull request test    | ci.yml / dataprep-frontend       | CI 24616234550
                  |      |                                  | pull request test                | job 71978790569
dataprep-frontend | 7    | push.yml / build image          | cd.yml / Publish matchid-        | CD 24586029288
                  |      |                                  | frontend image                   | job 71895732047
------------------+------+----------------------------------+----------------------------------+------------------
deces-backend     | 6    | dockerimage.yml / build image   | ci.yml / deces-backend build     | CI 24759718808
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
deces-ui          | 8    | push.yml / deploy               | deploy-remote preprod            | preuve manuelle
                  |      |                                  |                                  | dev-deces OK
deces-ui          | 8    | logs-full.yml / logs-update.yml | stats / observabilite            | deploy-monitor
                  |      |                                  |                                  | OK; bucket absent
------------------+------+----------------------------------+----------------------------------+------------------
deces-dataprep    | 6    | pr.yml / locally                | ci.yml / deces-dataprep locally  | CI 24616234550
                  |      |                                  |                                  | job 71978790560
deces-dataprep    | 7    | small/year/full/push* datasets  | cd.yml / dataprep-small,         | small/year
                  |      | remote build                    | dataprep-year, dataprep-full     | passes GH;
                  |      |                                  |                                  | full lot 9
deces-dataprep    | 8    | remote large datasets           | remote dataprep cible            | year pass GH
------------------+------+----------------------------------+----------------------------------+------------------
deces-infra       | 7    | infra dispersee                 | snapshot publish/restore         | CD + UAT restore
deces-infra       | 8    | deploy-remote infra             | preprod dev-deces.matchid.io     | preuve manuelle
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
dataprep-backend  | make | version backend-docker-check | make -C packages/deces-dataprep     | job vert GH
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
deces-backend     | make | backend-build-image          | make -C packages/deces-backend      | CI 24759718808
                  |      |                              |   DATA_DIR=data backend-            |
                  |      |                              |   build-image                       |
                  | make | deploy-dependencies          | make -C packages/deces-backend      | correction H5
                  |      |                              |   deploy-dependencies               |
                  | make | backend-test-vitest          | make -C packages/deces-backend      | correction H5
                  |      |                              |   backend-test-vitest               |
                  | ci   | dockerimage.yml / build      | ci.yml / deces-backend build        | CI 24759718808
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

Déclenchement cible: `cd.yml` publie automatiquement sur `push` vers `dev` ou
`master`. Les runs listés ci-dessous prouvent l'exécution technique des jobs CD
déjà reconstruits; ils ne changent pas la règle de déclenchement cible.
Les dispatchs manuels `dataprep_scope=small|year|full` ne publient pas les
images Docker par effet de bord; seul `dataprep_scope=all` relance toute la
chaine artefacts.

```text
Workflow | Event    | Run id      | Statut | Commentaire
---------+----------+-------------+--------+------------------------------
CD       | push     | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch | 24533977844 | pass   | debug snapshot + artefacts
CD       | dispatch | 24777149351 | pass   | dataprep-small, 2 datasets
CD       | dispatch | 24777914592 | pass   | dataprep-year, remote-all
CD       | n/a      | n/a         | reporte| dataprep-full reserve prod/master
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
deces-dataprep    | make | small.yml / all petit jeu    | artifact-produce-dataprep-snapshot  | GH pass
                  |      | deces-2020-m01 + deaths      | + artifact-publish-dataprep-        | 24777149351
                  |      |                              | snapshot, matrix 2 datasets         |
                  | cd   | small.yml / build            | cd.yml / dataprep-small             | 2 snapshots
                  |      |                              |                                      | publies
deces-dataprep    | make | year.yml, push-dev.yml       | packages/deces-dataprep clean       | code aligne H6;
                  |      | / full-check + remote-all    | full-check puis remote-all SCW      | GH pass
                  |      |                              | REMOTE_* -> monorepo                | 24777914592
                  | cd   | year.yml / build             | cd.yml / dataprep-year              | snapshot dev
                  |      |                              |                                      | trouve
deces-dataprep    | make | full.yml, push-master.yml    | packages/deces-dataprep clean       | code aligne H6;
                  |      | / full-check + remote-all    | full-check puis remote-all SCW      | execution
                  |      |                              | REMOTE_* -> monorepo                | reportee lot 9
                  | cd   | full.yml / build             | cd.yml / dataprep-full              | lot 9/prod
------------------+------+------------------------------+--------------------------------------+------------------
deces-infra       | make | elasticsearch-repository-    | artifact-publish-dataprep-snapshot  | CD vert GH
                  |      | backup                       |                                      | 24586029288
                  | make | elasticsearch-restore        | artifact-restore-dataprep-snapshot  | pass lot 5
                  | cd   | small/year/full / build      | cd.yml / dataprep-small/year/full   | small/year
                  |      |                              |                                      | prouves; full lot 9
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

Preuve CD dataprep H6:

```text
Job               | Run id      | Job id      | Statut | Snapshot / resultat
------------------+-------------+-------------+--------+--------------------------------
dataprep-small    | 24777149351 | 72498296120 | pass   | esdata_fa194c98_c88006ac
deces-2020-m01    |             |             |        | count=60557, artifact 6577579269
dataprep-small    | 24777149351 | 72498296125 | pass   | esdata_fa194c98_74bab91a
deaths            |             |             |        | count=1355728, artifact 6577715452
dataprep-year     | 24777914592 | 72500946799 | pass   | esdata_fa194c98_e0735a1a
                  |             |             |        | remote-all, artifact 6577838420
dataprep-full     | n/a         | n/a         | lot 9  | non lance depuis PR; a executer
                  |             |             |        | depuis master/contexte prod valide
                  |             |             |        | avant bascule
```

Correction H6:

```text
Job monorepo   | Branche push | Scope upstream        | Cible make monorepo
---------------+--------------+-----------------------+---------------------------------------
dataprep-small | dev          | small.yml             | artifact-produce-dataprep-snapshot
               |              |                       | + artifact-publish-dataprep-snapshot
               |              |                       | matrix: deces-2020-m01.txt.gz,
               |              |                       | deaths.txt.gz / bucket dev
dataprep-year  | dev          | year.yml, push-dev    | make -C packages/deces-dataprep
               |              |                       | clean full-check puis remote-all
               |              |                       | deces-2020-m[0-1][0-9].txt.gz
               |              |                       | / bucket dev / SCW PRO2-M
dataprep-full  | master       | full.yml, push-master | make -C packages/deces-dataprep
               |              |                       | clean full-check puis remote-all
               |              |                       | regex full 1970-2024 + 2025/2026
               |              |                       | monthly / bucket prod / SCW PRO2-L
```

Clarification `dataprep-full` / deploiement:

- dans l'upstream, `small.yml`, `year.yml`, `full.yml`, `push-dev.yml` et
  `push-master.yml` sont des workflows de production du snapshot Elasticsearch
  dataprep, pas des workflows de deploiement UI;
- le deploiement `deces-ui` prod reste decouple des jobs dataprep: il se
  declenche automatiquement sur `push master` quand `packages/deces-ui/**`
  evolue, ou manuellement via `workflow_dispatch` sur `master` avec
  `dataprep_scope=none` et `deploy_target=prod`;
- si les fichiers entrant dans `DATAPREP_VERSION` et `DATA_VERSION` sont
  identiques entre `dev` et `master`, le nom de snapshot calcule reste
  identique; il n'y a donc pas de mismatch inherent entre snapshot produit en
  dev et snapshot attendu en master;
- le run `full` produit/verifie le snapshot; il ne redeclenche pas a lui seul
  un deploy `deces-ui`.

## Lot 9 - Non-regression data dataprep

Blocage de gouvernance constate le 2026-04-24:

- le repo racine `matchID-project/matchID` n'a aujourd'hui qu'une branche racine
  `dev`;
- la branche racine `master` n'existe pas encore;
- la substitution complete du processus actuel devra donc passer d'abord par la
  mise en place de la gouvernance GitHub decrite dans
  [SPEC_EVOL_009_GOUVERNANCE_GITHUB_MONOREPO](SPEC_EVOL_009_GOUVERNANCE_GITHUB_MONOREPO.md).

Reference upstream verifiee le 2026-04-22 via GitHub Actions
`matchID-project/deces-dataprep`:

```text
Workflow source  | Dernier run | Event             | Branche | SHA      | Statut | Role
-----------------+-------------+-------------------+---------+----------+--------+-----------------------------
small.yml        | 24749206517 | workflow_dispatch | dev     | e0489f1  | pass   | deces-2020-m01 + deaths
year.yml         | 24755391159 | schedule          | dev     | e0489f1  | pass   | jeu annuel dev
full.yml         | 24273064744 | schedule          | dev     | e0489f1  | pass   | jeu complet planifie
push-dev.yml     | 21831591181 | push              | dev     | e0489f1  | pass   | push dev -> year
push-master.yml  | 21837559650 | push              | master  | 364f71b  | pass   | push master -> full
```

Preuve detaillee:

- [SPEC_EVOL_007_PREUVE_PARITE_DATAPREP](SPEC_EVOL_007_PREUVE_PARITE_DATAPREP.md)

Protocole temporaire execute sur le commit `41c099bb`:

```text
Commande make historique
--------------------------------------------------------------------------------
make dataprep-parity-contract DATAPREP_PARITY_FILES_TO_PROCESS=deces-2020-m01.txt.gz
make dataprep-parity-contract DATAPREP_PARITY_FILES_TO_PROCESS=deaths.txt.gz
```

Contrat compare:

- source data: fichier exact recupere depuis le miroir S3 via `packages/tools`
  et `storage-pull`;
- original: `packages/deces-dataprep` avec backend historique tire par
  `backend-docker-pull`;
- monorepo: `packages/deces-dataprep` avec l'image backend construite depuis
  `packages/dataprep-backend`;
- artefacts locaux non commites sous `.matchid/parity/deces-dataprep/<dataset>`:
  `count.txt`, `mapping.json`, `source-types.json`, `sample.json`,
  `manifest.json`, `contract-report.json`;
- sample: 10000 documents deterministes, seed `424242`;
- validation finale: comparaison byte-a-byte du count, mapping, types de
  champs sources et sample.

Cet outillage temporaire a ete retire du tronc courant apres acceptation de la
preuve. Il reste consultable dans l'historique git via le commit `41c099bb`.

```text
Dataset              | Count original | Count monorepo | Sample 10000 | Mapping/types | Statut
---------------------+----------------+----------------+--------------+---------------+--------
deces-2020-m01.txt.gz | 60557          | 60557          | ok           | ok            | pass
deaths.txt.gz        | 1355728        | 1355728        | ok           | ok            | pass
```

Note `deaths.txt.gz`: les deux recettes loguent `1355745` lignes traitees et
`1355744` lignes ecrites, mais l'index Elasticsearch exporte contient
`1355728` documents des deux cotes. La preuve retenue est donc la parite stricte
du contenu indexe exporte, pas le compteur intermediaire de recette.

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

Preuve manuelle preprod du 2026-04-22:

```text
Etape             | Commande / preuve make                    | Resultat
------------------+--------------------------------------------+-------------------------------
Commit deploye    | git describe / git rev-parse               | 0.4.0-4348-geb28f06a
Images            | make backend-build-image/docker-push       | deces-backend publie:
                  | make build/frontend-docker-push            | sha256:4ca9c43f643...
                  |                                            | deces-ui publie:
                  |                                            | sha256:f58b5ed3ce...
Remote instance   | make deploy-remote                         | instance SCW:
                  |                                            | a593eb34-0eb0-420c-
                  |                                            | 8750-3ac85386295f
                  |                                            | 51.15.247.64
Remote restore    | make deploy-remote                         | snapshot restaure:
                  |                                            | esdata_fa194c98_e0735a1a
Elasticsearch     | make -C packages/tools remote-cmd          | cluster green;
                  |                                            | index deces: 679573 docs
Remote services   | make deploy-remote                         | backend demarre;
                  |                                            | all components started
Remote API VPC    | make deploy-remote                         | localhost:8083 search ok
Publish preprod   | make -C packages/tools nginx-conf-apply    | upstream nginx:
                  |                                            | 51.15.247.64:8083
Public API        | make -C packages/tools remote-test-api     | api public dev-deces ok
CDN               | make deploy-cdn-purge-cache                | cache purged
Cleanup           | make deploy-delete-old                     | no invalid server to delete
Public UI         | curl https://dev-deces.matchid.io/         | GET 200 text/html
Public health     | curl /deces/api/v1/healthcheck             | GET 200 application/json
Public search     | curl POST /deces/api/v1/search             | POST 200 application/json
Monitoring        | make deploy-monitor                        | cible executee sans erreur
```

Preuve de redeploiement manuel du 2026-04-22:

- `make deploy-remote-preflight` sort en `0` avec deux warnings attendus:
  `REMOTE_DEPLOY_BRANCH=feat/refacto-make` differe de `GIT_BRANCH=dev`, et
  `MONITOR_BUCKET` est absent.
- `make deploy-remote` sort en `0` sans override CLI apres correction de la
  config locale ignoree: `CLOUD_SSHOPTS=-J ubuntu@bastion -o IdentitiesOnly=yes`,
  `SSHKEY_PRIVATE=/home/antoinefa/.ssh/id_ecdsa`, `NGINX_USER=ubuntu`.
- Le run restaure `esdata_fa194c98_e0735a1a`, demarre backend + UI, valide
  `localhost:8083/deces/api/v1/search`, valide le test VPC sur `51.15.247.64`,
  valide `https://dev-deces.matchid.io/deces/api/v1/search`, purge le CDN,
  execute `deploy-delete-old` puis `deploy-monitor`.
- Verifications independantes apres run: `GET /deces/api/v1/healthcheck` en
  `200`, `GET /` en `200`, `POST /deces/api/v1/search` avec `.response`
  present, `GET localhost:9200/deces/_count` a `679573`, clone distant au
  commit `eb28f06a`.
- L'instance SCW reutilisee a ete retaguee pour refleter l'artefact servi:
  `ui:0.4.0-4348-geb28f06a-backend:0.4.0-4348-geb28f06a-data:fa194c98-e0735a1a`.
- Observabilite lot 8: `deploy-monitor` sort en `0`; `MONITOR_BUCKET` reste
  absent et est documente comme limite non bloquante de preprod.

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
deces-dataprep    | remote-all               | packages/deces-dataprep   | year/push-dev /   | GH pass
                  |                          | remote-all + REMOTE_*     | build             | 24777914592
                  |                          | vers monorepo matchID     | full/push-master  | full lot 9
```
