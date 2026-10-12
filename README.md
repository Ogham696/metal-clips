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

Exporte ta feuille en CSV (Fichier → Télécharger → CSV, **une feuille à la fois**), garde les noms `Stream_Metal_Setlist - clips.csv` / `Stream_Metal_Setlist - band.csv`, remplace les fichiers dans `data/` sur GitHub (Add file → Upload files). Le site se met à jour après une minute ou deux.

## Colonnes

- Les noms de colonnes sont dans `config.js`. Si tu en renommes une dans ta feuille, change-la là aussi.
- Le lien clip ↔ groupe se fait via le nom du groupe (colonne `BAND` des clips = colonne `Band` des groupes), sans tenir compte des majuscules.
- Les valeurs `#N/A` sont traitées comme vides. Pays et style manquants dans les clips sont complétés depuis la table des groupes.
- Favoris : toute valeur non vide dans la colonne `Favorite` (sauf FALSE/0/non).

## Tester en local

Ouvrir `index.html` directement ne marche pas (le navigateur bloque la lecture des CSV). Lance :

```
python3 -m http.server
```

puis ouvre http://localhost:8000.
