# SPEC_EVOL_005 - Préprod et bascule de référence vers le monorepo

## Contexte

Les repos originaux restent les repos en production. Le monorepo doit devenir la nouvelle source de livraison sans dégrader l'exploitation existante.

## Objectif

Préparer puis exécuter une bascule progressive vers un pipeline de déploiement piloté par le monorepo.

## Non-objectifs

- faire une migration "big bang" sans préprod
- modifier profondément l'architecture prod avant d'avoir une chaîne dev/CI fiable

## Préconditions

- phase 1 terminée
- runtime monorepo stabilisé
- chaîne dev validée
- CI racine opérationnelle

## Décisions actées

- la voie canonique de déploiement préprod/prod à ce stade est `deploy-remote`
- `deploy-k8s` sort du chemin critique et devient un sujet de roadmap
- le contrat d'artefacts de référence de la chaîne complète est:
  - image `backend`
  - image `deces-backend`
  - image `deces-ui`
  - snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
- l'image `backend` est requise pour l'exécution du dataprep
- pour `deploy-remote`, l'artefact de référence de `deces-dataprep` est le snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
- `DATAPREP_VERSION` dérive du code, de la recipe et de l'index du dataprep
- `DATA_VERSION` dérive du catalog tag des données source
- la préprod cible est `dev-deces.matchid.io`

## Travaux

### A. Inventaire des actifs de prod

- images Docker
- buckets et snapshots
- volumes
- DNS et certificats
- monitoring
- jobs de refresh Data.gouv
- secrets

#### Inventaire initial des images Docker

```text
Image / actif          | Repo source historique     | Controle monorepo       | Statut lot 8
-----------------------+----------------------------+-------------------------+--------------------------
matchid/matchid-       | dataprep-backend           | cd.yml / Publish        | publie lot 7; verifier
backend                | push.yml / build           | matchid-backend image   | le pull en preprod
matchid/matchid-       | dataprep-frontend          | cd.yml / Publish        | publie lot 7; verifier
frontend               | push.yml / build           | matchid-frontend image  | si encore deploye
matchid/deces-backend  | deces-backend              | cd.yml / Publish        | publie lot 7; deployer
                       | dockerimage.yml / build    | deces-backend image     | en preprod
matchid/deces-ui       | deces-ui push.yml / build  | cd.yml / Publish        | publie lot 7; deployer
                       |                            | deces-ui image          | en preprod
matchid/swift          | tools actions.yml / swift  | ci.yml / build docker   | build valide; decision
                       |                            | swift                   | de publication lot 8
SCW base image UI      | deces-ui update-base-image | Make racine             | trancher avant usage;
d48f33cd-...           | + tools SCW-instance-*     | update-base-image       | supprimer auto-commit
SCW base image dataprep| deces-dataprep             | packages/deces-dataprep | trancher pour remote
8e7f9833-...           | update-base-image          | update-base-image       | large datasets
node/nginx/es/redis    | deploy-docker-pull-base    | Make racine             | images externes; pas
                       |                            | deploy-docker-pull-base | pilotees par anciens repos
postgres/elasticsearch | dataprep-backend runtime   | dataprep backend        | images externes; verifier
                       |                            | cibles make             | seulement les pulls
legacy backend/        | packages/deces-dataprep    | parite lot 5 seulement  | non cible deploy; garder
frontend embarques     | backend + frontend         |                         | hors chemin preprod
```

Conclusion d'inventaire image:

- les images applicatives critiques sont maintenant produites par le monorepo;
- `deploy-remote` doit prouver qu'il consomme ces images monorepo, pas les
  publications historiques;
- `matchid/swift` et les images de base SCW restent a trancher avant execution
  preprod;
- les cibles `update-base-image` doivent etre encadrees pour ne plus committer
  automatiquement une mutation de `SCW_IMAGE_ID`;
- les images externes runtime sont des dependances a verifier, pas des artefacts
  a republier par le monorepo.

#### Inventaire initial des buckets et snapshots

