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
deces-backend     | 6    | dockerimage.yml / build image   | ci.yml / deces-backend build     | CI 24616234550
                  |      |                                  | docker image                     | job 71978790567
deces-backend     | 6    | dockerimage.yml / runtime tests | ci.yml / deces-ui pull request   | CI 24616234550
                  |      |                                  | test                             | job 71978790570
deces-backend     | 7    | dockerimage.yml / publish image | cd.yml / Publish deces-backend   | CD 24586029288
                  |      |                                  | image                            | job 71895732033
deces-backend     | hors | dockerimage.yml / bulk perf     | pas artefact de reference        | hors contrat lot 7
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
deces-dataprep    | 7    | small/year/full/push* datasets  | cd.yml / Publish dataprep        | CD 24586029288
                  |      | remote build                    | snapshot                         | job 71895732072
deces-dataprep    | 8    | remote large datasets           | remote dataprep cible            | a prouver lot 8
------------------+------+----------------------------------+----------------------------------+------------------
deces-infra       | 7    | infra dispersee                 | snapshot publish/restore         | CD + UAT restore
deces-infra       | 8    | deploy-remote infra             | preprod dev-deces.matchid.io     | a prouver lot 8
```

Artefacts publies par le run CD retenu:

```text
Artefact          | Tag / version publiee       | Make monorepo                    | Preuve
------------------+-----------------------------+----------------------------------+------------------
matchid-backend   | 24aad95-e4d91b              | artifact-build-dataprep-backend | CD 24586029288
                  | digest sha256:ef5acdc5...   | artifact-publish-dataprep-      | job 71895732114
                  |                             | backend                          |
matchid-frontend  | 24aad95-2d96b8              | artifact-build-dataprep-        | CD 24586029288
                  | digest sha256:93e7ae0c...   | frontend                         | job 71895732047
                  |                             | artifact-publish-dataprep-      |
                  |                             | frontend                         |
deces-backend     | 24aad95                     | artifact-build-deces-backend    | CD 24586029288
                  | digest sha256:cef2e810...   | artifact-publish-deces-backend  | job 71895732033
deces-ui          | 24aad95                     | artifact-build-deces-ui         | CD 24586029288
                  | digest sha256:800e61c6...   | artifact-publish-deces-ui       | job 71895732121
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
                  |      |                              |   backend-stop                      |
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
deces-backend     | make | backend-build-image          | make artifact-build-deces-backend   | job vert GH
                  | ci   | dockerimage.yml / build      | ci.yml / deces-backend build        | job vert GH
                  |      |                              |   docker image                      | 24616234550
------------------+------+------------------------------+--------------------------------------+------------------
deces-ui          | make | version config               | make version config                 | job vert GH
                  |      | docker-check || build        | make frontend-docker-check          | 24616234550
                  |      | deploy-local backend-test    | || make artifact-build-deces-ui     | Appariement
                  |      | frontend-test                | make artifact-build-deces-backend   | Wikidata inclus
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

Déclenchement cible: `cd.yml` publie automatiquement uniquement sur `push` vers
`dev`. Les runs listés ci-dessous prouvent l'exécution technique des jobs CD
déjà reconstruits; ils ne changent pas la règle de déclenchement cible.

```text
Workflow | Event    | Run id      | Statut | Commentaire
---------+----------+-------------+--------+------------------------------
CD       | push     | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch | 24533977844 | pass   | debug snapshot + artefacts
```

```text
Repo source       | Type | Source                       | Monorepo                             | Preuve
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-backend  | make | backend-build                | artifact-build-dataprep-backend     | CD vert GH
                  | make | backend-docker-push          | artifact-publish-dataprep-backend   | 24586029288
                  | cd   | push.yml / build             | cd.yml / Publish matchid-backend    | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
dataprep-frontend | make | build                        | artifact-build-dataprep-frontend    | CD vert GH
                  | make | frontend-docker-push         | artifact-publish-dataprep-frontend  | 24586029288
                  | cd   | push.yml / build             | cd.yml / Publish matchid-frontend   | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
deces-backend     | make | backend-build-image          | artifact-build-deces-backend        | CD vert GH
                  | make | docker-push-backend          | artifact-publish-deces-backend      | 24586029288
                  | cd   | dockerimage.yml / build      | cd.yml / Publish deces-backend      | image publiee
                  |      |                              | image                                |
------------------+------+------------------------------+--------------------------------------+------------------
deces-ui          | make | frontend-build; nginx-build  | artifact-build-deces-ui             | CD vert GH
                  | make | frontend-docker-push         | artifact-publish-deces-ui           | 24586029288
                  | cd   | push.yml / build             | cd.yml / Publish deces-ui image     | image publiee
------------------+------+------------------------------+--------------------------------------+------------------
deces-dataprep    | make | full-check; recipe-run       | artifact-produce-dataprep-snapshot  | CD vert GH
                  | cd   | year/full/push* / build      | cd.yml / Publish dataprep snapshot  | 24586029288
                  |      |                              |                                      | snapshot publie
------------------+------+------------------------------+--------------------------------------+------------------
deces-infra       | make | elasticsearch-repository-    | artifact-publish-dataprep-snapshot  | CD vert GH
                  |      | backup                       |                                      | 24586029288
                  | make | elasticsearch-restore        | artifact-restore-dataprep-snapshot  | pass lot 5
                  | cd   | year/full/push* / build      | cd.yml / Publish dataprep snapshot  | snapshot publie
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

```text
Repo source       | Make source              | Make monorepo             | Job source        | Statut
------------------+--------------------------+---------------------------+-------------------+-------------
tools             | remote-config-test       | packages/tools remote-    | actions.yml /     | cible remote
                  |                          | config-test + REMOTE_*    | remote            | parametree
deces-ui          | deploy-remote            | cd.yml / deploy-preprod   | push.yml / deploy | job cree;
                  |                          | -> preflight +            |                   | preflight local OK,
                  |                          | deploy-remote             |                   | preuve GH a venir
deces-ui/tools    | deploy-remote-instance   | deploy-remote-instance    | push.yml / deploy | route monorepo
                  |                          | REMOTE_TOOLS_*/APP_*      |                   | par make -qp
deces-ui/tools    | deploy-remote-services   | deploy-remote-services    | push.yml / deploy | route monorepo
                  |                          | REMOTE_TOOLS_*/APP_*      |                   | par make -qp
deces-ui/tools    | deploy-remote-publish    | deploy-remote-publish     | push.yml / deploy | lot 8
deces-ui/tools    | deploy-delete-old        | deploy-delete-old         | push.yml / deploy | lot 8
deces-dataprep    | remote-all               | cible racine a definir    | full/push* /      | lot 8
                  |                          |                           | build             |
```
