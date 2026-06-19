# Buzz Finder

App web qui scanne YouTube pour trouver les vidéos en forte croissance de vues,
candidates idéales au clipping. Tout tourne dans le navigateur (aucun serveur
backend) : tu fournis ta clé API YouTube, elle reste stockée localement sur
ton appareil.

## 1. Mettre le projet sur GitHub

```bash
# Depuis le dossier buzzfinder-app/
git init
git add .
git commit -m "Buzz Finder v1"
```

Puis sur github.com :
1. Crée un nouveau repository (ex: `buzzfinder`), **public** (nécessaire pour
   GitHub Pages gratuit sans abonnement Pro).
2. Lie ton dossier local et pousse :
```bash
git remote add origin https://github.com/TON-PSEUDO/buzzfinder.git
git branch -M main
git push -u origin main
```

## 2. Activer GitHub Pages

1. Sur la page du repo : **Settings** → **Pages**
2. Dans "Build and deployment" → Source : **Deploy from a branch**
3. Branche : `main`, dossier : `/ (root)`
4. Sauvegarde. Au bout d'1-2 minutes, ton site est en ligne à :
   `https://TON-PSEUDO.github.io/buzzfinder/`

## 3. Obtenir une clé API YouTube

1. Va sur https://console.cloud.google.com/
2. Crée un projet (ou utilise un existant)
3. Menu → "API et services" → "Bibliothèque" → cherche **YouTube Data API v3** → Active
4. "Identifiants" → "Créer des identifiants" → "Clé API"
5. Copie la clé

Le quota gratuit (10 000 unités/jour) permet largement plusieurs dizaines de
scans par jour pour un usage perso.

## 4. Ajouter l'app sur ton iPhone (PWA)

1. Ouvre `https://TON-PSEUDO.github.io/buzzfinder/` dans **Safari** (important :
   doit être Safari, pas Chrome, pour que l'ajout à l'écran d'accueil fonctionne)
2. Appuie sur l'icône de partage (carré avec flèche vers le haut)
3. Fais défiler et choisis **"Sur l'écran d'accueil"**
4. Confirme — l'icône Buzz Finder apparaît sur ton écran d'accueil et s'ouvre
   en plein écran comme une vraie app, sans la barre d'adresse Safari.

## 5. Premier lancement

À la première ouverture, l'app te demande ta clé API YouTube (icône ⚙️ en
haut à droite si le panneau ne s'ouvre pas automatiquement). Elle est
sauvegardée dans le navigateur — tu n'as à la rentrer qu'une fois.

## Mettre à jour l'app plus tard

Quand tu modifies le code (par exemple pour ajouter le module de clipping) :

```bash
git add .
git commit -m "Description du changement"
git push
```

GitHub Pages redéploie automatiquement en 1-2 minutes. Ferme et rouvre l'app
sur iPhone pour récupérer la nouvelle version (le service worker peut mettre
en cache l'ancienne version brièvement — un refresh forcé règle ça).

## Structure du projet

```
buzzfinder-app/
├── index.html          # Page principale
├── style.css            # Design (thème sombre, accent ambre)
├── app.js                # Logique : appels API YouTube + scoring de buzz
├── manifest.json         # Config PWA (nom, icônes, couleurs)
├── service-worker.js     # Cache offline de la coquille de l'app
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Prochaine étape

Cette v1 fait uniquement la détection des vidéos à fort potentiel. Le module
de clipping (téléchargement + transcription + découpage automatique) viendra
en v2 dans ce même projet.
