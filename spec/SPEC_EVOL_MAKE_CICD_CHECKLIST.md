# SPEC EVOL - Checklist make, CI et CD

## Objet

Cette spec centralise la parite entre les repos source et le monorepo. Chaque
ligne de matrice donne le mapping complet:

- repo source;
- target `make` dans le repo source;
- target `make` cible dans le monorepo;
- job CI/CD source;
- job CI/CD cible dans le monorepo;
- preuve et statut.

Convention: `Make source` est une target du repo source historique. `Make
monorepo` est une target appelee depuis la racine du monorepo, sauf mention
explicite `packages/...`.

Regles:

- toutes les validations passent par `make`;
- pas de validation par `npm`, `docker` ou scripts appeles directement;
- une preuve GitHub doit citer le workflow, le job, le run id et le statut;
- les cibles SCW et `deploy-remote` relevent du lot 8 tant qu'elles ne sont pas
  prouvees sur `dev-deces.matchid.io`.

## Preuves CI/CD courantes

```text
Workflow | Event        | Run id      | Statut | Commentaire
---------+--------------+-------------+--------+-------------------------------
CI       | push         | 24586029291 | pass   | commit 24aad951
CI       | pull_request | 24586031821 | pass   | PR #2, commit 24aad951
CD       | push         | 24586029288 | pass   | images + snapshot dataprep
CD       | dispatch     | 24533977844 | pass   | run debug snapshot + artefacts
```

```text
Workflow | Event        | Job                              | Run id      | Job id      | Statut
---------+--------------+----------------------------------+-------------+-------------+-------
CI       | push         | Tools smoke                      | 24586029291 | 71895726818 | pass
CI       | push         | Backend smoke                    | 24586029291 | 71895726807 | pass
CI       | push         | Dataprep smoke                   | 24586029291 | 71895726817 | pass
CI       | push         | UI smoke                         | 24586029291 | 71895726813 | pass
CI       | push         | End-to-end smoke                 | 24586029291 | 71895726799 | pass
CI       | pull_request | Tools smoke                      | 24586031821 | 71895726809 | pass
CI       | pull_request | Backend smoke                    | 24586031821 | 71895726812 | pass
CI       | pull_request | Dataprep smoke                   | 24586031821 | 71895726830 | pass
CI       | pull_request | UI smoke                         | 24586031821 | 71895726814 | pass
CI       | pull_request | End-to-end smoke                 | 24586031821 | 71895726805 | pass
CD       | push         | Publish matchid-backend image    | 24586029288 | 71895732114 | pass
CD       | push         | Publish matchid-frontend image   | 24586029288 | 71895732047 | pass
CD       | push         | Publish deces-backend image      | 24586029288 | 71895732033 | pass
CD       | push         | Publish deces-ui image           | 24586029288 | 71895732121 | pass
CD       | push         | Publish dataprep snapshot        | 24586029288 | 71895732072 | pass
```

