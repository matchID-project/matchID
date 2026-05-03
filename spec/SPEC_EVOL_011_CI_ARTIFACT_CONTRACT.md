# SPEC_EVOL_011 - Contrat CI d'invalidation d'artefacts

## Contexte

La CI du monorepo melangeait jusque-la deux sujets differents:

- l'invalidation d'artefact;
- le rerun des tests quand l'orchestration ou l'infra change.

Le pivot pris vers un detecteur Python repo-wide est inutilement complexe pour
ce besoin. L'intention de depart etait plus simple:

- `tagfiles.version` est la source unique des entrees d'artefact;
- la logique doit rester lisible directement dans les workflows;
- la chaine `matchid-backend -> dataprep -> deces-backend -> deces-ui` doit se
  lire dans les conditions des jobs, pas dans un moteur de regles externe.

## Probleme

Les ecarts a corriger sont:

1. `packages/dataprep-backend/tagfiles.version` n'incluait pas `VERSION`.
2. le snapshot dataprep n'avait pas de `tagfiles.version` dedie;
3. `ci.yml` utilisait des globs larges qui ne correspondaient pas au vrai
   contrat d'artefact;
4. la proposition de detecteur repo dedie ajoutait de la complexite sans gain
   suffisant.

## Objectif

Definir un contrat CI dans lequel:

- les flags `artifact_*` sont calcules directement depuis `tagfiles.version`;
- le workflow reste autoportant, sans script detecteur dedie;
- les dependances de chaine sont exprimees explicitement dans les `if:` des jobs
  existants.

## Non-objectifs

- ajouter un moteur de regles repo-wide;
- introduire un job `stack-integration` dedie dans ce lot;
- refondre le runtime local.

## Contrat d'invalidation des artefacts

Pour chaque artefact versionne, le flag `artifact_*` vaut `true` si et
seulement si un fichier du `tagfiles.version` correspondant a change.

Le calcul se fait directement dans le workflow:

1. calcul du range Git utile;
2. liste des fichiers modifies;
3. `make -s -C <package> version-files`;
4. comparaison directe entre ces fichiers et le diff Git.

## Cas cibles

`artifact_matchid_backend`

- source: `packages/dataprep-backend/tagfiles.version`
- correction requise: `VERSION` doit etre present dans ce fichier

`artifact_matchid_frontend`

- source: `packages/dataprep-frontend/tagfiles.version`

`artifact_deces_backend`

- source: `packages/deces-backend/tagfiles.version`

`artifact_deces_ui`

- source: `packages/deces-ui/tagfiles.version`

`artifact_dataprep_snapshot`

- source: `packages/deces-dataprep/tagfiles.version`

## Signal d'integration

Le rerun d'integration ne doit pas etre deduit d'un faux changement de
`tag-VERSION`.

On garde donc un signal separe:

- `integration_stack`

Ce signal reste volontairement simple et explicite. Il vaut `true` si le diff
contient au moins un changement dans:

- `Makefile`
- `packages/tools/**`
- `packages/deces-infra/**`
- `scripts/**`
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `.github/workflows/release-prod.yml`

Ce signal n'est pas derive des flags `artifact_*`.

## Contrat des jobs CI

Le lot courant ne rajoute pas de nouveau job d'integration global.

La chaine est exprimee en elargissant les conditions des jobs existants:

- `dataprep-backend pull request test`
  - `artifact_matchid_backend || integration_stack`
- `dataprep-frontend pull request test`
  - `artifact_matchid_frontend || artifact_matchid_backend || integration_stack`
- `deces-dataprep locally`
  - `artifact_dataprep_snapshot || artifact_matchid_backend || integration_stack`
- `deces-backend build/tests/artillery`
  - `artifact_deces_backend || artifact_dataprep_snapshot || artifact_matchid_backend || integration_stack`
- `deces-ui pull request test`
  - `artifact_deces_ui || artifact_deces_backend || artifact_dataprep_snapshot || artifact_matchid_backend || integration_stack`

But:

- si `matchid-backend` change, on rerun le dataprep puis les validations aval;
- si seul `deces-ui` change, on ne rerun pas toute la chaine inutilement;
- si `tools` ou l'orchestration changent, on rerun les jobs impacts sans
  pretendre qu'un artefact a change.

## Partage de l'image `matchid-backend` en CI

Le job `dataprep-backend pull request test` est la source canonique de l'image
`matchid-backend` dans la CI.

Contrat cible:

1. le job prepare l'image via `docker-check || build`;
2. il execute les tests backend dataprep sur cette image;
3. si les tests passent, il exporte l'image Docker comme artefact GitHub
   Actions;
4. les jobs aval qui ont besoin de `matchid-backend` la rechargent via
   `docker load` au lieu de la recalculer.

Jobs consommateurs dans ce lot:

- `deces-dataprep locally`
- `dataprep-frontend pull request test`

But:

- supprimer le rebuild/redownload redondant de `matchid-backend` entre jobs;
- garantir que le dataprep small ne s'execute pas sur un backend dataprep non
  teste;
- garder un seul job canonique pour la production de cette image dans la PR.

Non-objectif dans ce lot:

- scinder `dataprep-backend pull request test` en jobs `build-image` et `tests`.

## Regle de build

Dans les jobs CI qui consomment des images:

- on commence par `docker-check || build`;
- on ne rebuild pas si le tag existe deja.

## Matrice de validation attendue

Cas minimum a verifier:

- `packages/tools/**` seul
- `packages/dataprep-backend/**` seul
- `packages/deces-dataprep/**` seul
- `packages/deces-backend/**` seul
- `packages/deces-ui/**` seul
- workflow files seuls
- `packages/dataprep-backend/** + packages/deces-dataprep/**`

Pour chaque cas, la validation doit tracer:

- les flags `artifact_*`;
- la valeur de `integration_stack`;
- les jobs CI declenches;
- les jobs CI skippes;
- les rebuilds evites ou effectifs.
