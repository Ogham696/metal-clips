# Metal Clips

Site statique : il lit directement `data/Stream_Metal_Setlist - clips.csv` et `data/Stream_Metal_Setlist - band.csv`. Pas de base de données.

## Structure

```
index.html
style.css
config.js    <- noms de colonnes, filtres, colonnes cachées, nombre de clips en accueil
countries.js <- positions des pays et lecture de la colonne Location
  (data/cities.json : coordonnées des villes, généré une fois)
app.js       <- tableaux Clips / Groupes, fiches
views.js     <- pages Accueil, Carte et Jeux
data/
  Stream_Metal_Setlist - clips.csv
  Stream_Metal_Setlist - band.csv
```

## Mettre en ligne (GitHub Pages)

1. Crée un dépôt GitHub et envoie-y tous ces fichiers.
2. Settings → Pages → Source : branche `main`, dossier `/ (root)`.
3. Le site est disponible sur `https://<ton-user>.github.io/<repo>/`.

## Mettre à jour les données

Le site lit directement tes feuilles Google publiées en CSV (liens dans `config.js`, clé `file`). Tu modifies ta feuille, et le site se met à jour tout seul après quelques minutes (délai de cache de Google). Plus rien à exporter ni à envoyer sur GitHub.

- Les fichiers du dossier `data/` ne servent que de **secours** si Google est injoignable. Tu peux les remplacer de temps en temps par un export récent, ou supprimer la ligne `fallback` dans `config.js`.
- Si tu supprimes la publication d'une feuille (Fichier → Partager → Publier sur le web), le site bascule sur le secours.
- Ne change pas l'ordre ni le nom des colonnes sans adapter `config.js`.

## Infos Metal Archives (automatique, optionnel)

Il suffit de renseigner la colonne `ID METAL ARCHIVES` sur la ligne du **clip** : le script lit les ID de la feuille des clips (puis ceux de la feuille des groupes) et le site crée la fiche du groupe tout seul s'il n'est pas dans la table des groupes. La table `band` ne sert plus que pour les groupes absents de Metal Archives (ou pour corriger une info). Pour chaque groupe qui a un ID, le site utilise **d'abord** les infos de Metal Archives (pays, ville, année de formation, genre, thèmes, logo, statut, années d'activité, label). Si l'ID est vide, ou si le groupe est introuvable, ce sont les valeurs de ta table `band` qui servent. Le nom du groupe reste celui de ta feuille.

Comme Python ne tourne pas sur GitHub Pages, le script `tools/update_ma_cache.py` (bibliothèque `enmet`) interroge Metal Archives et écrit le résultat dans `data/ma_cache.json`, que le site lit.

- **Automatique** : le workflow `.github/workflows/update-ma.yml` tourne chaque nuit et enregistre `data/ma_cache.json` s'il a changé. Premier lancement à la main : onglet **Actions** → « Mise à jour Metal Archives » → **Run workflow**.
  - Réglage à faire une fois : Settings → Actions → General → Workflow permissions → **Read and write permissions**.
  - Le dossier `.github` est caché : sur GitHub, utilise « Add file → Create new file » et tape `.github/workflows/update-ma.yml` comme nom, puis colle le contenu.
- **Sur ton PC** (si GitHub est bloqué par Metal Archives) :
  ```
  pip install enmet==0.9.1 curl_cffi
  python3 tools/update_ma_cache.py
  ```
  puis envoie `data/ma_cache.json` sur GitHub.
- Metal Archives refuse les requêtes Python classiques (erreur 403) : le script imite donc un vrai Chrome grâce à `curl_cffi`. Si ça ne suffit pas, copie les cookies de ton navigateur (F12 → Réseau → une requête vers metal-archives.com → en-tête `Cookie`) et lance `python tools/update_ma_cache.py --cookie "..."`.
- Options du script : `--limit N` (nombre de groupes par passage, 1500 par défaut, 0 = illimité), `--only ID`, `--refresh-days` (relire un groupe après N jours, 180 par défaut), `--retry-days`, `--dry-run`.
- Un groupe introuvable (404) est mémorisé pour ne pas le redemander à chaque fois. Le script s'arrête après 5 échecs de suite (blocage possible) et reprend au passage suivant.
- Pour désactiver tout ça : mets `maCacheFile: ""` dans `config.js`.
- Les colonnes reprises de Metal Archives se règlent dans `maFields` (`config.js`).

