# SPEC_EVOL_010 - Versionning et release monorepo `main + tags`

## Objet

Definir le modele cible de versionning et de CI/CD du monorepo apres abandon du
schema transitoire `dev/master`.

Le modele cible retenu est:

- une seule branche d'integration `main`, remplaçant `dev`;
- suppression de `master`;
- deploiement automatique de `dev-deces.matchid.io` a chaque merge sur `main`;
- promotion prod par tag Git `v*` pousse sur un commit de `main`;
- execution mensuelle du dataprep prod sur le dernier tag prod deploye, avec
  redeploiement automatique de la prod.

## Invariants Non Negociables

Le passage a `main + tags` ne doit pas modifier les artefacts de deploiement ni
les identifiants d'exploitation deja en service.

Ce qui ne change pas:

- les cibles `dev-deces.matchid.io` et `deces.matchid.io`;
- les chemins de logs S3 et la segregation `dev` / `master`;
- les noms d'upstream nginx et la cible de switch actuelle via
  `nginx-conf-apply`;
- les tags et filtres de serveurs SCW;
- la configuration New Relic / fluent-bit derivee de `dev` / `master`;
- la sequence de publication reseau actuelle:
  `remote-test-api-in-vpc -> nginx-conf-apply -> remote-test-api -> purge CDN`.

Ce qui change:

- la branche GitHub d'integration: `main`;
- la promotion prod: par tag `v*` au lieu d'un merge sur `master`;
- les workflows CI/CD GitHub associes.

## Decision

Le monorepo se pilote desormais avec deux notions distinctes:

