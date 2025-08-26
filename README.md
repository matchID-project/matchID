# matchID — monorepo

Monorepo rassemblant les projets clés de l’organisation **matchID‑project** pour l’**appariement d’identités** et la **recherche** (fuzzy/full‑text).  
Il regroupe le service public d’**appariement de décès** (*death record linkage*) opéré via **[deces.matchid.io](https://deces.matchid.io)**, ainsi que des modules génériques réutilisables.

> **Crédits & gouvernance :** voir **[matchid.io](https://matchid.io)**.  
> **Service d’appariement de décès :** **[deces.matchid.io](https://deces.matchid.io)**.

---

## 🔗 Liens

- Site & documentation : https://matchid.io  
- Service public (décès) : https://deces.matchid.io  
- Organisation GitHub : https://github.com/matchID-project  
- Ce dépôt (monorepo) : https://github.com/matchID-project/matchID

---

## 🧩 Projets inclus

- **deces-ui** — Interface utilisateur (**UI**, *User Interface*) du service décès.  
- **deces-backend** — Interface de programmation d’applications (**API**, *Application Programming Interface*) qui alimente l’UI.  
- **deces-dataprep** — Préparation/normalisation des données décès et indexation.  
- **backend** — Composants génériques côté serveur (recettes d’appariement, orchestration).  
- **frontend** — Composants génériques côté interface (pilotage/visualisation).

---

## 🗂️ Arborescence (racine)

```
/packages/deces-ui
/packages/deces-backend
/packages/deces-dataprep
/packages/backend
/packages/frontend
/packages/tools

````

Chaque sous‑projet possède son **README** et sa configuration (prérequis, variables d’environnement, commandes).

---

## 🏗️ Architecture (vue d’ensemble)

```mermaid
flowchart LR
  subgraph Données
    SRC["Sources (ex. fichiers décès)"]
  end

  subgraph Moteur Décès
    DP[deces-dataprep]
    BE[deces-backend]
    UI[deces-ui]
  end

  subgraph Modules génériques
    B[backend]
    F[frontend]
  end

  SRC --> DP
  DP --> BE
  BE --> UI

  DP -. s'appuie sur .-> B
  DP -. s'appuie sur .-> F
````

---

## 🚀 Démarrage rapide

1. **Cloner** :

   ```bash
   git clone https://github.com/matchID-project/matchID
   cd matchID
   ```
2. **Suivre les READMEs** des sous‑projets pour :

   * les prérequis (Docker, Node.js, Python 3.x, Make),
   * la configuration (fichiers d’entrée, variables d’environnement),
   * les commandes de développement et de test.
3. **Parcours conseillé** : `deces-dataprep` ➜ `deces-backend` ➜ `deces-ui` pour un bout‑en‑bout local.

---

## 🤝 Contribution

Les *issues* et *pull requests* sont bienvenues. Merci de documenter les changements et d’inclure tests et captures utiles.

---

## 📄 Licence

En cours... Consulter les **LICENSE** présents dans chaque sous‑projet.

---

## 👥 Crédits

Crédits, historique et gouvernance : **[https://matchid.io](https://matchid.io)**
