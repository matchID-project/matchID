# SPEC_EVOL_002 - Normalisation du runtime monorepo

## Contexte

Le dépôt agrège bien l'historique, mais le contrat d'exécution n'est pas stabilisé:

- `deces-dataprep` clone encore `backend`
- `deces-dataprep` appelle `backend/tools`
- `deces-backend` embarque encore un `tools/` local
- les cibles package-level dépendent de variables exportées par la racine
- le bootstrap racine reste partiellement couplé à des artefacts et fichiers d'état externes

## Objectif

Faire du monorepo la seule source nécessaire au build et au run en local.

## Non-objectifs

- réécrire toute la couche Makefile
- remplacer immédiatement tous les scripts shell par un autre orchestrateur

## Décisions de design à figer

1. Exécution de référence:
   - soit uniquement depuis la racine
   - soit racine + exécution autonome par package
2. Ownership de l'infra:
   - `deces-infra` porte Elasticsearch, Redis, SMTP et snapshots
3. Ownership des opérations cloud:
   - `tools` reste central au début
4. Ownership des données:
   - emplacement unique des fichiers versionnés et des états `.data.sha1` / `.dataprep.sha1`

## Travaux

### A. Supprimer les clones croisés

- retirer le `git clone backend` dans `packages/deces-dataprep/Makefile`
- remplacer les chemins `backend/tools` par `packages/tools`
- remplacer les hypothèses multi-repos par des chemins monorepo explicites

### B. Supprimer les duplications

- supprimer ou neutraliser `packages/deces-backend/tools`
- éviter tout doublon fonctionnel entre `packages/tools` et copies héritées

### C. Clarifier les contrats de variables

- variables portées par la racine
- variables portées par chaque package
- variables infra communes
- stratégie de surcharge locale hors git

### D. Stabiliser les fichiers d'état et de version

- décider du rôle de `tagfiles.version` à la racine
- décider de la source de vérité pour `.data.sha1` et `.dataprep.sha1`
- éviter les dépendances implicites à des fichiers créés manuellement

### E. Terminer l'extraction infra

- déplacer Redis et SMTP vers `deces-infra`
- réduire le rôle de `deces-backend` à l'API et ses assets runtime

## Critères d'acceptation

- aucun package ne clone un dépôt externe pour fonctionner en dev
- aucun package ne dépend d'un doublon `tools` local
- le contrat de variables et de chemins est documenté et stable
- la racine permet un bootstrap cohérent

## Risques

- casser les usages historiques package-level
- déplacer trop de responsabilités à la fois
- masquer un besoin réel de standalone package derrière une simplification excessive

## Dépendances

- [SPEC_EVOL_001](SPEC_EVOL_001_RATTRAPAGE_UPSTREAM_REFERENCES.md)
- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