```text
Objet                  | Role
-----------------------+--------------------------------------------------------------
APP_RELEASE            | version applicative figee par un tag Git de release prod
SNAPSHOT               | snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`
```

Le deploiement effectif devient:

```text
DEPLOY = (APP_RELEASE, SNAPSHOT)
```

Le systeme doit permettre:

- de faire evoluer l'application seule et redeployer la prod avec le snapshot
  deja en service;
- de faire evoluer la data seule et redeployer la prod avec le dernier
  `APP_RELEASE` prod;
- de faire evoluer application et data ensemble sur une meme release prod.

## Separation Ref Git / Label Runtime

Le ref Git reel et le label runtime historique doivent etre separes
strictement.

Contrat retenu:

```text
Notion                 | Valeur preprod           | Valeur prod
-----------------------+--------------------------+-----------------------------
ref Git source         | `main`                   | tag `vYYYY.MM.DD.N`
label runtime          | `dev`                    | `master`
```

Pour limiter le risque avant la premiere MEP:

- `GIT_BRANCH` est conserve comme variable legacy de label runtime;
- `GIT_BRANCH=dev` reste la valeur attendue en preprod;
- `GIT_BRANCH=master` reste la valeur attendue en prod;
- le ref Git reel de deploiement est porte par `REMOTE_DEPLOY_BRANCH` et les
  variables `REMOTE_*_BRANCH`.

Autrement dit:

- merge sur `main` vers preprod:
  - `GIT_BRANCH=dev`
  - `REMOTE_DEPLOY_BRANCH=main`
- tag `v*` vers prod:
  - `GIT_BRANCH=master`
  - `REMOTE_DEPLOY_BRANCH=<tag>`

Cette conservation de `GIT_BRANCH` est volontairement transitoire. Le renommage
vers une variable plus saine est reporte apres la premiere MEP reussie.

## Etat Du Premier Slice Executable

Le premier slice executable du modele cible est partiellement code dans le
monorepo:

- `ci.yml` cible deja `pull_request -> main` et `push -> main`;
- `cd.yml` ne porte plus que la preprod `main`, les snapshots dev et le
  deploy `dev-deces.matchid.io`;
- `release-prod.yml` porte deja la promotion prod par tag `v*`;
- le chemin de publication reseau reste
  `remote-test-api-in-vpc -> nginx-conf-apply -> remote-test-api -> purge CDN`;
- le `Makefile` racine accepte
  `DATAPREP_VERSION_OVERRIDE` / `DATA_VERSION_OVERRIDE` pour redeployer un
  snapshot existant sans recalculer la data courante.

Ce premier slice ne ferme pas encore la migration cible:

- la separation stricte ref Git / label runtime est maintenant appliquee sur
  les chemins workflow qui publient et deploient en preprod/prod;
- `changesets` n'est pas encore execute end-to-end;
- `packages/dataprep-backend/VERSION` est introduit comme source de verite,
  mais pas encore branche sur un commit de release complet;
- le dataprep mensuel auto-redeploy reste ouvert et devra vivre dans un
  workflow dedie.

## Unites de versionning

Toutes les unites du monorepo ne suivent pas la meme source de version.

```text
Composant            | Nature                   | Source de version cible                 | Tag dedie
---------------------+--------------------------+-----------------------------------------+---------------------------
deces-ui             | app Node                 | `package.json`, pilote via `make`       | `deces-ui/vX.Y.Z`
deces-backend        | app Node                 | `package.json`, pilote via `make`       | `deces-backend/vX.Y.Z`
dataprep-frontend    | app Node                 | `package.json`, pilote via `make`       | `dataprep-frontend/vX.Y.Z`
dataprep-backend     | app Python               | fichier `VERSION` dedie                 | `dataprep-backend/vX.Y.Z`
deces-dataprep       | recette / data pipeline  | `DATAPREP_VERSION` + `DATA_VERSION`     | pas de tag semver requis
tools                | outillage infra          | SHA git / tags Docker existants         | pas de tag semver requis
release prod         | stack deployable         | tag Git de stack                        | `vYYYY.MM.DD.N`
```

Notes:

- `deces-dataprep` ne doit pas etre force artificiellement dans un semver
  applicatif: la version metier utile reste le couple
  `DATAPREP_VERSION` / `DATA_VERSION`;
- `tools` reste une dependance de build/runtime, pas une release applicative
  autonome;
- `dataprep-backend` n'ayant pas de `package.json`, la cible propre est un
  fichier `packages/dataprep-backend/VERSION` versionne dans Git, avant
  migration eventuelle vers `pyproject.toml`.

## Regles de versionning

### Packages Node

Les packages Node versionnes (`deces-ui`, `deces-backend`,
`dataprep-frontend`) gardent une version independante par package.

Regles:

- la source de verite reste le champ `version` de chaque `package.json`;
- toute PR qui touche un package versionne doit deja porter la version finale
  qui sera testee sur `dev-deces.matchid.io` puis taguee en prod si l'UAT est
  validee;
- les operations de controle et de bump de version sont orchestrees via
  cibles `make`, avec au minimum:
  - `make package-versions`
  - `make package-version PACKAGE=<name>`
  - `make package-version-set PACKAGE=<name> VERSION=<x.y.z>`;
- aucun commit de release-prep separe n'est autorise apres le merge sur
  `main`;
- si `changesets` est conserve comme helper technique pour les packages Node,
  il doit rester encapsule derriere `make` et ne pas changer le contrat
  operatoire.

### Package Python `dataprep-backend`

`dataprep-backend` suit un versionning independant, mais hors `changesets`.

Regles:

- un fichier `packages/dataprep-backend/VERSION` devient la source de verite
  semantique;
- le premier jalon de migration cree ce fichier avec la base courante `0.4.0`;
- son bump intervient dans la PR mergee sur `main`, sur le meme commit qui sera
  teste en preprod puis eventuellement tague en prod;
- le `Makefile` continue de produire les aliases SHA utilises en dev/CI, mais
  la release semantique publiee est le contenu de `VERSION`;
- le tag package dedie est `dataprep-backend/vX.Y.Z`.

### Data pipeline

`deces-dataprep` conserve son contrat actuel:

- `DATAPREP_VERSION` derive du contenu de la recette et du dataset;
- `DATA_VERSION` derive des donnees source;
- le snapshot publie reste
  `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`.

Le dataprep ne consomme pas `changesets` et ne cree pas de tag package semver.

## Convention de tags

Deux familles de tags coexistent.

### Tags package

Ils servent a figer les versions des composants applicatifs versionnes.

```text
deces-ui/v1.8.0
deces-backend/v2.3.1
dataprep-frontend/v1.1.0
dataprep-backend/v0.9.4
```

Regles:

- ils pointent tous vers un commit de `main`;
- plusieurs tags package peuvent pointer vers le meme commit;
- ils doivent refleter des versions deja ecrites dans le code du commit tague;
- ils documentent les versions, mais ne declenchent pas directement le deploy
  prod.

### Tags de release prod

Ils pilotent la promotion prod.

Convention retenue:

```text
vYYYY.MM.DD.N
```

Exemple:

```text
v2026.04.25.1
```

Regles:

- un tag prod doit pointer vers un commit reachable depuis `main`;
- il est cree manuellement apres validation UAT smoke sur
  `dev-deces.matchid.io`, via GitHub ou sur demande explicite;
- il declenche la release prod;
- il reference implicitement les versions package presentes dans le commit
  pointe;
- il devient la reference de `APP_RELEASE` pour la prod;
- le dernier tag prod deploye devient la base des runs dataprep mensuels;
- un tag prod est un tag Git simple, pas une branche additionnelle.

## Source de verite prod

Le "dernier tag prod" ne doit pas etre defini par simple ordre lexical ou date
de creation Git.

Source de verite cible:

- le dernier deploiement GitHub `prod` reussi;
- le workflow de release exporte comme artefact `release-prod-metadata`:
  - `prod_tag`
  - `commit_sha`
  - `snapshot_name`
  - `deces_ui_version`
  - `deces_backend_version`
  - `dataprep_backend_version`
  - `dataprep_frontend_version`

Le dataprep mensuel et les redeploiements data-only doivent resoudre ce dernier
tag prod reussi avant de lancer quoi que ce soit.

## Cycle CI/CD cible

### 1. PR vers `main`

```text
Evenement            | Workflow cible | Effet
---------------------+----------------+-------------------------------------------------
pull_request -> main | `ci.yml`       | checks de validation path-based, aucun deploy
```

Objectif:

- valider les changements par composant;
- garder `main` mergeable;
- ne jamais publier/deployer la prod sur PR.

### 2. Merge sur `main`

```text
Evenement      | Workflow cible | Effet
---------------+----------------+-------------------------------------------------------------
push sur main  | `cd.yml`       | build/publish artefacts candidats + snapshots dev + deploy preprod
```

Regles generales:

- le code source est `main`;
- le label runtime reste `dev`;
- les artefacts de deploiement doivent donc rester nommes exactement comme
  aujourd'hui cote exploitation.

#### 2.a Scenarios de declenchement preprod

```text
Changement                         | Effet sur `main`
-----------------------------------+-----------------------------------------------------------
deces-ui seul                      | build/publish `deces-ui` puis deploy preprod
deces-backend seul                 | build/publish `deces-backend` puis deploy preprod
tools                              | `small` puis `year`, puis deploy preprod
deces-dataprep                     | `small` puis `year`, puis deploy preprod
dataprep-backend                   | publish `matchid-backend`, puis `small`, puis `year`, puis deploy preprod
dataprep-frontend seul             | cycle propre dataprep-frontend, pas de deploy `deces-ui`
mixte app + dataprep               | sequence unique: artefacts, `small`, `year`, puis deploy preprod
```

Contraintes:

- si `tools`, `deces-dataprep` ou `dataprep-backend` changent, le deploy
  preprod de `deces-ui` ne doit partir qu'apres succes de `small` puis `year`;
- si `year` echoue, il n'y a pas de deploy preprod;
- `dataprep-frontend` seul n'est pas un motif suffisant pour redeployer
  `deces-ui`.

#### 2.b Mecanisme de publication reseau

Le schema cible conserve le mecanisme actuel:

```text
1. remote-test-api-in-vpc
2. nginx-conf-apply
3. remote/public healthcheck via le hostname expose
4. purge de cache CDN
```

Autrement dit:

- l'instance candidate reste preparee de la meme maniere;
- le point de bascule reseau reste le serveur nginx actuel;
- la purge CDN reste un post-traitement de publication, pas le mecanisme de
  bascule lui-meme.

### 3. Tag prod `v*`

```text
Evenement          | Workflow cible         | Effet
-------------------+------------------------+----------------------------------------------------------
push tag `v*`      | `release-prod.yml`     | promotion prod depuis un commit de `main`
```

Regles generales:

- le code source est le tag pousse;
- le label runtime reste `master`;
- les artefacts de deploiement doivent donc rester nommes exactement comme
  aujourd'hui cote prod.

Le workflow de tag prod suit cette logique:

1. verifier que le tag pointe sur un commit reachable depuis `main`;
2. resoudre le dernier tag prod reussi precedent;
3. comparer le tag courant au precedent;
4. si le diff touche la pile dataprep
   (`deces-dataprep`, `dataprep-backend`, `tools`, chemins infra associes):
   - lancer `dataprep-full` sur le tag courant;
   - deployer la prod avec les images du tag courant, le nouveau snapshot et le
     switch nginx actuel;
5. si le diff ne touche que `dataprep-frontend`:
   - publier ses artefacts si necessaire;
   - ne pas declencher a lui seul un deploy `deces-ui`;
6. sinon:
   - reutiliser le dernier snapshot prod valide;
   - deployer la prod avec les images du tag courant, le snapshot courant et le
     switch nginx actuel.

Ce comportement preserve les deux cas historiques:

- release applicative seule;
- release applicative + data.

### 4. Dataprep mensuel prod

```text
Evenement            | Workflow cible             | Effet
---------------------+----------------------------+---------------------------------------------------------
schedule mensuel     | `dataprep-monthly.yml`     | full sur dernier tag prod puis redeploiement prod auto
workflow_dispatch    | `dataprep-monthly.yml`     | meme logique, declenchement manuel
```

Comportement cible:

1. resoudre le dernier tag prod reussi;
2. checkout de ce tag;
3. executer `dataprep-full` avec le code exact de ce tag;
4. publier le nouveau snapshot;
5. redeployer automatiquement la prod avec:
   - `APP_RELEASE = dernier tag prod`
   - `SNAPSHOT = nouveau snapshot`
   - `publish switch = via nginx-conf-apply sur la nouvelle instance preparee`
   - `GIT_BRANCH=master`
6. persister un artefact `dataprep-monthly-metadata` avec le tag et le
   snapshot effectivement redeployes;
7. en cas d'echec, emettre une alerte seule, sans retry automatique.

Ce workflow est la transposition du fonctionnement upstream mensuel: la data
evolue, l'application reste figee sur la derniere release prod.

## Cas operatoires cibles

### Evol dataprep seule

```text
1. Merge sur `main`
2. `small` puis `year`
3. Deploy automatique sur `dev-deces`
4. Validation preprod
5. Si besoin prod immediat:
   - tag manuel `v*`, puis `full`, puis deploy prod
   - ou attendre le mensuel automatique
