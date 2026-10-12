// ============================================================
//  CONFIG — seul fichier à toucher si tu renommes des colonnes
//  Les noms de colonnes ne tiennent pas compte des majuscules.
// ============================================================
const CONFIG = {
  clips: {
    file: "data/Stream_Metal_Setlist - clips.csv",
    // colonne du nom du groupe (sert à faire le lien avec la table des groupes)
    bandCol: "BAND",
    // colonne titre du morceau
    titleCol: "SONG",
    // colonne contenant l'URL du clip (affichée comme bouton ▶)
    urlCol: "CLIP'S URL",
    // colonne favori (valeur non vide / TRUE / 1 = favori) — ignorée si elle n'existe pas
    favCol: "Favorite",
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
    file: "data/Stream_Metal_Setlist - band.csv",
    // colonnes possibles pour le nom du groupe (la 1re non vide est utilisée)
    nameCols: ["Band"],
    hide: ["ID metal-archives"],
    filters: [
      { col: "Country of origin" },
      { col: "Genre", split: /[\/,]+/ },
    ],
    // lien Metal Archives construit depuis cette colonne d'ID (optionnel)
    maIdCol: "ID metal-archives",
  },
  pageSize: 50,
  naValues: ["#N/A", "N/A", "#REF!", "#VALUE!", "undefined", "null"],
};
