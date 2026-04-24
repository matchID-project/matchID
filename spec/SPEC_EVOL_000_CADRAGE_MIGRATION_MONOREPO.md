# SPEC_EVOL_000 - Cadrage de migration vers le monorepo de reference

## Contexte

Le depot contient deja l'historique fusionne des repos de reference, mais pas encore le cadrage explicite qui permet d'avancer sans ambiguite sur:

- la branche d'integration a utiliser
- les references upstream a rattraper
- les ecarts monorepo voulus
- les ecarts non voulus consideres comme de la dette
- la voie de deploiement canonique
- le contrat d'artefacts a produire pour remplacer le processus actuel

## Objectif

Figer le cadre de migration avant tout rattrapage upstream significatif ou toute tentative de substitution du processus de deploiement actuel.

## Non-objectifs

- lancer le rattrapage upstream lui-meme
- stabiliser des maintenant tout le runtime monorepo
- basculer tout de suite la preprod ou la prod

## Decisions actees

### Branche d'integration

- la branche d'integration dediee est `feat/monorepo-integration`
- elle sert de branche d'assemblage et de validation avant generalisation

### Execution de reference

- l'execution de reference du service deces se fait depuis la racine du monorepo
- les commandes package-level restent des aides locales et de debug, pas le contrat principal d'execution preprod/prod

### Ownership cible par package

- `packages/dataprep-backend`
  - porte l'image `backend` necessaire a l'execution du dataprep
  - reste distinct de `deces-backend`
- `packages/deces-dataprep`
  - prepare l'index deces
  - publie l'artefact de donnees consomme par le deploiement
- `packages/deces-backend`
  - porte l'API et l'image backend
- `packages/deces-ui`
  - porte l'UI et l'image frontend/nginx
- `packages/deces-infra`
  - porte Elasticsearch, Redis, SMTP
  - porte la configuration et la restauration des snapshots Elasticsearch
- `packages/tools`
  - porte les operations cloud, stockage, catalogue, docker push, deploiement distant, configuration nginx et monitoring

### Voie de deploiement

- la voie canonique de deploiement preprod/prod a ce stade est `deploy-remote`
- `deploy-k8s` sort du chemin critique et devient un sujet de roadmap

### Contrat d'artefacts de reference

Le contrat d'artefacts de reference de la chaine complete est:

- image `backend`
- image `deces-backend`
- image `deces-ui`
- snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`

L'image `backend` est un artefact technique necessaire a l'execution du dataprep.

Pour `deploy-remote`, l'artefact de reference de `deces-dataprep` reste le snapshot Elasticsearch `esdata_${DATAPREP_VERSION}_${DATA_VERSION}`.

### Strategie de configuration hors git

- les secrets et surcharges d'environnement restent hors git
- `artifacts` a la racine reste la surcharge locale principale du service deces
- `packages/tools/artifacts.*` reste la surcharge locale des environnements cloud supportes
- les fichiers templates versionnes servent de modele, jamais de source de secrets
- les variables de deploiement preprod/prod doivent etre documentees et re-jouables hors environnement personnel

### Fichiers d'etat et de version

- `.dataprep.sha1` a la racine represente la version du dataprep consommee par le service deces
- `.data.sha1` a la racine represente la version des donnees source consommee par le service deces
- ces deux fichiers d'etat appartiennent au contrat racine du monorepo

## Matrice de reference gelee

| Composant | Package monorepo | Upstream cible | SHA importe |
| --- | --- | --- | --- |
| tools | `packages/tools` | `matchID-project/tools:master` | `028d99058940d2f214c4a6d6fcb97214873e2dc3` |
| deces-dataprep | `packages/deces-dataprep` | `matchID-project/deces-dataprep:dev` | `41cdbd9bb09275d325c9f97a3110288d15749b82` |
| deces-backend | `packages/deces-backend` | `matchID-project/deces-backend:dev` | `87e7811cb323315ea70815a3271de4ea8cbbfaf5` |
| deces-ui | `packages/deces-ui` | `matchID-project/deces-ui:dev` | `43cbcb656b845f3ac6924559210589dc31838e6f` |
| backend generique | `packages/dataprep-backend` | `matchID-project/backend:dev` | `b5ccd45a166557623d4b54a55cd175e5aaad43d2` |
| frontend generique | `packages/dataprep-frontend` | `matchID-project/frontend:dev` | `a59001f36c1efa7438ce339dcc29609ea5d9c3e3` |

## Ecarts monorepo voulus

- la presence des packages sous `packages/`
- l'orchestration de reference a la racine via le `Makefile` racine
- l'extraction d'infra dans `packages/deces-infra`
- la centralisation des operations cloud et remote dans `packages/tools`
- la documentation de migration dans `PLAN.md` et `spec/`
- le contrat d'artefacts monorepo `image backend` + `image deces-backend` + `image deces-ui` + `snapshot Elasticsearch`

## Ecarts non voulus

- les commits upstream manquants apres les SHAs importes de reference
- les clones croises entre anciens repos, en particulier `git clone backend` depuis `deces-dataprep`
- les chemins multi-repos herites du type `backend/tools`
- les doublons locaux de `tools`, notamment dans `packages/deces-backend/tools`
- les dependances implicites a des fichiers d'etat ou de version absents a la racine
- les dependances a un environnement personnel non documente pour tester, builder ou deployer

## Criteres d'acceptation

- la branche d'integration dediee existe
- la matrice upstream et les SHAs importes sont figes
- les ecarts monorepo voulus et les ecarts non voulus sont explicites
- la voie de deploiement canonique et le contrat d'artefacts sont explicites
- les specs aval peuvent se referer a ce cadrage sans ambigüite
