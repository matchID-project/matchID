# SPEC_EVOL_003 - Remise en route de la chaîne complète dataprep -> backend -> ui

## Contexte

Le dépôt doit redevenir le repo de référence d'un système complet, pas seulement d'une collection de packages.

La chaîne fonctionnelle observée est:

1. `tools`
2. `deces-dataprep`
3. `deces-infra`
4. `deces-backend`
5. `deces-ui`

## Objectif

Obtenir un run bout-en-bout reproductible en développement.

## Non-objectifs

- exiger immédiatement les mêmes volumes de données qu'en production
- traiter dès cette étape la bascule définitive prod

## Cas d'usage à couvrir

### Cas 1. Restaurer un snapshot existant

- récupérer l'état des données
- restaurer Elasticsearch
- démarrer backend puis UI
- valider des requêtes fonctionnelles

### Cas 2. Rejouer un dataprep

- récupérer les sources Data.gouv
- exécuter le dataprep
- publier ou restaurer l'index
- valider le backend et la UI sur cet index

## Travaux

### A. Définir le scénario de bootstrap canonique

- commande(s) racine officielles
- prérequis
- fichiers de config nécessaires
- mode "avec snapshot" et mode "avec dataprep"

### B. Définir les smoke tests

- dataprep: exécution minimale ou validation de sortie
- infra: healthcheck Elasticsearch, Redis, SMTP
- backend: healthcheck + requête de recherche + flux OTP si possible
- UI: page d'accueil + recherche simple + bulk/link minimal

### C. Définir les dépendances de données

- communes
- disposable mail
- wikidata
- fichiers Data.gouv
- snapshots elasticsearch

### D. Définir les preuves de compatibilité

- version dataprep compatible avec backend
- source canonique de l'image `backend` consommée par `deces-dataprep` selon les contextes `dev`, `test` et `deploy`
- index attendu par backend
- routes et comportements attendus par UI
- preuve de parité d'indexation entre le `deces-dataprep` original et le `deces-dataprep` monorepo sur un jeu de données de référence
  - égalité exacte du nombre de documents indexés
  - égalité d'un échantillon déterministe de 1000 documents normalisés

## Point d'attention ouvert en entree de lot 5

Au 13 avril 2026, le chemin canonique `make -C packages/deces-dataprep dev` délègue encore au target `backend` de `packages/dataprep-backend`, qui vérifie d'abord la présence locale de l'image `matchid/matchid-backend:${APP_VERSION}` puis tente de la tirer du registre si elle n'est pas présente localement.

Le chemin `backend-dev`, qui construit localement l'image depuis le monorepo, a bien été validé au lot 4, mais il n'est pas encore la dépendance canonique de `packages/deces-dataprep`.

Le lot 5 doit donc:

- figer la source canonique de cette image `backend`
- démontrer que l'indexation produite par le `deces-dataprep` monorepo reste sémantiquement identique au comportement de référence sur un jeu de données de test

## Critères d'acceptation

- un développeur peut recréer la chaîne en suivant la doc du monorepo
- au moins un scénario de restauration et un scénario de fonctionnement applicatif sont validés
- la séquence de démarrage et d'arrêt est déterministe

## Dépendances

- [SPEC_EVOL_001](SPEC_EVOL_001_RATTRAPAGE_UPSTREAM_REFERENCES.md)
- [SPEC_EVOL_002](SPEC_EVOL_002_NORMALISATION_RUNTIME_MONOREPO.md)
- [SPEC_EVOL_004](SPEC_EVOL_004_VALIDATION_DEV_ET_CI.md)