Correction de l'ecart CI `Backend smoke` / `UI smoke`:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
commit           | 24aad951
cause            | inputs live data.gouv et requete smoke trop specifique
correction       | fixture dataprep hermetique + requete API sans departement
preuve locale    | make smoke-backend MAILDEV_UI_PORT=37343 SMOKE_FILES_TO_PROCESS=deces-2020.txt.gz
resultat local   | pass; dataprep 3/3 lignes ecrites; GET+POST API ok
preuve GitHub CI | push 24586029291 + pull_request 24586031821
preuve GitHub CD | push 24586029288
statut           | leve
```


## Matrice make par composant source

Cette matrice liste les cibles `make` historiques ou nouvellement exposees qui
doivent rester visibles dans la substitution. `pkg/` abrege `packages/`. Les
lignes `pkg/...` sont conservees au niveau package mais pas encore promues comme
contrat racine.

```text
Repo              | Make source                      | Mono make                          | CI src                | CI mono               | Statut
------------------+----------------------------------+------------------------------------+-----------------------+-----------------------+----------------
root monorepo     | n/a                              | dev                                | n/a                   | CI/UI+E2E smoke       | pass local+GH
root monorepo     | n/a                              | dev-stop                           | n/a                   | cleanup smoke         | pass indirect
root monorepo     | n/a                              | start; up                          | n/a                   | aucun job dedie       | cible presente
root monorepo     | n/a                              | stop; down; restart                | n/a                   | cleanup smoke         | cible presente
root monorepo     | n/a                              | build                              | deces-ui/push build   | CD/deces-ui image     | pass indirect
tools             | tools-smoke                      | smoke-tools                        | actions.yml/swift     | CI/Tools smoke        | pass push+PR
tools             | docker-check                     | pkg/tools docker-check             | actions.yml/swift     | CI/Tools smoke        | pass indirect
tools             | docker-build; docker-push        | pkg/tools docker-build/push        | actions.yml/swift     | aucun job dedie       | hors critique
tools             | remote-config-test               | pkg/tools remote-config-test       | actions.yml/remote    | lot 8 deploy          | a prouver
tools             | SCW-instance-*                   | pkg/tools SCW-instance-*           | actions.yml/remote    | lot 8 SCW             | a encadrer
dataprep-backend  | test                             | pkg/dataprep-backend test          | pull.yml/test         | CI/Dataprep smoke     | pass indirect
dataprep-backend  | backend-dev; backend-dev-stop    | pkg/dataprep-backend backend-dev   | aucun                 | CI/Dataprep smoke     | pass indirect
dataprep-backend  | backend-build                    | artifact-build-dataprep-backend    | push.yml/build        | CD/matchid-backend    | pass local+GH
dataprep-backend  | backend-docker-push              | artifact-publish-dataprep-backend  | push.yml/build        | CD/matchid-backend    | pass local+GH
dataprep-backend  | dev; dev-stop                    | pkg/dataprep-backend dev           | aucun                 | aucun job dedie       | cible conservee
dataprep-backend  | start; stop; up; down; restart   | pkg/dataprep-backend start/stop    | aucun                 | aucun job dedie       | cible conservee
dataprep-backend  | recipe-run                       | dataprep-run                       | via deces-dataprep    | CI/CD snapshot        | pass
dataprep-backend  | elasticsearch-restore            | artifact-restore-dataprep-snapshot | aucun                 | restore local         | pass local
dataprep-backend  | deploy-local                     | deploy-local                       | aucun                 | lot 8                 | a prouver
dataprep-backend  | deploy-remote                    | deploy-remote                      | deploy.yml/deploy     | lot 8 deploy          | a prouver
dataprep-frontend | frontend-dev; frontend-dev-stop  | pkg/dataprep-frontend frontend-*   | pull.yml/test         | CI/Dataprep smoke     | pass indirect
dataprep-frontend | frontend-build                   | artifact-build-dataprep-frontend   | push.yml/build        | CD/matchid-frontend   | pass local+GH
dataprep-frontend | frontend-docker-push             | artifact-publish-dataprep-frontend | push.yml/build        | CD/matchid-frontend   | pass local+GH
dataprep-frontend | backend-dev                      | pkg/dataprep-frontend backend-dev  | aucun                 | CI/Dataprep smoke     | pass indirect
dataprep-frontend | dev; dev-stop                    | pkg/dataprep-frontend dev          | aucun                 | aucun job dedie       | cible conservee
dataprep-frontend | start; stop; up; down; restart   | pkg/dataprep-frontend start/stop   | aucun                 | aucun job dedie       | cible conservee
deces-backend     | backend-build-image              | artifact-build-deces-backend       | dockerimage/build     | CD/deces-backend      | pass local+GH
deces-backend     | docker-push-backend              | artifact-publish-deces-backend     | dockerimage/build     | CD/deces-backend      | pass local+GH
deces-backend     | backend-dev                      | backend-dev                        | dockerimage/build     | CI/Backend smoke      | pass local+GH
deces-backend     | backend-dev-test                 | backend-dev-test; smoke-backend    | dockerimage/build     | CI/Backend smoke      | pass local+GH
deces-backend     | test-perf-v1                     | pkg/deces-backend test-perf-v1     | dockerimage/bulk      | non reconstruit       | lot8/hors gate
deces-ui          | frontend-dev; frontend-dev-stop  | frontend-dev; frontend-dev-stop    | pr.yml/test           | CI/UI smoke           | pass local+GH
deces-ui          | frontend-build                   | artifact-build-deces-ui            | push.yml/build        | CD/deces-ui           | pass local+GH
deces-ui          | frontend-test                    | frontend-test; smoke-ui            | pr.yml; push.yml      | CI/UI smoke           | pass local+GH
deces-ui          | build; docker-check; docker-push | artifact-build/publish-deces-ui    | push.yml/build        | CD/deces-ui           | pass local+GH
deces-ui          | deploy-local                     | deploy-local                       | push.yml/test         | lot 8                 | a prouver
deces-ui          | deploy-remote                    | deploy-remote                      | push.yml/deploy       | lot 8 deploy          | a prouver
deces-ui          | logs-full; logs-update           | aucun contrat racine               | logs-*.yml            | non reconstruit       | a trancher lot8
deces-dataprep    | dev; dev-stop                    | dataprep-dev; dataprep-dev-stop    | aucun                 | aucun job dedie       | pass local
deces-dataprep    | up; down                         | pkg/deces-dataprep up/down         | aucun                 | smoke cleanup         | cible presente
deces-dataprep    | data-tag                         | dataprep-data-tag                  | aucun                 | CD snapshot meta      | pass indirect
deces-dataprep    | recipe-run                       | dataprep-run                       | pr/small/year/full    | CI/Dataprep + CD snap | pass local+GH
deces-dataprep    | full-check; full                 | smoke-dataprep; artifact snapshot  | pr/small/year/full    | CI/CD snapshot        | pass local+GH
deces-dataprep    | elasticsearch-restore            | elasticsearch-restore              | aucun                 | restore local         | pass local
deces-dataprep    | remote-all                       | cible racine a definir             | push-dev/master; full | lot 8 remote          | a definir
deces-dataprep    | update-base-image                | cible racine a definir             | aucun                 | lot 8 SCW             | a encadrer
deces-infra       | elasticsearch-restore            | elasticsearch-restore              | deces-ui deploy       | lot 8 restore         | a prouver
deces-infra       | elasticsearch-restore-async      | elasticsearch-restore-async        | deces-ui deploy-local | lot 8 deploy-local    | cible presente
deces-infra       | repo backup/delete/list          | artifact-publish-dataprep-snapshot | dataprep full/push    | CD/dataprep snapshot  | pass local+GH
website           | build; up; down                  | pkg/website build/up/down          | aucun                 | aucun                 | hors chaine
```

L'ecart CI observe sur les smoke `Backend`/`UI` est leve: les inputs de smoke
ne dependent plus du fichier live data.gouv `fichier-opposition-deces-260407.csv`
et la requete de validation backend cible un enregistrement present dans la
fixture hermetique.

## Matrice lot 6 - CI validation

```text
Repo source       | Make source                 | Make monorepo                  | Job source          | Job monorepo        | Statut
------------------+-----------------------------+--------------------------------+---------------------+---------------------+-------------
tools             | tools-smoke                 | smoke-tools                    | actions.yml/swift   | CI/Tools smoke      | pass push+PR
dataprep-backend  | test; backend-docker-check  | smoke-dataprep                 | pull.yml/test       | CI/Dataprep smoke   | pass push+PR
dataprep-frontend | frontend-docker-check; build| smoke-dataprep                 | pull.yml/test       | CI/Dataprep smoke   | pass push+PR
dataprep-frontend | frontend-docker-check; build| smoke-e2e                      | pull.yml/test       | CI/E2E smoke        | pass push+PR
deces-backend     | backend-dev-test            | smoke-backend                  | dockerimage.yml     | CI/Backend smoke    | pass push+PR
deces-ui          | frontend-test               | smoke-ui                       | pr.yml/test         | CI/UI smoke         | pass push+PR
inter-repos       | aucun                       | smoke-e2e                      | aucun               | CI/E2E smoke        | pass push+PR
deces-backend     | backend-dev-test            | backend-dev-test               | aucun               | aucun               | pass local lot 3
deces-ui          | frontend-test               | frontend-test                  | aucun               | aucun               | pass local lot 3
```

## Matrice runtime avec donnees

```text
Repo source       | Make source                 | Make monorepo                  | Job source          | Job monorepo        | Statut
------------------+-----------------------------+--------------------------------+---------------------+---------------------+-------------
deces-dataprep    | recipe-run; watch-run       | dataprep-run                   | pr/small/year       | CI/CD smoke+snapshot| pass
deces-dataprep    | data-tag                    | dataprep-data-tag              | aucun               | utilise snapshot    | pass indirect
deces-infra       | elasticsearch-restore       | elasticsearch-restore          | aucun               | restore local       | pass local
deces-infra       | elasticsearch-restore       | artifact-restore-dataprep-snapshot | aucun        | wrapper lot 7       | pass local
deces-ui/backend  | dev; start; up              | dev                            | aucun               | CI smoke-ui/e2e     | pass
deces-ui/backend  | stop; down                  | dev-stop                       | aucun               | cleanup smoke       | pass indirect
deces-ui          | deploy-local                | deploy-local                   | push.yml/deploy     | aucun lot 7         | lot 8
```

## Matrice lot 7 - CD artefacts

```text
Repo source       | Make source                 | Make monorepo                  | Job source          | Job monorepo        | Statut
------------------+-----------------------------+--------------------------------+---------------------+---------------------+-------------
dataprep-backend  | backend-build               | artifact-build-dataprep-backend | push.yml/build     | CD/matchid-backend  | pass local+GH
dataprep-backend  | backend-docker-push         | artifact-publish-dataprep-backend | push.yml/build   | CD/matchid-backend  | pass local+GH
dataprep-frontend | build                       | artifact-build-dataprep-frontend | push.yml/build    | CD/matchid-frontend | pass local+GH
dataprep-frontend | frontend-docker-push        | artifact-publish-dataprep-frontend | push.yml/build  | CD/matchid-frontend | pass local+GH
deces-backend     | backend-build-image         | artifact-build-deces-backend   | dockerimage.yml     | CD/deces-backend    | pass local+GH
deces-backend     | docker-push-backend         | artifact-publish-deces-backend | dockerimage.yml     | CD/deces-backend    | pass local+GH
deces-ui          | frontend-build; nginx-build | artifact-build-deces-ui        | push.yml/build      | CD/deces-ui         | pass local+GH
deces-ui          | frontend-docker-push        | artifact-publish-deces-ui      | push.yml/build      | CD/deces-ui         | pass local+GH
dataprep-backend  | package                     | artifact-build-legacy-package  | push.yml/master     | CD/master only      | cible presente
dataprep-backend  | package-publish             | artifact-publish-legacy-package| push.yml/master     | CD/master only      | cible presente
deces-dataprep    | full-check; recipe-run      | artifact-produce-dataprep-snapshot | year/full/push | CD/dataprep snapshot| pass local+GH
deces-infra       | elasticsearch-repository-backup | artifact-publish-dataprep-snapshot | year/full/push | CD/dataprep snapshot| pass local+GH
deces-infra       | elasticsearch-restore       | artifact-restore-dataprep-snapshot | aucun          | restore local       | pass local
```

Snapshot prouve par CD:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
run id           | 24586029288
bucket non-prod  | fichier-des-personnes-decedees-elasticsearch-dev
files_to_process | deces-2020.txt.gz
job              | Publish dataprep snapshot
statut           | pass
```