```text
Bucket / snapshot       | Usage historique          | Controle monorepo       | Statut lot 8
------------------------+---------------------------+-------------------------+--------------------------
fichier-des-personnes-  | miroir Data.gouv utilise  | tools + deces-dataprep | conserver; verifier
decedees                | par dataprep/backend      | data-version/s3-pull    | acces preprod
fichier-des-personnes-  | repository ES prod par    | deces-infra repository  | cible prod; ne pas
decedees-elasticsearch  | defaut                    | config/restore          | toucher en preprod
fichier-des-personnes-  | repository ES non-prod    | cd.yml snapshot +       | cible preprod/dev;
decedees-elasticsearch- | pour CI, UAT et dev       | elasticsearch-restore   | prouve lot 7
dev                     |                           |                         |
esdata_${DATAPREP_      | snapshot de reference     | artifact-produce/       | contrat deploy-remote;
VERSION}_${DATA_VERSION}| dataprep                  | publish/restore         | restaurer en preprod
matchid-backups/deces-  | logs UI historiques       | logs-restore / stats    | migration observabilite
ui/log                  | deces-ui                  | cibles racine           | a cadrer lot 8
matchid-backups/deces-  | base logs/stats           | stats-db-restore /      | migration observabilite
ui/log-db               | deces-ui                  | stats-db-backup         | a cadrer lot 8
matchid-backups/deces-  | stats publiques UI        | stats-restore/backup    | migration observabilite
ui/stats/rpa            |                           |                         | a cadrer lot 8
matchid-backups/deces-  | preuves backend/UI        | proofs-restore/backup   | verifier besoin preprod
ui/proofs               |                           |                         | avant deploy
matchid-dist            | package legacy backend    | artifact legacy package | hors chemin critique;
                        | dataprep-backend          | si conserve             | a trancher lot 8
SCW volume snapshots    | update-base-image via     | tools SCW-instance-     | encadrer; pas de commit
temporaires             | tools                     | snapshot/image          | automatique
```

Conclusion d'inventaire bucket/snapshot:

- la preprod doit utiliser le bucket non-prod
  `fichier-des-personnes-decedees-elasticsearch-dev`;
- le bucket prod `fichier-des-personnes-decedees-elasticsearch` est inventorie
  mais exclu des validations preprod;
- le snapshot contractuel est versionne par
  `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`;
- les buckets logs/stats/proofs relevent de l'observabilite lot 8, pas du
  contrat minimal de demarrage applicatif;
- `matchid-dist` est legacy et doit etre tranche avant substitution complete.

#### Inventaire initial des volumes

```text
Volume / chemin        | Usage historique          | Controle monorepo       | Statut lot 8
-----------------------+---------------------------+-------------------------+--------------------------
SCW root volume UI     | deces-ui deploy-remote    | Make racine + tools     | trancher taille/type
SCW_VOLUME_SIZE/TYPE   | via tools SCW order       | deploy-remote-instance  | avant preprod
SCW root volume        | deces-dataprep remote     | packages/deces-dataprep | trancher remote dataprep
dataprep               | large datasets            | remote-config           | avant usage
data/esdata            | Elasticsearch local       | deces-infra             | restaure depuis snapshot
                       | deces-backend/dataprep    | elasticsearch-restore   | pour preprod
data/redisdata         | Redis backend             | deces-infra redis       | etat runtime; non source
                       |                           |                         | de donnees de reference
data/proofs            | preuves backend/UI        | deces-backend           | besoin preprod a verifier
data/jobs              | jobs bulk backend/UI      | deces-backend           | besoin preprod a verifier
packages/deces-ui/     | stats servies par nginx   | deces-ui stats restore  | observabilite lot 8
stats/public           |                           |                         |
dataprep-backend/      | projets dataprep          | packages/dataprep-      | requis si remote dataprep
projects/upload/models | upload et modeles         | backend                 | est conserve
dataprep-backend/      | Postgres legacy dataprep  | packages/dataprep-      | hors chemin deces-ui;
pgdata                 |                           | backend                 | verifier si encore utile
tools/cloud/*.id       | ids instance/snapshot/    | tools remote-config     | fichiers d'etat; ne pas
                       | image SCW                 |                         | versionner
```