```

### Evol deces-ui / deces-backend seule

```text
1. Merge sur `main`
2. Deploy automatique sur `dev-deces`
3. Validation preprod
4. Tag manuel `v*` sur le commit deja valide
5. Creation eventuelle des tags package sur ce meme commit
6. Le tag prod redeploie la prod avec le snapshot courant
```

### Evol dataprep + application

```text
1. Merge sur `main`
2. Artefacts necessaires
3. `small`
4. `year`
5. Deploy automatique sur `dev-deces`
6. Validation preprod
7. Tag manuel `v*`
9. `dataprep-full`
10. Deploy prod
```

### Rollback

```text
1. Identifier le dernier tag prod connu bon
2. Redeployer ce tag avec son snapshot associe
3. Si rollback data seul, relancer `dataprep-monthly.yml` sur ce tag
```

## Gouvernance GitHub cible

Le modele GitHub final devient:

```text
feature branch -> PR vers main -> merge main -> tag v* -> deploy prod
```

Regles:

- `main` devient la branche par defaut;
- `master` est supprimee;
- `main` est protegee avec checks CI requis;
- des protections de tags s'appliquent sur:
  - `v*`
  - `deces-ui/v*`
  - `deces-backend/v*`
  - `dataprep-frontend/v*`
  - `dataprep-backend/v*`
- seuls les mainteneurs autorises peuvent creer/pousser les tags prod.

## Impact sur les workflows existants

Le schema final implique:

- renommage des triggers `dev` -> `main`;
- suppression des triggers `master`;
- alignement du workflow de release prod sur `push.tags = v*`;
- creation d'un workflow mensuel `schedule`/`workflow_dispatch`;
- conservation du switch `nginx-conf-apply` dans `packages/tools` /
  `deploy-remote` sur le chemin critique;
- conservation stricte de `GIT_BRANCH=dev/master` dans les artefacts
  d'exploitation avant la premiere MEP;
- la bascule CDN complete reste une evolution de roadmap hors lot 9.

## Sort des specs intermediaires

Les specs suivantes documentent un etat de transition utile pour l'historique,
mais ne doivent plus etre traitees comme cible finale:

- [SPEC_EVOL_008](SPEC_EVOL_008_BASCULE_SUBSTITUTION_MONOREPO.md)
- [SPEC_EVOL_009](SPEC_EVOL_009_GOUVERNANCE_GITHUB_MONOREPO.md)

La cible finale de bascule/release est desormais la presente spec.
