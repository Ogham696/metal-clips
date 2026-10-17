// ============================================================
//  Positions approximatives (latitude, longitude) des pays, pour la carte.
//  Une bulle par pays, placée vers le centre du pays.
//  Pays absent de la liste ? Ajoute une ligne : "nom en anglais": [lat, lng],
//  (le nom doit être celui de la colonne "Country of origin", sans tenir
//  compte des majuscules ni des accents).
// ============================================================
const COUNTRY_COORDS = {
  "afghanistan": [33.9, 67.7], "albania": [41.2, 20.2], "algeria": [28.0, 2.6], "andorra": [42.5, 1.5],
  "angola": [-11.2, 17.9], "argentina": [-34.0, -64.0], "armenia": [40.1, 45.0], "aruba": [12.5, -70.0],
  "australia": [-25.3, 134.0], "austria": [47.5, 14.5], "azerbaijan": [40.4, 47.6], "bahamas": [25.0, -77.4],
  "bahrain": [26.0, 50.5], "bangladesh": [23.7, 90.4], "barbados": [13.2, -59.5], "belarus": [53.7, 27.9],
  "belgium": [50.6, 4.7], "belize": [17.2, -88.7], "benin": [9.3, 2.3], "bermuda": [32.3, -64.8],
  "bhutan": [27.5, 90.4], "bolivia": [-16.3, -63.6], "bosnia and herzegovina": [44.2, 17.8], "botswana": [-22.3, 24.7],
  "brazil": [-10.0, -52.0], "brunei": [4.5, 114.7], "bulgaria": [42.7, 25.5], "burkina faso": [12.2, -1.6],
  "cambodia": [12.6, 104.9], "cameroon": [5.7, 12.7], "canada": [56.1, -106.3], "cape verde": [16.0, -24.0],
  "cayman islands": [19.3, -81.3], "chile": [-35.7, -71.5], "china": [35.0, 103.0], "colombia": [4.6, -74.3],
  "costa rica": [9.9, -84.0], "croatia": [45.1, 15.2], "cuba": [21.5, -79.5], "curacao": [12.2, -69.0],
  "cyprus": [35.1, 33.4], "czech republic": [49.8, 15.5], "czechia": [49.8, 15.5],
  "democratic republic of the congo": [-2.9, 23.7], "denmark": [56.0, 10.0], "dominican republic": [18.9, -70.2],
  "ecuador": [-1.8, -78.2], "egypt": [26.8, 30.8], "el salvador": [13.8, -88.9], "estonia": [58.6, 25.0],
  "eswatini": [-26.5, 31.5], "ethiopia": [9.1, 40.5], "faroe islands": [62.0, -6.9], "fiji": [-17.7, 178.1],
  "finland": [64.0, 26.0], "france": [46.6, 2.4], "french polynesia": [-17.7, -149.4], "georgia": [42.3, 43.4],
  "germany": [51.2, 10.4], "ghana": [7.9, -1.0], "gibraltar": [36.14, -5.35], "greece": [39.0, 22.0],
  "greenland": [72.0, -40.0], "guadeloupe": [16.25, -61.55], "guam": [13.4, 144.8], "guatemala": [15.5, -90.3],
  "guernsey": [49.45, -2.58], "haiti": [19.0, -72.3], "honduras": [15.2, -86.2], "hong kong": [22.3, 114.2],
  "hungary": [47.2, 19.5], "iceland": [64.9, -18.6], "india": [21.0, 78.0], "indonesia": [-2.5, 118.0],
  "iran": [32.4, 53.7], "iraq": [33.2, 43.7], "ireland": [53.4, -8.2], "isle of man": [54.24, -4.55],
  "israel": [31.0, 34.9], "italy": [42.8, 12.5], "ivory coast": [7.5, -5.5], "jamaica": [18.1, -77.3],
  "japan": [36.2, 138.3], "jersey": [49.2, -2.13], "jordan": [31.2, 36.5], "kazakhstan": [48.0, 67.0],
  "kenya": [0.0, 37.9], "kosovo": [42.6, 20.9], "kuwait": [29.3, 47.5], "kyrgyzstan": [41.2, 74.8],
  "laos": [19.9, 102.5], "latvia": [56.9, 24.6], "lebanon": [33.9, 35.9], "lesotho": [-29.6, 28.2],
  "liberia": [6.4, -9.4], "libya": [26.3, 17.2], "liechtenstein": [47.2, 9.55], "lithuania": [55.2, 23.9],
  "luxembourg": [49.8, 6.1], "macao": [22.2, 113.5], "madagascar": [-19.0, 46.9], "malaysia": [4.2, 102.0],
  "maldives": [3.2, 73.2], "mali": [17.6, -4.0], "malta": [35.9, 14.4], "martinique": [14.6, -61.0],
  "mauritius": [-20.3, 57.6], "mexico": [23.6, -102.5], "moldova": [47.4, 28.4], "monaco": [43.74, 7.42],
  "mongolia": [46.9, 103.8], "montenegro": [42.7, 19.4], "morocco": [31.8, -7.1], "mozambique": [-18.7, 35.5],
  "myanmar": [21.9, 96.0], "namibia": [-22.0, 17.0], "nepal": [28.4, 84.1], "netherlands": [52.2, 5.3],
  "new caledonia": [-21.3, 165.5], "new zealand": [-41.0, 172.0], "nicaragua": [12.9, -85.2], "nigeria": [9.1, 8.7],
  "north korea": [40.3, 127.5], "north macedonia": [41.6, 21.7], "norway": [62.0, 9.5], "oman": [21.5, 55.9],
  "pakistan": [30.4, 69.3], "palestine": [31.9, 35.2], "panama": [8.5, -80.8], "papua new guinea": [-6.3, 143.9],
  "paraguay": [-23.4, -58.4], "peru": [-9.2, -75.0], "philippines": [12.9, 121.8], "poland": [52.0, 19.4],
  "portugal": [39.6, -8.0], "puerto rico": [18.2, -66.5], "qatar": [25.3, 51.2], "reunion": [-21.1, 55.5],
  "romania": [45.9, 25.0], "russia": [61.5, 95.0], "rwanda": [-1.9, 29.9], "san marino": [43.94, 12.46],
  "saudi arabia": [24.0, 45.0], "senegal": [14.5, -14.5], "serbia": [44.0, 21.0], "singapore": [1.35, 103.8],
  "slovakia": [48.7, 19.7], "slovenia": [46.15, 14.99], "south africa": [-29.0, 24.0], "south korea": [36.5, 127.9],
  "south sudan": [7.0, 30.0], "spain": [40.0, -3.7], "sri lanka": [7.9, 80.7], "sudan": [15.5, 30.0],
  "suriname": [4.0, -56.0], "svalbard": [78.0, 16.0], "sweden": [62.0, 15.0], "switzerland": [46.8, 8.2],
  "syria": [35.0, 38.5], "taiwan": [23.7, 121.0], "tajikistan": [38.9, 71.3], "tanzania": [-6.4, 34.9],
  "thailand": [15.0, 101.0], "trinidad and tobago": [10.7, -61.2], "tunisia": [34.0, 9.0], "turkey": [39.0, 35.2],
  "turkmenistan": [39.0, 59.5], "uganda": [1.4, 32.3], "ukraine": [49.0, 32.0], "united arab emirates": [24.0, 54.0],
  "united kingdom": [54.0, -2.5], "united states": [39.8, -98.6], "uruguay": [-32.8, -56.0], "uzbekistan": [41.4, 64.6],
  "vatican city": [41.9, 12.45], "venezuela": [7.0, -66.0], "vietnam": [16.0, 107.0], "virgin islands": [18.3, -64.8],
  "yemen": [15.5, 47.5], "yugoslavia": [44.0, 20.5], "zambia": [-14.0, 27.8], "zimbabwe": [-19.0, 29.8],
  "aland islands": [60.2, 20.0],
};

