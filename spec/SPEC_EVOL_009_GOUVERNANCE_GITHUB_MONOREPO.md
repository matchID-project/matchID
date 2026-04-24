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
--------------------------+----------------+----------------------------+---------------------------------------------
matchID-project/matchID   | dev            | dev, master                | protections dev/master + 2 rulesets actives
matchID-project/deces-ui  | dev            | dev, master                | protections dev/master en place
```

Details monorepo observes:

```text
Point                              | Valeur live
-----------------------------------+--------------------------------------------------------------
branche par defaut                 | `dev`
branche racine `master`            | presente sur `9cc2d06e766e94b60af72799105ba1e31947d2ec`
rulesets live                      | `dev` (`7737818`), `master` (`15515365`)
protections classiques `dev/master`| presentes sur `dev` et `master`
```

Details des rulesets monorepo:

```text
Ruleset | Ref cible            | Enforcement | Linear history | Pull request | Approvals
--------+----------------------+-------------+----------------+--------------+----------
dev     | `refs/heads/dev`     | active      | oui            | oui          | 0
master  | `refs/heads/master`  | active      | oui            | oui          | 0
```

Details des protections classiques monorepo:

```text
Branche | Checks requis live
--------+--------------------------------------------------------------
dev     | `Detect changed areas`
        | `build docker swift`
        | `dataprep-backend pull request test`
        | `dataprep-frontend pull request test`
        | `deces-backend build docker image and tests`
        | `deces-dataprep locally`
        | `deces-ui pull request test`
master  | `Detect artifact changes`
        | `Publish matchid-backend image`
        | `Publish matchid-frontend image`
        | `Publish deces-backend image`
        | `Publish deces-ui image`
        | `Publish dataprep full snapshot`
        | `Deploy`
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
branche racine master         | presente                      | presente
protection dev                | ruleset + checks classiques   | PR obligatoire + checks requis
protection master             | ruleset + checks classiques   | PR obligatoire + checks requis
promotion dev -> master       | configuration prete           | PR dediee `dev -> master`
release prod depuis master    | configuration prete           | oui
```

## Decision de gouvernance

La gouvernance GitHub suivante est maintenant en place:

1. branche racine `master` creee depuis `dev`;
2. `dev` conservee comme branche par defaut;
3. `dev` protege via ruleset PR obligatoire + checks CI requis;
4. `master` protege via ruleset PR obligatoire + checks release requis;
5. pushes directs bloques par rulesets + protections de statut;
6. contrainte processuelle restante: `master` doit etre alimentee par PR depuis `dev`.

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

Pour le monorepo, la transposition appliquee est:

```text
Branche | Checks requis cibles
--------+--------------------------------------------------------------
dev     | 7 checks CI explicites
master  | 7 checks CD explicites
```

Note:

- le choix `master -> checks CD` reproduit le pattern observe sur `deces-ui`,
  ou la branche `master` requiert les contextes du workflow `push`;
- ce choix reste compatible avec la PR `dev -> master` car les contextes CD
  existent deja sur le SHA pousse sur `dev`, avec `success` ou `skipped` selon
  les paths modifies;
- si GitHub se revele instable sur ces checks `skipped`, il faudra encore
  introduire un job agregateur toujours present dans `ci.yml` et/ou `cd.yml`;
- la contrainte processuelle `master` alimentee depuis `dev` reste a prouver en
  situation reelle des que `dev` divergera de `master`.

## Impact sur le lot 9

Etat apres mise en place:

- l'etape `Executer le CD dataprep-full depuis master` est maintenant
  techniquement possible dans le bon contexte GitHub;
- la bascule prod via PR `dev -> master` est maintenant gouvernee par branches
  `dev` / `master`, protections classiques et rulesets dediees;
- la preuve end-to-end du flux `dev -> master` reste ouverte tant que
  `master...dev` est `identical` (`ahead_by=0`, `behind_by=0`).

Ordre d'execution requis:

1. creer `master` - fait;
2. configurer la gouvernance GitHub `dev` / `master` - fait;
3. prouver ce fonctionnement sur un prochain delta `dev -> master`;
4. seulement ensuite executer `dataprep-full` dans le contexte cible;
5. puis fermer la substitution complete.

## Dependances

- [SPEC_EVOL_006](SPEC_EVOL_006_ARTEFACTS_CD_MONOREPO.md)
- [SPEC_EVOL_008](SPEC_EVOL_008_BASCULE_SUBSTITUTION_MONOREPO.md)
- [SPEC_EVOL_MAKE_CICD_CHECKLIST](SPEC_EVOL_MAKE_CICD_CHECKLIST.md)
