# SPEC_EVOL_009 - Gouvernance GitHub monorepo

## Objet

Documenter l'etat live actuel du repo GitHub `matchID-project/matchID`, l'ecart
par rapport au workflow cible `feat/* -> dev -> master`, et les preconditions de
gouvernance a fermer avant la substitution complete du processus historique.

## Workflow cible

Le workflow cible acte est:

```text
feature branch -> PR vers dev -> merge dev -> PR dev vers master -> merge master
```

Contraintes attendues:

- la branche par defaut reste `dev`;
- `master` existe comme branche racine du monorepo;
- `dev` est la branche d'integration;
- `master` est la branche de release/prod;
- les merges directs sur `dev` et `master` sont bloques;
- le deploy prod ne peut intervenir qu'apres passage par `dev`;
- un changement `deces-ui` sur `master` deploie la prod;
- un changement dataprep seul sur `master` ne redeploie pas `deces-ui`.

## Etat live observe le 2026-04-24

Observation GitHub live:

```text
Repo                      | Default branch | Branches racines observees | Protection / rules
--------------------------+----------------+-----------------------------+------------------------------------------
matchID-project/matchID   | dev            | dev uniquement              | 1 ruleset active nommee `dev`
matchID-project/deces-ui  | dev            | dev, master                 | protections dev/master en place
```

Details monorepo observes:

```text
Point                              | Valeur live
-----------------------------------+--------------------------------------------------------------
branche par defaut                 | `dev`
branche racine `master`            | absente
ruleset live                       | `dev`
protections classiques `dev/master`| aucune protection classique observee sur racine `dev/master`
```

Details de la ruleset monorepo `dev`:

```text
Champ                      | Valeur live
---------------------------+--------------------------------------------------------------
enforcement                | active
required_linear_history    | oui
pull_request obligatoire   | oui
approbations obligatoires  | 0
status checks obligatoires | non observes dans cette ruleset
```

Details de reference `deces-ui` observes:

```text
Branche | Checks requis live
--------+------------------------------------------------
dev     | `Pull request test`
master  | `🐳 Build docker image`, `🚀 Deploy`
```

## Ecart a fermer

```text
Sujet                         | Etat live monorepo            | Cible
------------------------------+-------------------------------+-----------------------------------------
branche par defaut            | dev                           | dev
branche racine master         | absente                       | presente
protection dev                | partielle via ruleset         | PR obligatoire + checks requis
protection master             | absente                       | PR obligatoire + checks requis
promotion dev -> master       | impossible aujourd'hui        | PR dediee `dev -> master`
release prod depuis master    | impossible aujourd'hui        | oui
```

## Decision de gouvernance

Le lot 9 ne peut pas etre ferme tant que la gouvernance GitHub suivante n'est
pas en place:

1. creation de la branche racine `master` depuis `dev`;
2. maintien de `dev` comme branche par defaut;
3. protection de `dev` avec PR obligatoire et checks CI requis;
4. protection de `master` avec PR obligatoire et checks release requis;
5. interdiction des pushes directs sur `dev` et `master`;
6. contrainte processuelle: `master` est alimentee par PR depuis `dev`.

## Checks cibles proposes

La reference observable `deces-ui` impose un check de PR sur `dev` et deux checks
release sur `master`.

Checks monorepo observes a date:

```text
Source                 | Run id      | Contextes observes
-----------------------+-------------+--------------------------------------------------------------
PR `feat/refacto-make` | 24778209789 | `Detect changed areas`, `build docker swift`,
                       |             | `dataprep-backend pull request test`,
                       |             | `dataprep-frontend pull request test`,
                       |             | `deces-backend build docker image and tests`,
                       |             | `deces-dataprep locally`,
                       |             | `deces-ui pull request test`
CD reussi              | 24777914592 | `Detect artifact changes`,
                       |             | `Publish dataprep year snapshot`,
                       |             | jobs CD non concernes emis en `skipped`,
                       |             | dont `Deploy`
```

Pour le monorepo, la transposition minimale cible est:

```text
Branche | Checks requis cibles
--------+--------------------------------------------------------------
dev     | au moins un check CI agregateur toujours present
master  | au moins un check release/CD agregateur toujours present
```

Note:

- la granularite exacte des checks requis depend du comportement GitHub sur les
  jobs `skipped` issus du path-filter;
- les runs observes montrent deja que les jobs CD non concernes existent bien
  comme contextes GitHub avec conclusion `skipped`;
- si les checks actuels restent trop variables, il faudra introduire un job
  agregateur toujours present dans `ci.yml` et/ou `cd.yml`;
- la contrainte processuelle `master` alimentee depuis `dev` devra etre tracee
  soit par une regle GitHub explicite, soit a minima par une gouvernance
  d'exploitation documentee et verifiee humainement.

## Impact sur le lot 9

Blocage explicite:

- tant que `master` racine n'existe pas, l'etape
  `Executer le CD dataprep-full depuis master` reste impossible;
- tant que `master` n'est pas protege, la bascule prod via PR `dev -> master`
  n'est pas gouvernee comme attendu.

Ordre d'execution requis:

1. creer `master`;
2. configurer la gouvernance GitHub `dev` / `master`;
3. prouver ce fonctionnement;
4. seulement ensuite executer `dataprep-full` dans le contexte cible;
5. puis fermer la substitution complete.

## Dependances

- [SPEC_EVOL_006](SPEC_EVOL_006_ARTEFACTS_CD_MONOREPO.md)
- [SPEC_EVOL_008](SPEC_EVOL_008_BASCULE_SUBSTITUTION_MONOREPO.md)
- [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md)
