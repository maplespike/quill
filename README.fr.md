# MapleSpike Canada

> **Pipeline de données gouvernementales canadiennes souverain et natif pour l'IA** — une couche unifiée pour les données gouvernementales, le suivi de l'influence des entreprises, la surveillance des comités, le renseignement réglementaire et le suivi des acteurs politiques. Construit sans dépendance au nuage externe, déployé sur un cluster K3s.

**Statut :** Développement actif · **Licence :** AGPL-3.0/MIT · **Stack :** TypeScript + Node.js + K3s

> [Version anglaise](README.md) · English version available

---

## Ce que c'est

MapleSpike Canada ingère, vérifie et présente **16 modules de données** gouvernementales canadiennes publiques :

| # | Module | Suivi | Connecteurs | Persistance BD | Outil MCP |
|---|--------|-------|-----------|------------|----------|
| 1–16 | Voir le [README anglais](README.md) pour la liste complète | … | ✅ | ✅ | ✅ réel |

Chaque enregistrement comprend des hachages de citation SHA-256, une provenance des sources et des pistes d'audit pour une vérification indépendante.

---

## Structure du dépôt

```
maplespike/
├── packages/
│   ├── pipeline-core/    # Ingestion, vérification, audit (bibliothèque partagée)
│   ├── engine/           # Résolution d'entités, construction de graphes, signaux, briefs
│   ├── pretext-civic/    # Bibliothèque de composants React (graphiques, géo) — orphelin
│   ├── portal/           # Portail développeur et page d'accueil (HTML statique)
│   ├── api-server/       # Passerelle API REST (8 points d'accès, auth, limites de débit)
│   └── mcp-server/       # Serveur de protocole MCP (✅ 14 outils réels)
├── docs/                 # Documentation d'architecture, feuille de route, analyse de marché
├── flake.nix             # Construction Nix
├── ROADMAP.md            # Feuille de route complète
└── tsconfig.json         # Configuration TypeScript partagée
```

---

## Infrastructure

| Service | Plateforme | Stack |
|---------|-----------|-------|
| Portail (marketing + docs) | **GitHub Pages** | HTML/CSS/JS statique |
| Tableau de bord produit | **Cluster K3s** (nexus) | Next.js |
| Serveur MCP | **Cluster K3s** | Node.js, transport SSE |
| Serveur API | **Cluster K3s** | Node.js, auth Bearer |
| Moteur / CronJobs | **Cluster K3s** | Pipelines d'ingestion programmés |

---

## Démarrage rapide

```bash
pnpm install
pnpm run build
cd packages/mcp-server
pnpm start
```

---

## Licence

**Bibliothèque principale** (`packages/pipeline-core`) : AGPL-3.0 · **Serveur MCP** : MIT
**Moteur** : MIT · **Portail** : MIT

Les données gouvernementales conservent leur licence originale (principalement [Licence du gouvernement ouvert – Canada](https://ouvert.canada.ca/fr/licence-du-gouvernement-ouvert-canada)).
