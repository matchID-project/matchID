# SPEC_EVOL_010 - Versionning et release monorepo `main + tags`

## Objet

Definir le modele cible de versionning et de CI/CD du monorepo apres abandon du
schema transitoire `dev/master`.

Le modele cible retenu est:

- une seule branche d'integration `main`, remplaçant `dev`;
- suppression de `master`;
- deploiement automatique de `dev-deces.matchid.io` a chaque merge sur `main`;
- promotion prod par tag pousse sur un commit de `main`;
- execution mensuelle du dataprep prod sur le dernier tag prod deploye, avec
  redeploiement automatique de la prod.

## Decision

Le monorepo se pilote desormais avec deux notions distinctes:

```text
Objet                  | Role
-----------------------+--------------------------------------------------------------
APP_RELEASE            | version applicative figée par un tag Git de release prod
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

Le pivot de publication reseau est egalement acte:

- le switch de trafic ne passera plus par l'edition du fichier upstream nginx
  via bastion;
- le switch passera par une bascule CDN pilotee par API;
- les tests de bascule pourront etre executes sur un sous-domaine dedie avant
  toute utilisation sur `deces.matchid.io`.

## Unites de versionning

Toutes les unites du monorepo ne suivent pas la meme source de version.

```text
Composant            | Nature                   | Source de version cible                 | Tag dedie
---------------------+--------------------------+-----------------------------------------+------------------------
deces-ui             | app Node                 | `package.json` + changesets             | `deces-ui/vX.Y.Z`
deces-backend        | app Node                 | `package.json` + changesets             | `deces-backend/vX.Y.Z`
dataprep-frontend    | app Node                 | `package.json` + changesets             | `dataprep-frontend/vX.Y.Z`
dataprep-backend     | app Python               | fichier `VERSION` dedie                 | `dataprep-backend/vX.Y.Z`
deces-dataprep       | recette / data pipeline  | `DATAPREP_VERSION` + `DATA_VERSION`     | pas de tag semver requis
tools                | outillage infra          | SHA git / tags Docker existants         | pas de tag semver requis
release prod         | stack deployable         | tag Git de stack                        | `prod/vYYYY.MM.DD.N`
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
`dataprep-frontend`) utilisent `changesets`.

Regles:

- les PR metier modifient le code et ajoutent un fichier `.changeset/*.md`;
- les PR ne modifient pas manuellement les champs `version` des `package.json`;
- un commit de preparation de release sur `main` execute `changeset version`,
  met a jour les `package.json` et les changelogs, puis est merge/pousse avant
  creation du tag prod;
- les tags package dedies pointent vers ce commit de preparation de release.

### Package Python `dataprep-backend`

`dataprep-backend` suit un versionning independant, mais hors `changesets`.

Regles:

- un fichier `packages/dataprep-backend/VERSION` devient la source de verite
  semantique;
- son bump intervient dans le meme commit de preparation de release que les
  versions Node;
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
- ils documentent les versions, mais ne declenchent pas directement le deploy
  prod.

### Tags de release prod

Ils pilotent la promotion prod.

Convention retenue:

```text
prod/vYYYY.MM.DD.N
```

Exemple:

```text
prod/v2026.04.25.1
```

Regles:

- un tag prod doit pointer vers un commit reachable depuis `main`;
- il declenche la release prod;
- il reference implicitement les versions package presentes dans le commit
  pointe;
- il devient la reference de `APP_RELEASE` pour la prod;
- le dernier tag prod deploye devient la base des runs dataprep mensuels.

## Source de verite prod

Le "dernier tag prod" ne doit pas etre defini par simple ordre lexical ou date
de creation Git.

Source de verite cible:

