// ============================================================
//  CONFIG — seul fichier à toucher si tu renommes des colonnes
//  Les noms de colonnes ne tiennent pas compte des majuscules.
// ============================================================
const CONFIG = {
  clips: {
    // source principale : feuille Google publiée en CSV (se met à jour toute seule)
    file: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfvMjnXkousbjfq3WtyKIZ9OI6LnIlt-kJcszsUd-dN5uqaI5Pk0uG3Wb2lLMB4u5vrGxarX1gDf94/pub?gid=1990340787&single=true&output=csv",
    // secours si Google est injoignable (optionnel : supprime la ligne pour désactiver)
    fallback: "data/Stream_Metal_Setlist - clips.csv",
    // colonne du nom du groupe (sert à faire le lien avec la table des groupes)
    bandCol: "BAND",
    // colonne titre du morceau
    titleCol: "SONG",
    // colonne contenant l'URL du clip (affichée comme bouton ▶)
    urlCol: "CLIP'S URL",
    // colonne favori (valeur non vide / TRUE / 1 = favori) — ignorée si elle n'existe pas
    favCol: "Favorite",
    // tri par défaut : plus récent d'abord (les dates vides vont à la fin)
    defaultSort: { col: "DATE", desc: true },
    // colonne de date, utilisée pour "les derniers clips" de la page d'accueil
    dateCol: "DATE",
    // colonne d'ID Metal Archives : sert au lien avec la table des groupes (vide = pas de lien)
    maIdCol: "ID METAL ARCHIVES",
    // colonnes cachées dans le tableau (toujours visibles dans la fiche détail)
    hide: ["Colonne 1", "ACTION", "DOUBLON?", "Column 1", "Dans l'ém", "SOURCE", "WEEK", "ID METAL ARCHIVES"],
    // filtres : colonne + séparateur éventuel pour les cellules multi-valeurs
    filters: [
      { col: "VIDEO'S TYPE" },
      { col: "COUNTRY" },
      { col: "STYLE FROM SOURCES", split: /[\n,\/]+/ },
    ],
    // colonnes manquantes (#N/A, vide) complétées depuis la table des groupes
    fillFromBands: { "COUNTRY": "Country of origin", "STYLE FROM SOURCES": "Genre" },
  },
  bands: {
    file: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfvMjnXkousbjfq3WtyKIZ9OI6LnIlt-kJcszsUd-dN5uqaI5Pk0uG3Wb2lLMB4u5vrGxarX1gDf94/pub?gid=488321503&single=true&output=csv",
    fallback: "data/Stream_Metal_Setlist - band.csv",
    // colonnes possibles pour le nom du groupe (la 1re non vide est utilisée)
    nameCols: ["Band"],
    // tri par défaut : ordre alphabétique (conservé quand on filtre)
    defaultSort: { col: "Band", desc: false },
    hide: ["ID metal-archives", "URL Logo", "Status", "Years active", "Label"],
    // colonne contenant l'URL du logo (affiché en haut de la fiche du groupe)
    logoCol: "URL Logo",
    // colonne du pays (carte et quiz des pays)
    countryCol: "Country of origin",
    // colonnes utilisées par la carte pour placer les groupes et décrire leur fenêtre
    locationCol: "Location",
    genreCol: "Genre",
    // colonne de la feuille <- champ du cache Metal Archives (priorité à Metal Archives quand il a une valeur).
    // Les colonnes absentes de la feuille (Status, Years active, Label) sont ajoutées automatiquement.
    // Le nom du groupe (colonne Band) n'est volontairement pas remplacé : tu gardes ta façon de l'écrire.
    maFields: {
      "Country of origin": "country",
      "Location": "location",
      "Formed in": "formed_in",
      "Genre": "genre",
      "Themes": "themes",
      "URL Logo": "logo",
      "Status": "status",
      "Years active": "years_active",
      "Label": "label",
    },
    filters: [
      { col: "Country of origin" },
      { col: "Genre", split: /[\/,]+/ },
      { col: "Themes", split: /[,;]+/ },
    ],
    // lien Metal Archives construit depuis cette colonne d'ID (optionnel)
    maIdCol: "ID metal-archives",
  },
  // jeu « Quel morceau ? » (extrait de clip) : points et durées
  song: { extractSeconds: 45, bandPoints: 100, hintCost: 20, wrongCost: 10, minBand: 20, titleBonus: 30, tries: 3 },
  pageSize: 50,
  // nombre de clips récents affichés sur la page d'accueil
  homeCount: 20,
  // infos Metal Archives récupérées par tools/update_ma_cache.py (laisse vide pour tout désactiver)
  maCacheFile: "data/ma_cache.json",
  // date et durée des vidéos YouTube récupérées par tools/update_yt_cache.py (laisse vide pour désactiver)
  // Elles ne complètent que les cellules DATE / DURATION vides ou #N/A : ta feuille reste prioritaire.
  ytCacheFile: "data/yt_cache.json",
  ytDateCol: "DATE",
  ytDurationCol: "DURATION",
  // villes et coordonnées (généré une fois, ne change pas)
  citiesFile: "data/cities.json",
  naValues: ["#N/A", "N/A", "#REF!", "#VALUE!", "undefined", "null"],
};
