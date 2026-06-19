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

## 3bis. Obtenir des identifiants Twitch

1. Va sur https://dev.twitch.tv/console/apps/create (connecte-toi avec ton
   compte Twitch habituel)
2. Nom de l'appli : ce que tu veux (ex: "buzzfinder-perso")
3. OAuth Redirect URL : `https://localhost` (obligatoire mais pas utilisé
   par ce projet, qui utilise le flow "Client Credentials")
4. Catégorie : "Application Integration"
5. Crée l'appli → tu obtiens un **Client ID**
6. Clique sur "New Secret" pour générer un **Client Secret** (affiché une
   seule fois, copie-le immédiatement)

⚠️ Le Client Secret reste stocké uniquement dans ton navigateur, mais comme
c'est une app 100% front-end, il est techniquement visible si quelqu'un
inspecte le code de ton navigateur. Pour un usage strictement perso (toi
seul utilise l'app, tu ne partages pas l'URL), le risque est minime — c'est
le même compromis que pour la clé YouTube.

Sur Twitch, le scan cherche les **VODs (rediffusions de streams)** les plus
vues sur les 7 derniers jours pour un jeu/catégorie donné, triées par
vélocité de vues. Les Clips Twitch (déjà très courts, quelques secondes à
1 minute) ne sont pas inclus puisqu'ils sont déjà au format court — c'est
les VODs longues qui valent la peine d'être scannées pour en extraire des
clips.

## 4. TikTok : pourquoi ce n'est pas inclus

TikTok ne propose aucune API publique permettant de chercher ou lister les
vidéos tendances/virales d'autres comptes. Les seules APIs officielles
(TikTok for Developers — Display API, Content Posting API) ne donnent accès
qu'**à ton propre compte**, pas à du contenu tiers. Tout scraping automatisé
des pages "Trending" ou des résultats de recherche viole les conditions
d'utilisation de TikTok et casse fréquemment (structure de page qui change,
blocages anti-bot).

**Solution réaliste pour repérer du contenu TikTok à cliper/éditer :**

1. **Veille manuelle** : explore l'onglet Recherche / Trending dans l'app
   TikTok, ou consulte le **TikTok Creative Center**
   (https://ads.tiktok.com/business/creativecenter) qui publie publiquement
   les hashtags et sons tendances (accessible sans compte business, à jour
   quotidiennement)
2. **Récupération** : une fois qu'une vidéo t'intéresse, copie son lien
3. **Téléchargement** : utilise `yt-dlp` (déjà mentionné plus haut), qui
   gère très bien le téléchargement de vidéos TikTok individuelles par URL :
   ```bash
   yt-dlp "https://www.tiktok.com/@compte/video/1234567890"
   ```

Ce flux (veille manuelle + téléchargement ciblé) reste la méthode la plus
fiable et la plus pérenne à ce jour pour TikTok — aucun outil, même payant,
ne contourne réellement cette limitation pour du contenu tiers.

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