- le dernier deploiement GitHub `prod` reussi;
- le workflow de release exporte comme metadata:
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
push sur main  | `cd.yml`       | build/publish artefacts candidats + deploy `dev-deces`
```

Comportement cible:

- publication des images applicatives impactees;
- snapshots dev `small` / `year` selon les changements dataprep;
- deploiement automatique de `dev-deces.matchid.io`;
- aucun deploy prod.

`main` devient donc la branche unique de preprod/integration.

### 2.b Mecanisme de publication reseau

Le schema transitoire actuel s'appuie encore sur:

- test applicatif depuis le VPC;
- ecriture d'un upstream nginx distant via `nginx-conf-apply`;
- verification publique apres reload nginx;
- purge de cache CDN.

La cible finale remplace cette etape par:

```text
1. remote-test-api-in-vpc
2. CDN switch sur un enregistrement proxifie
3. remote/public healthcheck via le hostname expose
4. purge de cache CDN
```

Autrement dit:

- l'instance candidate reste preparee de la meme maniere;
- la publication reseau ne depend plus d'un bastion nginx comme point de
  bascule;
- la bascule de trafic se fait en modifiant la cible CDN/DNS du hostname.

## Contrat de bascule CDN

Le contrat minimal de switch CDN devient:

```text
Objet                    | Role
-------------------------+-------------------------------------------------------------
CDN_TOKEN                | authentification API CDN
CDN_ZONE_ID              | zone du domaine
CDN_RECORD_NAME          | hostname public a basculer (`deces.matchid.io`, `dev-deces...`)
CDN_RECORD_TYPE          | `A` ou `CNAME`
CDN_RECORD_ID            | optionnel si resolution par nom a l'execution
CDN_SWITCH_TARGET        | IP ou hostname de l'instance candidate
CDN_CANARY_RECORD_NAME   | sous-domaine de test pour essais de bascule
```

Provider cible observe a date:

- Cloudflare est deja utilise pour la purge de cache via `CDN_TOKEN` et
  `CDN_ZONE_ID`;
- la cible naturelle est donc d'ajouter une primitive `cdn-switch-record`
  cohérente avec `cdn-cache-purge`.

## Regles de bascule CDN

### Dev / preprod

- `push main` deploie la candidate sur l'instance cible;
- le workflow verifie l'API en VPC;
- le record `dev-deces.matchid.io` est bascule via CDN sur cette candidate;
- un healthcheck public est rejoue;
- le cache CDN est purge.

### Prod

- le tag `prod/v*` deploie la candidate sur l'instance cible;
- le workflow verifie d'abord l'API en VPC;
- le record `deces.matchid.io` est bascule via CDN sur cette candidate;
- le healthcheck public et le chargement UI sont verifies;
- le cache CDN est purge;
- les anciennes instances non retenues sont ensuite nettoyees.

### Mensuel dataprep prod

- le workflow mensuel resolve le dernier tag prod;
- il prepare une nouvelle instance avec ce tag et le nouveau snapshot `full`;
- il verifie l'API et la restauration du snapshot en VPC;
- il bascule `deces.matchid.io` via CDN;
- il purge le cache et nettoie l'ancienne instance.

## Strategie de test CDN

Avant toute bascule prod par CDN, une preuve technique doit etre faite sur un
sous-domaine dedie.

Sous-domaines cibles possibles:

```text
switch-test-deces.matchid.io
canary-deces.matchid.io
main-deces.matchid.io
```

Le choix exact sera fige par configuration, mais la methode attendue est:

1. creer ou reutiliser un record de test proxifie dans la meme zone CDN;
2. le faire pointer vers l'instance candidate par API;
3. verifier:
   - propagation/lecture du record par API CDN;
   - healthcheck public;
   - chargement UI;
   - purge de cache;
4. seulement ensuite appliquer la meme methode a `dev-deces.matchid.io`, puis a
   `deces.matchid.io`.

### 3. Tag prod

```text
Evenement              | Workflow cible         | Effet
-----------------------+------------------------+----------------------------------------------------------
push tag `prod/v*`     | `release-prod.yml`     | promotion prod depuis un commit de `main`
```

Le workflow de tag prod suit cette logique:

1. verifier que le tag pointe sur un commit reachable depuis `main`;
2. resoudre le dernier tag prod reussi precedent;
3. comparer le tag courant au precedent;
4. si le diff touche la pile dataprep
   (`deces-dataprep`, `dataprep-backend`, `dataprep-frontend`, `tools`,
   chemins infra associes):
   - lancer `dataprep-full` sur le tag courant;
   - deployer la prod avec les images du tag courant, le nouveau snapshot et la
     bascule CDN finale;
5. sinon:
   - reutiliser le dernier snapshot prod valide;
   - deployer la prod avec les images du tag courant, le snapshot courant et la
     bascule CDN finale.

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
   - `CDN switch = vers la nouvelle instance preparee sur ce tag`

Ce workflow est la transposition du fonctionnement upstream mensuel: la data
evolue, l'application reste figee sur la derniere release prod.

## Cas operatoires cibles

### Evol dataprep seule

```text
1. Merge sur `main`
2. Validation sur `dev-deces`
3. Si l'on veut seulement mettre a jour la data prod:
   - soit attendre le mensuel automatique;
   - soit lancer `dataprep-monthly.yml` manuellement
4. La prod est redeployee avec le dernier tag prod et le nouveau snapshot
```

### Evol deces-ui / deces-backend seule

```text
1. Merge sur `main`
2. Validation sur `dev-deces`
3. Preparation de release (`changeset version` + bump `VERSION` Python si besoin)
4. Creation des tags package et du tag `prod/v*`
5. Le tag prod redeploie la prod avec le snapshot courant
```

### Evol dataprep + application

```text
1. Merge sur `main`
2. Validation sur `dev-deces`
3. Preparation de release
4. Tag `prod/v*`
5. Le workflow de tag detecte un diff dataprep, lance `dataprep-full`
6. La prod est redeployee automatiquement avec le nouveau snapshot et les
   images du tag
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
feature branch -> PR vers main -> merge main -> tag prod/v* -> deploy prod
```

Regles:

- `main` devient la branche par defaut;
- `master` est supprimee;
- `main` est protegee avec checks CI requis;
- des protections de tags s'appliquent sur:
  - `prod/v*`
  - `deces-ui/v*`
  - `deces-backend/v*`
  - `dataprep-frontend/v*`
  - `dataprep-backend/v*`
- seuls les mainteneurs autorises peuvent creer/pousser les tags prod.

## Impact sur les workflows existants

Le schema final implique:

- renommage des triggers `dev` -> `main`;
- suppression des triggers `master`;
- creation d'un workflow de release sur `push.tags`;
- creation d'un workflow mensuel `schedule`/`workflow_dispatch`;
- creation d'une primitive de switch CDN dans `packages/tools` et integration
  dans `deploy-remote`;
- suppression de la dependance au switch nginx/bastion du chemin critique de
  publication;
- suppression des hypotheses `dev -> master` des docs et protections.

## Sort des specs intermediaires

Les specs suivantes documentent un etat de transition utile pour l'historique,
mais ne doivent plus etre traitees comme cible finale:

- [SPEC_EVOL_008](SPEC_EVOL_008_BASCULE_SUBSTITUTION_MONOREPO.md)
- [SPEC_EVOL_009](SPEC_EVOL_009_GOUVERNANCE_GITHUB_MONOREPO.md)

La cible finale de bascule/release est desormais la presente spec.
