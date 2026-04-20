# SPEC_EVOL_004 - Validation dev et CI monorepo

## Contexte

Le monorepo doit remplacer les validations package-level sans inventer un
contrat parallèle. Les jobs racine doivent donc appeler les cibles `make`
historiques des repos sources, adaptées uniquement par le chemin du package dans
le monorepo.

## Objectif

Introduire une CI racine qui prouve la non-régression par composant avec les
mêmes rôles que les workflows d'origine.

## Non-objectifs

- reproduire en lot 6 les déploiements distants;
- publier des images depuis la CI de validation;
- conserver des jeux de données artificiels ou une couche de validation ad hoc.

## Contrat CI cible

```text
Composant         | Workflow source                 | Job monorepo                              | Commandes make monorepo
------------------+---------------------------------+-------------------------------------------+------------------------------------------------------------
tools             | actions.yml / build docker swift| ci.yml / build docker swift               | make -C packages/tools docker-check CLOUD_CLI=swift || make -C packages/tools docker-build CLOUD_CLI=swift
dataprep-backend  | pull.yml / pull request test    | ci.yml / dataprep-backend pull request test | make -C packages/deces-dataprep config; make -C packages/dataprep-backend version backend-docker-check || make -C packages/dataprep-backend backend-build backend backend-stop
dataprep-frontend | pull.yml / pull request test    | ci.yml / dataprep-frontend pull request test | make -C packages/deces-dataprep config frontend-config; make -C packages/dataprep-frontend version-files version; make -C packages/dataprep-frontend frontend-docker-check || make -C packages/dataprep-frontend build backend-docker-check up
deces-backend     | dockerimage.yml / build         | ci.yml / deces-backend build docker image | make -C packages/deces-backend DATA_DIR=build-data backend-build-image
deces-ui          | pr.yml / Pull request test      | ci.yml / deces-ui pull request test       | make version config; make frontend-docker-check || make APP=deces-ui build; make -C packages/deces-backend DATA_DIR=build-data backend-build-image; make deploy-local backend-test frontend-test
deces-dataprep    | pr.yml / locally                | ci.yml / deces-dataprep locally           | make -C packages/deces-dataprep all FILES_TO_PROCESS=deces-2020-m01.txt.gz ...
```

## Décisions

- `ci.yml` reste un workflow de validation: il construit ou réutilise les images
  nécessaires, mais ne publie pas.
- `cd.yml` reste le workflow de publication des artefacts et snapshots.
- Les packages dataprep historiques reçoivent en CI les chemins monorepo
  (`TOOLS_PATH`, `BACKEND`, `DATAPREP_PROJECT_SOURCE_PATH`) au lieu de cloner ou
  deviner des repos frères.
- Le job `deces-backend build docker image` prouve la construction de l'image;
  le runtime backend avec index restauré est prouvé par le job historique
  `deces-ui pull request test`.
- Les écarts de paramètres CI (`NPM_AUDIT_IGNORE=true`, `ES_MEM=1024m`) sont
  documentés dans la checklist make/CI/CD et ne créent pas de cible make
  parallèle.
- Les secrets de stockage sont requis pour les jobs qui restaurent ou produisent
  des données depuis les buckets non-prod.
- Les jobs sont déclenchés par chemins modifiés avec `dorny/paths-filter`.
- Les déploiements distants et SCW restent cadrés par le lot 8.

## Etat attendu avant UAT lot 6

- le workflow `CI` passe sur `push` de la branche d'intégration;
- le workflow `CI` passe sur la PR;
- chaque job CI cite une commande `make`, sans appel direct à `npm` ou `docker`;
- la matrice complète est tenue à jour dans
  [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md).

## Dépendances

- [SPEC_EVOL_003](SPEC_EVOL_003_CHAINE_DATAPREP_BACKEND_UI.md)
- [SPEC_EVOL_005](SPEC_EVOL_005_BASCULE_PREPROD_PROD.md)
