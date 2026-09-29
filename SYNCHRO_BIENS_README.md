# Synchro automatique des biens depuis le site ORPI

Ce dossier ajoute une **synchro quotidienne automatique** : chaque matin, l'application
récupère vos biens en vente depuis votre page publique ORPI et met à jour la base, sans
rien casser de ce que vos agents ont saisi.

## Ce que fait la synchro

Elle lit `https://www.orpi.com/declicimmo/acheter/biens-en-vente` (toutes les pages) et :

- **Nouveau bien sur le site** → créé dans l'app (non attribué, à répartir entre agents).
- **Bien déjà présent** → prix, exclusivité et secteur mis à jour. L'agent, le propriétaire,
  la commission et le statut avancé (sous offre, compromis, vendu) **ne sont jamais touchés**.
- **Bien disparu du site** (vendu/retiré) → **marqué** « retiré du site », **pas supprimé**.
- **Mandat saisi à la main** (non issu du site) → **jamais modifié**.

Chaque bien du site garde son identifiant d'annonce unique : pas de doublons possibles.

## Installation — à faire UNE seule fois

Il y a **une seule chose** à configurer : donner à GitHub la clé d'accès à la base.

1. Poussez ce projet sur GitHub (comme d'habitude). Les fichiers `.github/workflows/sync-mandats-orpi.yml`
   et `scripts/sync-mandats-orpi.mjs` seront pris en compte automatiquement.

2. Sur GitHub, ouvrez votre dépôt **ORPI-PILOMAX**, puis :
   **Settings** (Paramètres) → **Secrets and variables** → **Actions** → bouton **New repository secret**.

3. Créez le secret :
   - **Name** (nom) : `SUPABASE_KEY`
   - **Secret** (valeur) : la clé Supabase (la même que dans `src/supabase.js`, la longue chaîne
     qui commence par `eyJhbGciOi...`).
   - Cliquez **Add secret**.

C'est tout. La synchro tournera **chaque jour à 7h du matin** (heure de Paris) automatiquement.

## Lancer la synchro à la main (quand vous voulez)

1. Sur GitHub, dépôt ORPI-PILOMAX → onglet **Actions**.
2. Dans la liste à gauche, cliquez sur **Synchro biens ORPI**.
3. Bouton **Run workflow** (à droite) → **Run workflow**.

La synchro se lance en une minute et charge tout d'un coup. Vous pouvez suivre son déroulé
en cliquant sur l'exécution : elle affiche combien de biens ont été créés / mis à jour / retirés.

## Après une synchro

Ouvrez l'app et rafraîchissez (Ctrl+Shift+R). Les biens sont là, **non attribués** — utilisez
l'écran **« 👥 Attribuer les mandats »** pour les répartir entre vos agents.

## Bon à savoir

- La page publique ne contient **pas** le propriétaire, l'agent ni la commission : ces champs
  restent vides, à compléter par vos agents.
- L'adresse importée est le **secteur/quartier** (ex. « Amiens - Centre-ville »), pas l'adresse exacte.
- Si le site est momentanément indisponible, la synchro s'arrête sans rien modifier (base préservée).
- Changer l'heure : modifiez la ligne `cron` dans `.github/workflows/sync-mandats-orpi.yml`
  (format UTC ; `0 5 * * *` = 5h UTC = 7h Paris en été).
