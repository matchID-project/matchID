# SPEC_EVOL_004 - Validation dev et CI monorepo

## Contexte

Le monorepo n'a pas aujourd'hui de CI racine et la validation dépend encore largement des workflows historiques package-level.

## Objectif

Introduire une validation monorepo fiable, proportionnée aux composants impactés.

## Non-objectifs

- reproduire intégralement dès le départ tous les workflows historiques
- exécuter en CI tous les scénarios cloud lourds

## Travaux

### A. Définir le périmètre de checks minimal

- `tools`: `make smoke-tools`
- `deces-backend`: `make smoke-backend`
- `deces-dataprep`: `make smoke-dataprep`
- `deces-ui`: `make smoke-ui`
- chaîne complète: `make smoke-e2e`

### B. Ajouter une CI racine

- workflow racine `.github/workflows/ci-monorepo.yml`
- jobs conditionnels par zone modifiée via `dorny/paths-filter`
- jobs `tools`, `backend`, `dataprep`, `ui`, `integration`

### C. Définir les fixtures et secrets

- fixture publique de CI: `deces-2020.txt.gz`
- calcul local de `DATA_VERSION` via `DATA_VERSION_SOURCE=local` et `packages/dataprep-backend/upload`
- warm-up UI explicite du frontend hydraté avant exécution Playwright
- aucun secret requis pour les smokes du lot 6

### D. Définir la release discipline

- checks bloquants pour merge: `tools`, `backend`, `dataprep`, `ui`, `integration`
- traçabilité: chaque job ne lance que des cibles `make`
- dépendances réseau personnelles exclues du chemin CI courant

## Etat lot 6

### Implémentation réalisée

- ajout des cibles racine `smoke-tools`, `smoke-dataprep`, `smoke-backend`, `smoke-backend-api`, `smoke-ui`, `smoke-e2e`
- ajout du workflow racine `ci-monorepo.yml`
- suppression de la dépendance CI à Data.gouv privé / storage personnel pour les smokes:
  - `tools-smoke` consomme le catalogue public Data.gouv
  - `data-version` peut être calculé localement sur les fichiers présents dans `packages/dataprep-backend/upload`
- stabilisation make-only:
  - attente Redis en infra
  - timeout Elasticsearch racine porté à `120`
  - version Playwright figée à `1.59.1`
  - cleanup explicite des marqueurs `/tmp` de dataprep smoke
  - durcissement du harness UI sur cold start frontend

### Tests exécutés

- `make smoke-tools`
  - succès
- `make data-version DATA_VERSION_SOURCE=local DATA_VERSION_INPUT_DIR=packages/dataprep-backend/upload FILES_TO_PROCESS=deces-2020.txt.gz`
  - succès
  - valeur observée: `d2d7ee21`
- `make smoke-dataprep SMOKE_FILES_TO_PROCESS=deces-2020.txt.gz`
  - succès
  - `679924 lines processed`
  - `679593 lines written`
- `MAILDEV_UI_PORT=37343 PLAYWRIGHT_VERSION=1.59.1 make frontend-test`
  - succès
  - `3/3` tests
  - `27` étapes passées
- `MAILDEV_UI_PORT=37343 PLAYWRIGHT_VERSION=1.59.1 SMOKE_FILES_TO_PROCESS=deces-2020.txt.gz make smoke-e2e`
  - succès
  - dataprep annuel 2020 exécuté
  - API locale validée en GET/POST via `smoke-backend-api`
  - UI validée sur recherche simple, recherche avancée, appariement Wikidata

### Point encore ouvert avant UAT lot 6

- la case `pipeline CI vert sur la branche d'integration` reste ouverte tant que la branche n'a pas été poussée avec ces commits et que le workflow GitHub n'a pas tourné au vert

## Critères d'acceptation

- un PR sur le monorepo obtient un statut exploitable
- la CI ne dépend pas implicitement d'un environnement personnel
- un job d'intégration minimal protège la chaîne critique

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
