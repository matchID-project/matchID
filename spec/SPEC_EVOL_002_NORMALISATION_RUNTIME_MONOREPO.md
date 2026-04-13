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

## Décisions de design actées

1. Exécution de référence:
   - la référence d'exécution du service décès est la racine du monorepo
   - les commandes package-level restent des aides locales et non le contrat principal de déploiement
2. Ownership de l'infra:
   - `deces-infra` porte Elasticsearch, Redis, SMTP et les opérations de repository/snapshot Elasticsearch
3. Ownership des opérations cloud:
   - `tools` reste central pour le stockage, le catalogue, les opérations cloud et `deploy-remote`
4. Ownership des données:
   - emplacement unique des fichiers versionnés et des états `.data.sha1` / `.dataprep.sha1` à la racine
5. Configuration hors git:
   - les secrets restent hors git via `artifacts` racine et `packages/tools/artifacts.*`
6. Politique de configuration locale:
   - les cibles de configuration locale n'appellent `sudo` que lorsqu'un prérequis système manque réellement
   - une configuration déjà satisfaite ne doit pas muter `/etc/environment` ni la configuration systemd Docker

## Travaux

### A. Supprimer les clones croisés

- retirer le `git clone backend` dans `packages/deces-dataprep/Makefile`
- remplacer les chemins `backend/tools` par `packages/tools`
- remplacer les hypothèses multi-repos par des chemins monorepo explicites
- faire réutiliser à `deces-dataprep` les prérequis mutualisés déjà présents dans le monorepo (`config`, `network`, `vm_max`) avant de supprimer complètement le backend historique

### B. Supprimer les duplications

- supprimer ou neutraliser `packages/deces-backend/tools`
- éviter tout doublon fonctionnel entre `packages/tools` et copies héritées

### C. Clarifier les contrats de variables

- variables portées par la racine
- variables portées par chaque package
- variables infra communes
- stratégie de surcharge locale hors git

### Contrat retenu

#### Variables portées par la racine

- chemins inter-packages:
  - `FRONTEND_PATH`
  - `BACKEND_PATH`
  - `TOOLS_PATH`
  - `DATAPREP_PATH`
  - `INFRA_PATH`
- runtime monorepo commun:
  - `DC`
  - `DC_NETWORK`
  - `MAKE`
  - `USE_TTY`
  - `PORT`
  - `APP_DNS`
  - `APP_URL`
  - `API_SSL`
- données et versions canoniques:
  - `DATASET`
  - `DATA_DIR`
  - `FILES_TO_PROCESS`
  - `DATAPREP_VERSION_FILE`
  - `DATA_VERSION_FILE`
- buckets et repository partagés:
  - `STORAGE_BUCKET`
  - `REPOSITORY_BUCKET`
  - `REPOSITORY_BUCKET_DEV`

#### Variables portées par les packages

- `deces-backend`:
  - variables d'API et de jobing `BACKEND_*`
  - variables SMTP tant que SMTP n'est pas sorti vers `deces-infra`
- `deces-ui`:
  - variables frontend/nginx `FRONTEND_*`, `NGINX_*`, `GOOGLE_*`, limites API exposées au reverse proxy
- `deces-dataprep`:
  - variables de recette et de backup `RECIPE_*`, `CHUNK_SIZE`, `BACKUP_METHOD`
  - chemins internes explicites `DATAPREP_BACKEND_PATH`, `DATAPREP_FRONTEND_PATH`
- `deces-infra`:
  - variables Elasticsearch `ES_*`
  - variables d'infra mutualisées appelées depuis la racine

#### Règles

- un package ne doit pas redéfinir un chemin inter-package canonique de la racine vers un clone externe
- les secrets restent hors git via `artifacts` racine et `packages/tools/artifacts.*`
- une variable de package peut surcharger un défaut local, mais pas déplacer la source de vérité hors du monorepo

### D. Stabiliser les fichiers d'état et de version

- décider du rôle de `tagfiles.version` à la racine
- décider de la source de vérité pour `.data.sha1` et `.dataprep.sha1`
- éviter les dépendances implicites à des fichiers créés manuellement

### E. Terminer l'extraction infra

- déplacer Redis et SMTP vers `deces-infra`
- réduire le rôle de `deces-backend` à l'API et ses assets runtime
- mutualiser `network`, `vm_max`, `elasticsearch-start`, `elasticsearch-check` et `elasticsearch-stop` autour de la racine et de `deces-infra`
- faire consommer à `deces-dataprep` les cibles Elasticsearch mutualisées quand l'infra monorepo couvre déjà le besoin

## État courant lot 4

- `packages/dataprep-backend` est aligné byte-à-byte avec `matchID-project/backend:dev` au 12 avril 2026
- `packages/dataprep-frontend` est aligné avec `matchID-project/frontend:dev` au 12 avril 2026, à un seul écart monorepo près:
  - `docker-compose-build.yml` expose en plus `DATA_DIR` comme build arg
- la racine ne dépend plus de `tagfiles.version` pour calculer sa version; `make version` s'appuie désormais directement sur `git describe --tags`
- `packages/deces-dataprep/Makefile` ne clone plus `backend` à l'exécution
- `packages/deces-dataprep/Makefile` consomme désormais `packages/tools` pour le stockage, le catalogue et le remote
- `packages/deces-dataprep/Makefile` pointe explicitement sur ses chemins backend/frontend internes au monorepo
- `packages/deces-dataprep` réutilise les cibles Elasticsearch mutualisées exposées par la racine et `deces-infra`
- `.dataprep.sha1` est désormais recalculé depuis des dépendances explicites à la racine
- `.data.sha1` est désormais recalculé explicitement à chaque `make data-version` pour éviter les états obsolètes
- `packages/deces-dataprep` délègue `data-tag` à la racine et lit désormais la même source de vérité que `deploy-remote`
- la regex canonique `FILES_TO_PROCESS` est alignée entre la racine et `deces-dataprep` sous une forme POSIX-compatible

## Preuves de validation intermédiaire

Commandes exécutées uniquement via `make`:

- `make version`
  - succès
  - plus aucun bruit `tagfiles.version` à la racine
- `make dataprep-version`
  - succès
  - valeur racine recalculée: `ccb7c116` lors de la validation
- `make data-version`
  - succès
  - valeur racine recalculée: `c88006ac` lors de la validation
- `make -C packages/deces-dataprep data-tag`
  - succès
  - retourne la même valeur canonique que `.data.sha1` à la racine (`c88006ac` lors de la validation)
- `make -C packages/deces-dataprep recipe-run`
  - succès
  - passe par `elasticsearch-local` via la racine quand `deces-infra` est présent
- `make -C packages/deces-dataprep dev`
  - succès
  - démarre le backend et le frontend dataprep sans clone externe, avec `packages/tools` comme source commune

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

- [SPEC_EVOL_000](SPEC_EVOL_000_CADRAGE_MIGRATION_MONOREPO.md)
- [SPEC_EVOL_001](SPEC_EVOL_001_RATTRAPAGE_UPSTREAM_REFERENCES.md)
- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