Conclusion d'inventaire volume:

- la preprod applicative minimale depend de `data/esdata`, `data/proofs`,
  `data/jobs`, `data/redisdata` et du volume root SCW;
- le volume de reference Elasticsearch doit venir du snapshot, pas d'un etat
  residuel d'instance;
- les volumes dataprep-backend historiques ne sont requis que si le remote
  dataprep reste dans le chemin lot 8;
- les fichiers `tools/cloud/*.id` sont des etats d'execution et ne doivent pas
  devenir des artefacts git.

#### Inventaire initial DNS, certificats, monitoring et refresh

```text
Actif / job            | Source historique        | Controle monorepo       | Statut lot 8
-----------------------+--------------------------+-------------------------+--------------------------
dev-deces.matchid.io   | deces-ui push.yml        | deploy-remote-publish   | cible preprod; derive de
                       | deploy GIT_BRANCH=dev    | APP_DNS/GIT_BRANCH      | dev + deces.matchid.io
Nginx upstream         | tools nginx-conf-*       | tools nginx-conf-apply  | a prouver sur proxy
/etc/nginx/conf.d      | via NGINX_HOST/USER      |                         | existant
Certificat TLS         | proxy nginx externe      | hors repo               | verifier avant UAT; pas
                       |                          |                         | de provision repo
CDN purge              | deces-ui push.yml        | deploy-cdn-purge-cache  | optionnel; depend secrets
                       | Cloudflare               |                         | CDN_*
Monitoring New Relic   | deces-ui deploy          | deploy-monitor + tools  | a prouver; verifier
et Fluent Bit          |                          | remote-install-monitor  | MONITOR_DIR/BUCKET
Stats full             | deces-ui logs-full.yml   | stats-full + backup     | a reconstruire ou cadrer
Stats update           | deces-ui logs-update.yml | stats-update + backup   | schedule a reconstruire
Data update trigger    | deces-ui repository_     | workflow cible lot 8    | a cadrer avec dataprep
                       | dispatch data-update     |                         |
Refresh Data.gouv      | deces-dataprep remote    | packages/deces-dataprep | a prouver si remote
                       | full/year/push-*         | remote-all              | dataprep conserve
```

Conclusion d'inventaire DNS/monitoring/refresh:

- `dev-deces.matchid.io` est produit par `GIT_BRANCH=dev` et
  `APP_DNS=deces.matchid.io`;
- le certificat TLS n'est pas provisionne dans ce repo: la validation lot 8 doit
  verifier le proxy nginx existant;
- les jobs `logs-full` et `logs-update` restent hors contrat minimal de deploy
  mais doivent etre cadres avant substitution complete;
- le refresh Data.gouv distant reste a relier au workflow cible monorepo avant
  d'ouvrir la substitution des anciens repos.

#### Arbitrage initial des cibles d'image SCW

```text
Cible make             | Source historique        | Decision lot 8          | Raison
-----------------------+--------------------------+-------------------------+--------------------------
deploy-docker-pull-    | deces-ui Makefile        | conserver comme prewarm | ne modifie pas git; utile
base                   |                          | apres instance          | pour verifier pulls
update-base-image      | Make racine deces-ui     | bloquer hors chemin     | modifie `SCW_IMAGE_ID`
                       |                          | critique preprod        | et committe aujourd'hui
SCW-instance-snapshot  | tools Makefile           | autoriser seulement via | cible bas niveau; doit
                       |                          | wrapper encadre         | rester sans commit git
SCW-instance-image     | tools Makefile           | autoriser seulement via | cible bas niveau; doit
                       |                          | wrapper encadre         | rester sans commit git
packages/deces-        | deces-dataprep           | hors preprod deces-ui   | remote dataprep se prouve
dataprep update-base-  | Makefile                 | initiale                | apres deploy applicatif
image                  |                          |                         |
```

Decision:

- `deploy-remote` preprod utilisera d'abord l'image SCW existante du monorepo;
- aucune cible `make` ne doit committer automatiquement un changement de
  `SCW_IMAGE_ID`;
