# Metal Clips

Site statique : il lit directement `data/Stream_Metal_Setlist - clips.csv` et `data/Stream_Metal_Setlist - band.csv`. Pas de base de données.

## Structure

```
index.html
style.css
config.js    <- noms de colonnes, filtres, colonnes cachées
app.js
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
