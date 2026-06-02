# ORPI PILOMAX — Dossier de déploiement (v10)

Application de pilotage commercial immobilier.
Stack : React 18 + Supabase + Vercel. Voir le cahier des charges pour le détail.

---

## Contenu du dossier

```
orpi-github/
├── public/              Fichiers statiques (index.html, manifest, icônes, splash)
├── src/
│   ├── App.jsx          Cœur de l'application (contexte, données, routage)
│   ├── components/      29 composants fonctionnels
│   ├── styles.css       Charte graphique + responsive (3 breakpoints)
│   ├── supabase.js      Connexion base de données temps réel
│   ├── notifications.js Service Worker / notifications
│   ├── matchingAuto.js  Rapprochement acquéreurs/biens
│   └── index.js         Point d'entrée React
├── package.json         Dépendances + scripts
├── vercel.json          Configuration de déploiement Vercel
├── .env                 Variables d'environnement (CI=false)
└── .gitignore           Exclusions Git (node_modules, build)
```

---

## Déploiement sur Vercel via GitHub (méthode recommandée)

1. Décompressez ce dossier.
2. Poussez son contenu sur votre dépôt GitHub `ORPI-PILOMAX` (branche `main`) :
   - Soit en glissant les fichiers dans l'interface GitHub (Add file → Upload files).
   - Soit en ligne de commande :
     ```
     git add .
     git commit -m "Déploiement v10 — build stable"
     git push origin main
     ```
3. Vercel détecte le push et déploie automatiquement.
4. Vérifiez sur https://orpi-pilomax.vercel.app

> Important : poussez bien TOUT le contenu (en écrasant l'ancien), pour éviter
> que Vercel ne reconstruise un ancien commit.

---

## Test en local (optionnel)

```
npm install        # installe les dépendances (une fois)
npm start          # lance en local sur http://localhost:3000
npm run build      # génère le build de production (dossier build/)
```

---

## Build validé

Ce dossier a passé avec succès :
- Le contrôle syntaxique de tous les composants (29 + App.jsx).
- Le contrôle des composants et des règles React Hooks.
- Un build de production réel (`npm run build` → "Compiled successfully").

Taille du bundle : ~293 kB gzippé (JS) + ~5 kB (CSS).

---

## Connexion à l'application

- URL : https://orpi-pilomax.vercel.app
- Mot de passe par défaut : `ORPI2026`
- Les comptes (Pierre, Frédéric, agents) sont préchargés.

---

## Sécurité — à traiter avant commercialisation (rappel du CDC §7.3)

CRITIQUE avant d'ouvrir à d'autres agences :
1. Migrer l'authentification vers Supabase Auth (mots de passe actuellement en clair).
2. Activer Row Level Security par agence sur Supabase.
3. Conformité RGPD.

Pour la phase de test interne actuelle, la configuration est fonctionnelle.