Run debug snapshot precedent:

```text
Champ            | Valeur
-----------------+------------------------------------------------------------
run id           | 24533977844
snapshot         | esdata_6df42346_d2d7ee21
count ES         | 679573
artifact         | dataprep-snapshot-metadata / id 6486657468
digest artifact  | a50f8884a528fcf22b2919fb5d1443e1cc9e600d6efeb7bff80f6fb7e2cbc39c
```

## Matrice lot 8 - preprod, deploy-remote et SCW

Ces lignes ne sont pas encore des preuves de substitution. Elles cadrent ce qui
doit etre tranche ou prouve pour `dev-deces.matchid.io`.

```text
Repo source       | Make source                 | Make monorepo                  | Job source          | Job monorepo cible  | Statut
------------------+-----------------------------+--------------------------------+---------------------+---------------------+-------------
deces-ui          | deploy-remote               | deploy-remote                  | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-remote-instance      | deploy-remote-instance         | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-remote-services      | deploy-remote-services         | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-remote-publish       | deploy-remote-publish          | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-delete-old           | deploy-delete-old              | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-monitor              | deploy-monitor                 | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | deploy-cdn-purge-cache      | deploy-cdn-purge-cache         | push.yml/deploy     | deploy preprod      | a prouver
deces-ui/tools    | remote-docker-pull          | deploy-docker-pull-base        | aucun               | SCW preprod         | a prouver
deces-ui/tools    | update-base-image           | update-base-image              | aucun               | SCW preprod         | auditer/fixer
deces-dataprep    | remote-all                  | cible racine a definir         | year/full/push      | dataprep remote     | comparer CD snapshot
deces-dataprep    | update-base-image           | cible racine a definir         | aucun               | SCW dataprep        | migrer ou retirer
tools             | SCW-instance-snapshot       | primitive, pas contrat direct  | aucun               | SCW preprod         | encapsuler
tools             | SCW-instance-image          | primitive, pas contrat direct  | aucun               | SCW preprod         | encapsuler
deces-infra       | elasticsearch-restore       | elasticsearch-restore          | deploy implicite    | deploy preprod      | a prouver preprod
```

Points d'attention lot 8:

- `make update-base-image` racine contient encore du legacy et doit etre auditee
  avant usage comme contrat monorepo.
- `packages/deces-dataprep update-base-image` modifie puis commit son Makefile:
  ce comportement ne doit pas rester implicite dans le monorepo.
- les appels `SCW-instance-snapshot` et `SCW-instance-image` sont des primitives
  outils; le lot 8 doit definir quelle cible racine les expose proprement.
- les images SCW ne remplacent pas les images Docker publiees au lot 7: elles
  servent a accelerer/provisionner l'instance distante `deploy-remote`.

Checklist lot 8 associee:

- [ ] choisir la cible canonique pour construire/actualiser l'image SCW preprod;
- [ ] supprimer ou encadrer tout commit automatique fait par une cible `make`;
- [ ] prouver `make deploy-docker-pull-base` sur l'instance preprod;
- [ ] prouver la creation d'une image SCW depuis une instance monorepo;
- [ ] prouver `make deploy-remote` de bout en bout sur `dev-deces.matchid.io`;
- [ ] prouver la restauration effective du snapshot sur la preprod;
- [ ] prouver API + UI apres bascule preprod.
