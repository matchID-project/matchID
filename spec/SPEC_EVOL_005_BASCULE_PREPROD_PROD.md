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
