# SPEC_EVOL_012 - DAG CD des artefacts et du deploiement

## Contexte

Le monorepo publie maintenant les artefacts et deploie `dev-deces.matchid.io`
depuis `main`, mais le graphe de dependances CD n'est pas encore explicite dans
le workflow.

Le symptome principal est connu:

- un job dataprep peut partir avant que l'image `matchid-backend` du meme
  commit soit effectivement disponible.

Ce probleme ne vient pas du contrat Make local, deja realigne. Il vient du DAG
GitHub Actions.

## Probleme

Les ecarts observes au depart de ce chantier sont:

1. `Publish dataprep small snapshot` ne depend pas explicitement de
   `Publish matchid-backend image`.
2. `Publish dataprep year snapshot` ne depend pas explicitement de
   `Publish matchid-backend image`.
3. Le `deploy` depend de plus de jobs que ses vraies dependances runtime.
4. Le workflow melange publication, reuse/no-op et orchestration dans des jobs
   difficiles a raisonner.

## Objectif

Definir un DAG CD explicite qui:

- garantit la disponibilite du bon artefact au bon moment;
- encode les vraies dependances runtime;
- remplace les races par des jobs `ensure-*` toujours presents;
- reste pilote directement par `tagfiles.version`, sans detecteur repo dedie.

## Non-objectifs

- changer le modele de release prod lui-meme;
- refondre les cibles Make;
- traiter ici la perf infra SCW du dataprep.

## Graphe cible des artefacts

Le bon graphe n'est pas une simple chaine lineaire de build.

### Artefacts independants

Ces artefacts ont leur propre cycle de build/publish:

- `matchid-backend`
- `matchid-frontend`
- `deces-backend`
- `deces-ui`

### Artefact compose

Le snapshot dataprep depend de:

- l'image `matchid-backend`

### Dependances runtime du deploy

Le deploy `deces.matchid.io` ou `dev-deces.matchid.io` depend de:

- l'image `deces-backend`
- l'image `deces-ui`
- le snapshot dataprep a restaurer

Le deploy ne depend pas runtime de:

- `matchid-frontend`
- `small snapshots`

sauf si un besoin d'exploitation explicite l'impose plus tard.

## Jobs cibles

Le workflow CD doit utiliser des jobs `ensure-*` toujours presents.

Liste cible:

- `ensure-matchid-backend-image`
- `ensure-matchid-frontend-image`
- `ensure-deces-backend-image`
- `ensure-deces-ui-image`
- `ensure-dataprep-small-snapshot`
- `ensure-dataprep-year-snapshot`
- `deploy-dev`

Chaque job `ensure-*` decide en interne:

- `publish`
- ou `reuse/no-op`

mais ne disparait jamais du DAG.

## DAG cible

### Dataprep

- `ensure-dataprep-small-snapshot` needs `ensure-matchid-backend-image`
- `ensure-dataprep-year-snapshot` needs `ensure-matchid-backend-image`

Invariant:

- un snapshot dataprep ne doit jamais partir avant la disponibilite de l'image
  `matchid-backend` correspondant au commit courant.

### Deploy dev

- `deploy-dev` needs:
  - `ensure-deces-backend-image`
  - `ensure-deces-ui-image`
  - `ensure-dataprep-year-snapshot`

Invariant:

- le deploy attend uniquement ses dependances runtime reelles.

## Semantique de no-op

Un job `ensure-*` doit toujours produire un resultat exploitable, meme quand il
ne republie rien.

Semantique attendue:

- sortie `published=true|false`
- version d'artefact resolue dans tous les cas
- logs distinguant clairement:
  - `publish`
  - `reuse`
  - `skip because unchanged but version already available`

But:

- garder un DAG lisible;
- eviter les effets de bord de `needs` sur des jobs absents ou `skipped`.

## Articulation avec la resolution des changements

Le CD doit consommer les memes flags d'artefact que la CI, definis dans
[SPEC_EVOL_011_CI_ARTIFACT_CONTRACT](SPEC_EVOL_011_CI_ARTIFACT_CONTRACT.md).

Usage:

- `artifact_*` est calcule inline dans le workflow a partir de `make version-files`;
- `artifact_*` decide si le job `ensure-*` doit publier ou reuser;
- le DAG `needs` decide l'ordre d'execution;
- le deploy ne depend jamais d'un glob de fichiers, seulement d'artefacts et de
  snapshots resolves.

## Extension a `release-prod`

Le meme modele doit s'appliquer ensuite a `release-prod`:

- la decision `full` ne doit plus etre derivee d'un `git diff` ad hoc;
- la production du snapshot prod depend de `matchid-backend`;
- le deploy prod depend du snapshot requis + `deces-backend` + `deces-ui`;
- les jobs doivent rester `ensure-*`, pas des branches conditionnelles
  difficilement lisibles.

### Lot 2 cible

Le second lot ne doit pas reouvrir tout `release-prod`. Il doit seulement
aligner sa structure sur le modele deja pose dans `cd.yml`.

Jobs cibles:

- `ensure-matchid-backend-image-prod`
- `ensure-prod-snapshot`
- `deploy-prod`
- `publish-release-prod-metadata`

### DAG cible du lot 2

- `ensure-prod-snapshot` needs `ensure-matchid-backend-image-prod`
- `deploy-prod` needs:
  - `ensure-prod-snapshot`
  - `ensure-deces-backend-image` ou sa resolution equivalente dans le workflow
  - `ensure-deces-ui-image` ou sa resolution equivalente dans le workflow
- `publish-release-prod-metadata` needs `deploy-prod`

### Semantique cible du lot 2

`ensure-matchid-backend-image-prod`

- publie si `artifact_matchid_backend=true`;
- reuse/no-op sinon;
- expose la version d'image resolue dans tous les cas.

`ensure-prod-snapshot`

- lance un vrai `full` si:
  - `artifact_dataprep_snapshot=true`
  - ou `artifact_matchid_backend=true`
  - ou un changement runtime explicite impose de revalider la chaine dataprep
- reuse le snapshot precedent sinon;
- expose `snapshot_name`, `dataprep_version`, `data_version` dans tous les cas.

`deploy-prod`

- ne consomme que:
  - `snapshot_name`
  - `dataprep_version`
  - `data_version`
  - `deces-backend`
  - `deces-ui`
- ne redecide pas lui-meme s'il faut un `full`.

`publish-release-prod-metadata`

- reste un job terminal;
- publie les metadata de release seulement apres succes du deploy;
- ne porte aucune logique de decision sur les artefacts.

### Non-objectifs du lot 2

- ne pas changer les secrets;
- ne pas changer la strategie de tag prod;
- ne pas traiter ici la perf dataprep remote;
- ne pas reouvrir la logique de build/version des artefacts.

## Matrice de validation attendue

Cas minimum a verifier:

- `packages/dataprep-backend/**` seul
- `packages/deces-dataprep/**` seul
- `packages/deces-backend/**` seul
- `packages/deces-ui/**` seul
- `packages/tools/**` seul
- workflow files seuls
- `packages/dataprep-backend/** + packages/deces-dataprep/**`

Pour chaque cas, la validation doit tracer:

- artefacts republies ou reuses;
- ordre effectif des jobs;
- absence de race `matchid-backend -> dataprep`;
- dependances effectives du deploy;
- absence de rebuild/publish inutile quand `tag-VERSION` ne change pas.
