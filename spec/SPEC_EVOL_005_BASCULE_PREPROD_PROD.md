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
- le triplet d'artefacts de référence est:
  - image `deces-backend`
  - image `deces-ui`
  - snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
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

### B. Préprod monorepo

- environnement isofonctionnel
- déploiement depuis le monorepo via `deploy-remote`
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
- la préprod consomme le triplet d'artefacts de référence attendu
- le runbook de rollback est validé
- la prod peut être basculée avec un risque maîtrisé

## Risques

- dépendances encore cachées dans les anciens workflows
- secrets ou buckets non inventoriés
- divergence entre données de préprod et prod

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