// autres écritures possibles d'un même pays
const COUNTRY_ALIASES = {
  "usa": "united states", "united states of america": "united states", "uk": "united kingdom", "great britain": "united kingdom",
  "england": "united kingdom", "scotland": "united kingdom", "wales": "united kingdom", "northern ireland": "united kingdom",
  "macedonia": "north macedonia", "slovak republic": "slovakia", "turkiye": "turkey", "cote d'ivoire": "ivory coast",
  "korea, south": "south korea", "korea": "south korea", "korea, north": "north korea", "burma": "myanmar",
  "trinidad & tobago": "trinidad and tobago", "bosnia & herzegovina": "bosnia and herzegovina", "bosnia": "bosnia and herzegovina",
  "congo (dem. rep.)": "democratic republic of the congo", "dr congo": "democratic republic of the congo",
  "russian federation": "russia", "palestinian territories": "palestine", "state of palestine": "palestine",
  "hong kong sar": "hong kong", "macau": "macao", "swaziland": "eswatini", "cabo verde": "cape verde",
  "czech": "czech republic", "holland": "netherlands", "persia": "iran",
};

const _normCountry = (s) => (s || "").toString().trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// renvoie [lat, lng] ou null si le pays est inconnu
function countryCoord(name) {
  const k = _normCountry(name);
  return COUNTRY_COORDS[k] || COUNTRY_COORDS[COUNTRY_ALIASES[k]] || null;
}

