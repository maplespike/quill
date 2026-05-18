---
last-reviewed: 2026-05-14
status: active
---

# MapleSpike — Portail développeur

> [English version](README.md) · Version anglaise disponible

Pages d'accueil SaaS, documentation, guide de configuration des agents IA et tableau de bord développeur pour l'API MapleSpike.

**Statut :** Servi depuis le cluster K3s sur le réseau local. Le déploiement GitHub Pages est prévu pour le lancement public.

---

## Pages

| Page | Route | Description | Statut |
|------|-------|-------------|--------|
| Page d'accueil | `index.html` | Hero, fonctionnalités, tarifs, badges, statistiques | ✅ Amélioration visuelle appliquée |
| Tableau de bord | `dashboard.html` | Données en direct (comités, lobbying, tribunaux), recherche | ✅ Rendu des données |
| Documentation | `docs.html` | Démarrage rapide, configuration MCP, référence API, FAQ | ✅ Statique |
| Agents IA | `agents.html` | Référence des outils MCP, configuration des agents | ✅ Statique |

## Fonctionnalités du tableau de bord

- Cartes de données de comités en direct avec indicateurs à huis clos
- Entrées du registre de lobbying avec références croisées
- Décisions judiciaires de CanLII
- Alertes de détection de signaux
- Statistiques des pipelines
- Thème sombre/clair avec persistance localStorage

## Fonctionnalités IA

- **`/llms.txt`** — Index API compact pour la découverte par agents IA
- **`/llms-full.txt`** — Archive complète de la documentation
- **`/v1/openapi.json`** — Spécification OpenAPI 3.1
- **`Accept: text/markdown`** — Retourne le Markdown brut pour toute page

## Déploiement

Site statique pur (HTML + CSS + JS). Aucune étape de construction requise.

| Environnement | Plateforme | Statut |
|-------------|-----------|--------|
| **Développement** (actuel) | Cluster K3s (LAN) | Actif |
| **Production** (actuel) | Cluster K3s (nginx) — déploiement automatique via CI/CD | Actif |
| **Futur** | GitHub Pages — workflow prêt dans `.github/workflows/deploy-portal.yml` | Planifié |

## Licence

Contient des informations sous licence [Licence du gouvernement ouvert – Canada](https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada).
