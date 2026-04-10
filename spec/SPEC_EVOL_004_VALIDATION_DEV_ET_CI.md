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

- `deces-backend`: lint, build, tests unitaires/intégration légères
- `deces-ui`: install, build, smoke UI ou tests ciblés
- `deces-dataprep`: validations de config/regex/recipe et smoke ciblé
- `tools`: lint shell léger ou smoke script ciblé

### B. Ajouter une CI racine

- jobs par package
- déclenchement conditionnel selon chemins modifiés
- job d'intégration de chaîne minimal

### C. Définir les fixtures et secrets

- ce qui peut être mocké
- ce qui doit rester en secret store
- ce qui ne doit plus dépendre du fichier `artifacts` local

### D. Définir la release discipline

- artefacts par package
- traçabilité version package -> commit monorepo
- documentation des checks bloquants pour merge

## Critères d'acceptation

- un PR sur le monorepo obtient un statut exploitable
- la CI ne dépend pas implicitement d'un environnement personnel
- un job d'intégration minimal protège la chaîne critique

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