// ============================================================
//  Villes : on retrouve la position d'un groupe à partir de sa colonne
//  "Location" (ex. « Cleveland, Ohio ») et de son pays.
//  Les coordonnées viennent de data/cities.json (villes de plus de 2000 habitants).
// ============================================================

// villes absentes de cities.json ou mal reconnues : ajoute-les ici
// clé = "nom de la ville|CODE PAYS ISO" (sans accents, en minuscules), valeur = [latitude, longitude]
const CITY_EXTRA = {
  // "ma petite ville|FR": [46.5, 2.5],
};

const US_STATES = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE",
  "florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY",
  "louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO",
  "montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC",
  "north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",
  "tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
  "district of columbia":"DC",
};

// même normalisation que celle utilisée pour fabriquer cities.json
const _normPlace = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/['’`´]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
  .replace(/\bst\b/g, "saint").replace(/\bmt\b/g, "mount");

let _isoByCountry = null;
function countryISO(name) {
  if (!_isoByCountry) {
    _isoByCountry = {};
    try {
      const dn = new Intl.DisplayNames(["en"], { type: "region" });
      for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
        const cc = String.fromCharCode(a, b);
        let n; try { n = dn.of(cc); } catch (e) { continue; }
        if (n && n !== cc) _isoByCountry[_normPlace(n)] = cc;
      }
    } catch (e) { /* navigateur très ancien : pas de géocodage des villes */ }
    Object.assign(_isoByCountry, {
      "myanmar": "MM", "ivory coast": "CI", "hong kong": "HK", "macao": "MO", "palestine": "PS", "svalbard": "SJ",
      "democratic republic of the congo": "CD", "czech republic": "CZ", "czechia": "CZ", "reunion": "RE", "kosovo": "XK",
      "united states": "US", "united kingdom": "GB", "russia": "RU", "south korea": "KR", "north korea": "KP", "vatican city": "VA",
    });
  }
  const k = _normCountry(name);
  return _isoByCountry[_normPlace(COUNTRY_ALIASES[k] || k)] || null;
}

// "Cairns (early)/Brisbane (later), Queensland" -> { city: "Brisbane", region: "Queensland" }
function parseLocation(text) {
  const t = (text || "").toString().trim();
  if (!t || /^(n\/a|\?|#n\/a)$/i.test(t)) return null;
  const first = (seg) => { const p = seg.replace(/^[\s,;\/]+/, "").split(",").map((x) => x.trim()); return { city: p[0] || "", region: p[1] || "" }; };
  const parts = t.split(/\(([^)]*)\)/);          // [texte, (tag), texte, (tag), …, reste]
  const timed = [];
  for (let i = 0; i + 1 < parts.length; i += 2) if (/^(early|late|later|present|current|now|formerly|originally|previously)/i.test(parts[i + 1].trim())) timed.push({ seg: parts[i], tag: parts[i + 1].toLowerCase() });
  if (timed.length) {
    const pick = timed.find((x) => /present|current|now/.test(x.tag)) || [...timed].reverse().find((x) => /late/.test(x.tag)) || timed[timed.length - 1];
    const r = first(pick.seg);
    if (!r.region && pick === timed[timed.length - 1]) r.region = first(parts[parts.length - 1]).city;  // ", Queensland" après le dernier tag
    return r;
  }
  return first(t.replace(/\([^)]*\)/g, "").split(/[\/;]/)[0]);
}

// renvoie [lat, lng] ou null ; window.CITY_INDEX est rempli par views.js
function cityCoord(location, country) {
  const iso = countryISO(country), p = parseLocation(location);
  if (!iso || !p || !p.city) return null;
  const c = _normPlace(p.city);
  if (CITY_EXTRA[c + "|" + iso]) return CITY_EXTRA[c + "|" + iso];
  const idx = window.CITY_INDEX; if (!idx) return null;
  if (iso === "US" && p.region) { const st = US_STATES[_normPlace(p.region)]; if (st && idx[c + "|US|" + st]) return idx[c + "|US|" + st]; }
  const hit = (k) => idx[k + "|" + iso] || null;
  let r = hit(c);
  // « Mühldorf am Inn » -> « Mühldorf » : on retire les derniers mots tant que rien n'est trouvé
  for (let w = c.split(" "); !r && w.length > 1; ) { w = w.slice(0, -1); if (w.join(" ").length >= 5) r = hit(w.join(" ")); }
  return r;
}