## Date et durée YouTube (automatique, optionnel)

Le script `tools/update_yt_cache.py` (bibliothèque `yt-dlp`) lit l'adresse YouTube de chaque clip dans la feuille, demande à YouTube la **date de publication** et la **durée**, et les range dans `data/yt_cache.json`. Le site remplit alors les colonnes `DATE` et `DURATION` **uniquement quand la feuille les laisse vides ou en `#N/A`** : tes valeurs restent prioritaires. Le tri par date et la page d'accueil en profitent.

- Seules les vidéos qui manquent sont interrogées ; une vidéo déjà dans le cache n'est jamais redemandée. Une vidéo privée ou supprimée est notée « indisponible » et réessayée après 30 jours.
- Une vidéo pas encore sortie (« Premieres in 7 hours ») n'est **pas** une erreur : elle est ignorée pour l'instant, redemandée au prochain passage, et ne compte pas dans les échecs qui arrêtent le script.
- Une vidéo 18+ est notée à part. Pour qu'elle passe, ajoute les cookies de ton navigateur : `python tools/update_yt_cache.py --browser chrome` (ou `edge`, `firefox`).
- Les liens de playlist (`&list=…`) fonctionnent : seul l'identifiant de la vidéo compte.
- Pour tout mettre à jour d'un coup (Metal Archives puis YouTube) : `python tools/update_all.py`. Avec `--push`, les deux fichiers de cache sont aussi envoyés sur GitHub (commit + push) ; il faut pour cela que le dossier soit un dépôt cloné avec GitHub Desktop. Ensuite, envoie `data/ma_cache.json` et `data/yt_cache.json` sur GitHub.
- Installation : `pip install enmet==0.9.1 curl_cffi yt-dlp`.
- Pour désactiver : `ytCacheFile: ""` dans `config.js`.

## Pages

- **Accueil** : les 20 derniers clips (colonne `DATE`, plus récent d'abord) et quelques chiffres. Le nombre de clips se règle avec `homeCount` dans `config.js`.
- **Carte** : chaque groupe est placé dans sa ville d'après la colonne `Location` et son pays (ex. « Cleveland, Ohio » + United States). Les groupes proches se regroupent en bulles qui se séparent quand on zoome. Si la ville n'est pas reconnue, le groupe est placé au centre de son pays (cercle creux). Quand une ligne indique plusieurs villes, la plus récente est utilisée. Les coordonnées viennent de `data/cities.json` (fichier généré une fois : ne le modifie pas). Pour corriger ou ajouter une ville, utilise `CITY_EXTRA` dans `countries.js`.
- **Jeux** : « Quel groupe ? » (un logo, 4 noms) et « Quel pays ? » (un nom de groupe, 4 pays). Vert/rouge puis « Suivant ». Les touches 1 à 4 répondent, Entrée passe à la suite. Le bouton **⏱ Chrono** lance une manche de 10 questions à 5 secondes : passage automatique à la question suivante, 100 points par bonne réponse + jusqu'à 50 selon la rapidité, record gardé dans le navigateur. Pour changer les durées : `ROUND_LEN`, `TIME_LIMIT`, `BONUS_MAX` en haut de la partie Jeux de `views.js`. Dans le jeu des logos, les mauvaises réponses sont des noms proches de la bonne (même nombre de mots, mêmes initiales, même fin).

## Colonnes

- Les noms de colonnes sont dans `config.js`. Si tu en renommes une dans ta feuille, change-la là aussi.
- Le lien clip ↔ groupe se fait uniquement par la colonne `ID metal-archives` (identique dans les deux tables), pour éviter les homonymes. ID vide dans les clips = groupe absent de la table des groupes : le nom s'affiche en texte simple, sans fiche.
- Les valeurs `#N/A` sont traitées comme vides. Pays et style manquants dans les clips sont complétés depuis la table des groupes.
- Favoris : toute valeur non vide dans la colonne `Favorite` (sauf FALSE/0/non).

## Tester en local

Ouvrir `index.html` directement ne marche pas (le navigateur bloque la lecture des CSV). Lance :

```
python3 -m http.server
```

puis ouvre http://localhost:8000.