- les cibles de regeneration d'image SCW seront utilisables seulement apres
  suppression ou encadrement explicite du commit automatique;
- `deploy-docker-pull-base` reste une cible de verification/prechauffage, pas
  une publication d'artefact.

#### Environnement cible `dev-deces.matchid.io`

```text
Element cible          | Valeur / contrat        | Source code actuelle    | Statut lot 8
-----------------------+-------------------------+-------------------------+--------------------------
Branche de preprod     | dev                     | GIT_BRANCH              | doit etre la branche CD
                       |                         |                         | qui declenche le deploy
DNS public             | dev-deces.matchid.io    | deploy-remote-publish   | derive de dev +
                       |                         | APP_DNS/GIT_BRANCH      | deces.matchid.io
DNS racine             | deces.matchid.io        | APP_DNS                 | valeur racine; preprod
                       |                         |                         | prefixee par branche
Instance remote        | matchid-deces-ui-dev    | tools CLOUD_HOSTNAME    | derive de APP_GROUP,
                       |                         |                         | APP=deces-ui, dev
Code distant attendu   | monorepo matchID        | a reconstruire          | gap: tools clone encore
                       | branche dev             |                         | GIT_ROOT/APP historique
Execution distante     | make deploy-local       | deploy-remote-services  | conserver la cible, mais
                       | dans le checkout cible   | remote-actions          | pointer sur monorepo
Snapshot ES            | esdata_${DATAPREP_      | deploy-remote-instance  | fourni par contrat
                       | VERSION}_${DATA_VERSION}| + deploy-local restore  | artefact lot 7
Bucket snapshot        | fichier-des-personnes-  | REPOSITORY_BUCKET       | valeur preprod dans
                       | decedees-elasticsearch- |                         | artifacts hors git
                       | dev                     |                         |
Jeu preprod minimal    | deces-2020-m[0-1][0-9] | FILES_TO_PROCESS_DEV    | reference non-prod pour
                       | .txt.gz                 |                         | refresh/snapshot
Proxy nginx            | NGINX_HOST/NGINX_USER   | deploy-remote-publish   | config hors git; ne pas
                       |                         | + tools nginx-conf-*    | exposer les valeurs
Monitoring             | MONITOR_BUCKET +        | deploy-monitor          | a valider apres deploy
                       | MONITOR_DIR             |                         |
```

Definition:

- l'UAT lot 8 cible l'URL publique `https://dev-deces.matchid.io`;
- le deploy preprod doit etre lance depuis la branche `dev` ou avec
  `GIT_BRANCH=dev`, sinon le DNS publie sera prefixe par une autre branche;
- le code execute sur l'instance preprod doit venir du monorepo, pas du repo
  historique `deces-ui`;
- les secrets, l'hote nginx, les credentials SCW, les buckets de logs et les
  tokens CDN restent hors spec: la spec documente les noms de variables, pas
  leurs valeurs.

### B. Préprod monorepo

- environnement isofonctionnel
- déploiement depuis le monorepo via `deploy-remote`
- disponibilité de l'image `backend` nécessaire au dataprep
- restauration du snapshot Elasticsearch versionné
- déploiement des images backend et UI versionnées
- tests de fumée applicatifs
- tests de rollback

### C. Runbook de bascule

- ordre de déploiement
- checks de santé
- rollback
- communication

### D. Changement de source de vérité

- monorepo devient source unique de build/release
- anciens repos passent en lecture seule ou archive
- documentation de gouvernance mise à jour

## Critères d'acceptation

- la préprod tourne sur le pipeline monorepo `deploy-remote`
- la préprod consomme le contrat d'artefacts de référence attendu
- le runbook de rollback est validé
- la prod peut être basculée avec un risque maîtrisé

## Risques

- dépendances encore cachées dans les anciens workflows
- secrets ou buckets non inventoriés
- divergence entre données de préprod et prod

## Dépendances

- [SPEC_EVOL_000](SPEC_EVOL_000_CADRAGE_MIGRATION_MONOREPO.md)
- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
